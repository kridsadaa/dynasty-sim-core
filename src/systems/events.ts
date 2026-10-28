import { ageOf, must, newId, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type {
  Character, Condition, Effect, EventInstance, EventOption, GameEventDef, Percept,
  TagId, Trait, VarRef, WoundId,
} from '../core/types';
import { capability, inflictWound, selectPart } from './body';
import { resolveTrauma, type TraumaResult } from './trauma';

// ============================================================================
// Contextual Event Injection
//
// 1. resolve ตัวแปร ($target_food → food:pumpkin) → resolvedTags
// 2. expand tags ขึ้น ontology → ชนกับ target ของปมได้ทุกระดับ
//    (ปม aversion(food:gourd) ชนกับ event ที่มี food:cucumber)
// 3. InjectionRule (global, data-driven) แปลงการชนเป็น: เพิ่มตัวเลือก / ล็อกตัวเลือก / เพิ่ม effect
// ไม่มี event ไหนต้องรู้จักปมล่วงหน้า — ปมใหม่ที่เกิดแบบ emergent ใช้ได้ทันที
// ============================================================================

export interface TraitHit {
  trait: Trait;
  strength: number;
  scope: 'context' | 'option';
  optionId?: string;
}

export type ResolvedOption = Omit<EventOption, 'tags'> & { tags: TagId[] };

export interface PreparedEvent {
  def: GameEventDef;
  instance: EventInstance;
  actor: Character;
  options: ResolvedOption[];
  locked: Map<string, string>; // optionId → ruleId ที่ล็อก
  extraEffects: Effect[];
  hits: TraitHit[];
}

const isVar = (t: string): t is VarRef => t.startsWith('$');

export function prepareEvent(
  ctx: Ctx, defId: string, bindings: Record<string, Character['id']>, varOverride: Record<string, TagId> = {},
): PreparedEvent {
  const def = must(ctx.content.events[defId], defId);
  const actor = must(ctx.state.characters[must(bindings.actor, 'actor binding')], 'actor');

  const vars: Record<string, TagId> = {};
  for (const [k, v] of Object.entries(def.variables ?? {})) vars[k] = varOverride[k] ?? must(ctx.rng.pick(v.oneOf), k);
  const sub = (t: TagId | VarRef): TagId => (isVar(t) ? must(vars[t.slice(1)], t) : t);

  const instance: EventInstance = {
    id: newId(ctx, 'evt'),
    defId,
    day: ctx.state.meta.day,
    bindings,
    vars,
    resolvedTags: def.contextTags.map(sub),
    optionId: null,
    injectedRuleIds: [],
  };
  ctx.state.eventLog[instance.id] = instance;

  const baseOptions = def.options
    .filter((o) => (o.conditions ?? []).every((c) => checkCondition(ctx, actor, c)))
    .map((o) => ({ ...o, tags: (o.tags ?? []).map(sub) }));

  const prepared: PreparedEvent = {
    def, instance, actor, options: baseOptions, locked: new Map(), extraEffects: [], hits: [],
  };
  inject(ctx, prepared);
  return prepared;
}

function checkCondition(ctx: Ctx, ch: Character, c: Condition): boolean {
  switch (c.type) {
    case 'age': {
      const a = ageOf(ctx, ch);
      return (c.min === undefined || a >= c.min) && (c.max === undefined || a <= c.max);
    }
    case 'capability':
      return capability(ctx, ch, c.capability) >= c.min;
    case 'estate':
      return c.in.includes(ch.social.estate);
  }
}

function matchTraits(ctx: Ctx, actor: Character, tags: TagId[], scope: TraitHit['scope'], optionId?: string): TraitHit[] {
  const expanded = ctx.tags.expand(tags);
  const hits: TraitHit[] = [];
  for (const tid of actor.traitIds) {
    const t = ctx.state.traits[tid];
    if (!t?.target || !expanded.has(t.target)) continue;
    const target = t.target;
    const dist = Math.min(...tags.map((tag) => ctx.tags.distance(tag, target) ?? Infinity));
    // ยิ่ง context ตรงกับเป้าเฉพาะเจาะจงเท่าไร ยิ่งแรง (เจอแตงกวาตรงๆ แรงกว่าเจอ "ผัก")
    hits.push({ trait: t, strength: t.intensity / (1 + 0.25 * dist), scope, optionId });
  }
  return hits;
}

function inject(ctx: Ctx, p: PreparedEvent): void {
  const { actor } = p;
  const day = ctx.state.meta.day;
  const contextHits = matchTraits(ctx, actor, p.instance.resolvedTags, 'context');
  const optionHits = p.options.flatMap((o) => matchTraits(ctx, actor, o.tags, 'option', o.id));

  // ปมแฝง "ตื่น" ด้วยโอกาสเท่ากับความแรง — ครั้งแรกที่เด็กที่เคยโดนตอน 2 ขวบเห็นฟักทองแล้วร้องไห้โดยไม่รู้สาเหตุ
  const awake = (h: TraitHit): boolean => {
    if (h.trait.latent && !ctx.rng.chance(h.strength)) return false;
    h.trait.latent = false;
    return true;
  };
  p.hits = [...contextHits, ...optionHits].filter(awake);
  for (const h of p.hits) {
    if (h.trait.lastTriggeredDay !== day) h.trait.triggerCount++;
    h.trait.lastTriggeredDay = day;
  }

  const expanded = ctx.tags.expand(p.instance.resolvedTags);
  const apply = (ruleId: string, params: Record<string, string>) => {
    const rule = must(ctx.content.injectionRules.find((r) => r.id === ruleId), ruleId);
    if (!p.instance.injectedRuleIds.includes(ruleId)) p.instance.injectedRuleIds.push(ruleId);
    for (const o of rule.addOptions ?? []) {
      if (!p.options.some((x) => x.id === o.id)) p.options.push({ ...o, tags: [], injectedBy: ruleId, params });
    }
    p.extraEffects.push(...(rule.appendEffects ?? []));
  };

  for (const rule of ctx.content.injectionRules) {
    if (rule.requireContext && !rule.requireContext.every((t) => expanded.has(t))) continue;
    const m = rule.match;
    switch (m.type) {
      case 'trait': {
        for (const h of p.hits) {
          if (h.trait.kind !== m.kind || h.strength < m.minStrength || !h.trait.target) continue;
          if (h.scope === 'context') apply(rule.id, { target: ctx.tags.label(h.trait.target) });
          if (h.scope === 'option' && h.optionId && rule.lockOptionsMatchingTarget) p.locked.set(h.optionId, rule.id);
        }
        break;
      }
      case 'scar': {
        const has = actor.bodyPartIds.some((pid) => {
          const part = ctx.state.bodyParts[pid];
          const def = part && ctx.content.anatomies[actor.anatomyId]?.parts[part.partDefId];
          return !!def && m.visibility.includes(def.visibility) && part.scars.some((s) => s.severity >= (m.minSeverity ?? 0));
        });
        if (has) apply(rule.id, {});
        break;
      }
      case 'capability':
        if (capability(ctx, actor, m.capability) < m.below) apply(rule.id, {});
        break;
    }
  }
}

// ============================================================================
// Effect application
// ============================================================================

export interface EventReport {
  optionId: string;
  wounds: WoundId[];
  trauma: TraumaResult[];
}

export function chooseOption(ctx: Ctx, p: PreparedEvent, optionId: string): EventReport {
  if (p.locked.has(optionId)) throw new Error(`option ${optionId} locked by ${p.locked.get(optionId)}`);
  const opt = must(p.options.find((o) => o.id === optionId), optionId);
  p.instance.optionId = optionId;
  const report: EventReport = { optionId, wounds: [], trauma: [] };
  const woundsByRole = new Map<string, { ids: WoundId[]; maxSeverity: number }>();
  const who = (role: string) => {
    const id = p.instance.bindings[role];
    return id ? ctx.state.characters[id] : undefined;
  };

  for (const e of [...opt.effects, ...p.extraEffects]) {
    const ch = who(e.role);
    if (!ch) continue;
    switch (e.op) {
      case 'wound': {
        const part = selectPart(ctx, ch, e.part);
        if (!part) break;
        const healer = e.treatedByRole ? who(e.treatedByRole) : undefined;
        const w = inflictWound(
          ctx, ch, part, e.kind, ctx.rng.range(e.severity[0], e.severity[1]),
          healer ? { quality: e.treatmentQuality ?? 0.5, by: healer.id, remedy: null } : null,
          p.instance.id,
        );
        const slot = woundsByRole.get(e.role) ?? { ids: [], maxSeverity: 0 };
        slot.ids.push(w.id);
        slot.maxSeverity = Math.max(slot.maxSeverity, w.severity);
        woundsByRole.set(e.role, slot);
        report.wounds.push(w.id);
        break;
      }
      case 'trauma': {
        const wounds = woundsByRole.get(e.role);
        const panicker = e.panicRole ? who(e.panicRole) : undefined;
        report.trauma.push(
          resolveTrauma(ctx, {
            characterId: ch.id,
            eventInstanceId: p.instance.id,
            eventDefId: p.def.id,
            percepts: buildPercepts(p),
            physicalSeverity: wounds?.maxSeverity ?? 0,
            baseImpact: e.baseImpact,
            comforted: !!(e.comfortRole && who(e.comfortRole)),
            witnessPanic: panicker ? panicker.personality.neuroticism * (e.witnessPanic ?? 1) : 0,
            woundIds: wounds?.ids ?? [],
          }),
        );
        break;
      }
      case 'stress':
        ch.stress = clamp01(ch.stress + e.delta);
        break;
      case 'skill':
        ch.skills[e.skill] = Math.max(0, (ch.skills[e.skill] ?? 0) + e.delta);
        break;
      case 'prestige': {
        const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
        // บารมีที่ได้จากการกระทำขึ้นกับบุญ ส่วนบารมีที่เสียไม่ลดตามบุญ
        if (dyn) dyn.prestige += e.delta > 0 ? e.delta * meritEffectiveness(ch) : e.delta;
        break;
      }
    }
  }
  return report;
}

/**
 * บุญกำหนดประสิทธิผลของอำนาจ (lore: social.merit_and_power) — อำนาจมาได้หลายทาง แต่ผลมาจากบุญ
 * merit 0 → ×1 (ค่าเดิม), บุญมาก → สูงสุด ×1.5, บาปมาก → ต่ำสุด ×0.5
 */
export function meritEffectiveness(ch: Character): number {
  return 1 + 0.5 * Math.tanh(ch.merit / 50);
}

function buildPercepts(p: PreparedEvent): Percept[] {
  return p.def.percepts.map((t) => {
    const tag = isVar(t.tag) ? must(p.instance.vars[t.tag.slice(1)], t.tag) : t.tag;
    const entityId = t.bindRole ? p.instance.bindings[t.bindRole] : undefined;
    return entityId ? { tag, role: t.role, salience: t.salience, entityId } : { tag, role: t.role, salience: t.salience };
  });
}
