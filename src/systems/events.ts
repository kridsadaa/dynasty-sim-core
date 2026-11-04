import { ageOf, must, newId, yearOf, type Ctx, isAlive } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type {
  Character, Condition, Effect, EventInstance, EventOption, GameEventDef, Percept,
  TagId, Trait, VarRef, WoundId, LegendId,
} from '../core/types';
import { capability, inflictWound, selectPart } from './body';
import { cleanName, livingSpouse, pickNameFor, rememberCustomName, renameCharacter, wed } from './factory';
import { adjustFavor, applyCareer, officeRank } from './career';
import { applyChore } from './chores';
import { applyMarriageStep, canPay, purse, settleNpcSinsot, spend } from './marriage';
import { buryValuables, joinTaksin, leaveCity, stayInCity, warWhere } from './war';
import { resolveTrauma, type TraumaResult } from './trauma';
import { adjustBond, resistance, riskChance, type Resistance } from './will';
import { markDead } from './handover';
import { divorce, takeMinorWife } from './wives';
import { recordHabit } from './festivals';
import { markNursing, markTopknot } from './lifeEvents';

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
  locked: Map<string, string>; // optionId → ruleId ที่ล็อก ('will' = ใจไม่ยอม ดู resist)
  /** แรงต้านในใจต่อตัวเลือก (เฉพาะที่ ≥ strainAt) — ล็อกหรือฝืนใจ */
  resist: Map<string, Resistance>;
  extraEffects: Effect[];
  hits: TraitHit[];
}

/** PreparedEvent แบบ plain data — เซฟคู่กับ GameState เพื่อให้ event ที่รอผู้เล่นอยู่ไม่หายเมื่อโหลดเซฟ */
export interface PendingEventSnapshot {
  instanceId: EventInstance['id'];
  options: ResolvedOption[];
  locked: Array<[string, string]>;
  resist?: Array<[string, Resistance]>; // ไม่มีในเซฟก่อนมีระบบ will
  extraEffects: Effect[];
  hits: Array<{ traitId: Trait['id']; strength: number; scope: TraitHit['scope']; optionId?: string }>;
}

export function snapshotEvent(p: PreparedEvent): PendingEventSnapshot {
  return {
    instanceId: p.instance.id,
    options: p.options,
    locked: [...p.locked],
    resist: [...p.resist],
    extraEffects: p.extraEffects,
    hits: p.hits.map((h) => ({ traitId: h.trait.id, strength: h.strength, scope: h.scope, optionId: h.optionId })),
  };
}

/** คืน PreparedEvent จาก snapshot (ไม่สุ่มใหม่) — null ถ้า instance/actor ไม่อยู่ใน state แล้ว */
export function restoreEvent(ctx: Ctx, s: PendingEventSnapshot): PreparedEvent | null {
  const instance = ctx.state.eventLog[s.instanceId];
  const def = instance && ctx.content.events[instance.defId];
  const actorId = instance?.bindings.actor;
  const actor = actorId ? ctx.state.characters[actorId] : undefined;
  if (!instance || instance.optionId !== null || !def || !actor) return null;
  return {
    def, instance, actor,
    options: s.options,
    locked: new Map(s.locked),
    resist: new Map(s.resist ?? []),
    extraEffects: s.extraEffects,
    hits: s.hits.flatMap((h) => {
      const trait = ctx.state.traits[h.traitId];
      return trait ? [{ trait, strength: h.strength, scope: h.scope, optionId: h.optionId }] : [];
    }),
  };
}

const isVar = (t: string): t is VarRef => t.startsWith('$');

export function prepareEvent(
  ctx: Ctx, defId: string, bindings: Record<string, Character['id']>, varOverride: Record<string, TagId> = {},
): PreparedEvent {
  const def = must(ctx.content.events[defId], defId);
  const actor = must(ctx.state.characters[must(bindings.actor, 'actor binding')], 'actor');

  const vars: Record<string, TagId> = {};
  for (const [k, v] of Object.entries(def.variables ?? {})) vars[k] = varOverride[k] ?? must(ctx.rng.pick(v.oneOf), k);
  // ตัวแปรที่ผู้เรียกส่งมาแต่ def ไม่ได้ประกาศ (เช่น ข้อความตำนานใน family.legend_truth) — ใส่ไว้ตามที่ส่งมา
  for (const [k, v] of Object.entries(varOverride)) vars[k] ??= v;
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
    .filter((o) => (o.conditions ?? []).every((c) => checkCondition(ctx, actor, c, bindings)))
    .map((o) => ({ ...o, tags: (o.tags ?? []).map(sub) }));

  const prepared: PreparedEvent = {
    def, instance, actor, options: baseOptions, locked: new Map(), resist: new Map(), extraEffects: [], hits: [],
  };
  inject(ctx, prepared);
  applyWill(ctx, prepared);
  return prepared;
}

/** แรงต้านในใจ → ล็อกหรือฝืนใจ; ถ้าใจไม่ยอมทุกทาง ปลดตัวที่ต้านน้อยสุดให้เลือกแบบฝืนใจ (event ต้องจบได้เสมอ) */
function applyWill(ctx: Ctx, p: PreparedEvent): void {
  const W = ctx.content.balance.will;
  const who = (role: string) => {
    const id = p.instance.bindings[role];
    return id ? ctx.state.characters[id] : undefined;
  };
  for (const o of p.options) {
    const r = o.resist && resistance(ctx, p.actor, o.resist, who);
    if (!r || r.value < W.strainAt) continue;
    p.resist.set(o.id, r);
    if (r.value >= W.lockAt && !p.locked.has(o.id)) p.locked.set(o.id, 'will');
  }
  if (p.options.every((o) => p.locked.has(o.id))) {
    const willLocked = p.options.filter((o) => p.locked.get(o.id) === 'will');
    const easiest = willLocked.sort((a, b) => (p.resist.get(a.id)?.value ?? 0) - (p.resist.get(b.id)?.value ?? 0))[0];
    if (easiest) p.locked.delete(easiest.id);
  }
}

/** event ถัดไปที่ตัวเลือกพาไป (followUp) — role และตัวแปรชุดเดิม */
export function prepareFollowUp(ctx: Ctx, p: PreparedEvent, report: EventReport): PreparedEvent | null {
  if (!report.followUp || !ctx.content.events[report.followUp]) return null;
  return prepareEvent(ctx, report.followUp, p.instance.bindings, p.instance.vars);
}

function checkCondition(ctx: Ctx, ch: Character, c: Condition, bindings: Record<string, Character['id']>): boolean {
  switch (c.type) {
    case 'age': {
      const a = ageOf(ctx, ch);
      return (c.min === undefined || a >= c.min) && (c.max === undefined || a <= c.max);
    }
    case 'capability':
      return capability(ctx, ch, c.capability) >= c.min;
    case 'estate':
      return c.in.includes(ch.social.estate);
    case 'hasRole':
      return !!bindings[c.role];
    case 'sex': {
      const who = c.role ? ctx.state.characters[bindings[c.role]!] : ch;
      return who?.sex === c.is;
    }
    case 'purse':
      return purse(ctx, ch) >= c.min;
    case 'inCity':
      return warWhere(ctx, ch.id) === 'city';
    case 'warPrep':
      return (ctx.state.meta.war?.prep ?? 0) >= c.min;
    case 'householdHead':
      return !!ch.householdId && ctx.state.households[ch.householdId]?.headId === ch.id;
    case 'canPay': {
      const amount = c.what === 'sinsot' ? ch.betrothal?.sinsot : ch.eloped?.amount;
      return amount !== undefined && canPay(ctx, ch, amount);
    }
    case 'office': {
      const rank = officeRank(ctx, ch);
      return rank !== undefined && rank >= (c.minRank ?? 0) && rank <= (c.maxRank ?? Infinity);
    }
    case 'skill':
      return (ch.skills[c.skill] ?? 0) >= c.min;
    case 'stress':
      return ch.stress >= (c.min ?? 0) && ch.stress <= (c.max ?? 1);
    case 'seen': {
      const other = c.withRole ? bindings[c.withRole] : undefined;
      if (c.withRole && !other) return false;
      const n = ch.seen?.[`${c.event}${c.option ? `.${c.option}` : ''}${other ? `@${other}` : ''}`] ?? 0;
      return n >= (c.min ?? 0) && n <= (c.max ?? Infinity);
    }
  }
}

/** trigger.requires ของ event นี้ผ่านไหม เมื่อได้คนครบทุก role แล้ว */
export function requirementsMet(ctx: Ctx, def: GameEventDef, actor: Character, bindings: Record<string, Character['id']>): boolean {
  return (def.trigger.requires ?? []).every((c) => checkCondition(ctx, actor, c, bindings));
}

/** จดว่าเลือกอะไรกับใคร (Character.seen) — ไม่ลบทิ้งเหมือน eventLog จึงใช้ทำ event ครั้งเดียวได้ */
function recordSeen(p: PreparedEvent, optionId: string): void {
  const seen = (p.actor.seen ??= {});
  const base = [p.def.id, `${p.def.id}.${optionId}`];
  const others = Object.entries(p.instance.bindings).filter(([r]) => r !== 'actor').map(([, id]) => id);
  for (const k of [...base, ...base.flatMap((b) => others.map((id) => `${b}@${id}`))]) seen[k] = (seen[k] ?? 0) + 1;
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
  // ทอยครั้งเดียวต่อปมต่อ event (ใช้ hit ที่แรงที่สุด) — ไม่ให้ชนทั้ง context และตัวเลือกแล้วได้ทอยสองรอบ
  const allHits = [...contextHits, ...optionHits];
  const strongest = new Map<Trait['id'], number>();
  for (const h of allHits) strongest.set(h.trait.id, Math.max(strongest.get(h.trait.id) ?? 0, h.strength));
  const woke = new Map<Trait['id'], boolean>();
  const awake = (h: TraitHit): boolean => {
    let ok = woke.get(h.trait.id);
    if (ok === undefined) {
      ok = !h.trait.latent || ctx.rng.chance(strongest.get(h.trait.id) ?? h.strength);
      if (ok) h.trait.latent = false;
      woke.set(h.trait.id, ok);
    }
    return ok;
  };
  p.hits = allHits.filter(awake);
  for (const h of p.hits) {
    if (h.trait.lastTriggeredDay !== day) h.trait.triggerCount++;
    h.trait.lastTriggeredDay = day;
  }

  const expanded = ctx.tags.expand(p.instance.resolvedTags);
  const apply = (ruleId: string, params: Record<string, string>) => {
    // กฎแต่ละข้อมีผลครั้งเดียวต่อ event — ปมหลายอันชนกฎเดียวกันไม่ซ้อน effect (เช่น stress +0.1 สองรอบ)
    if (p.instance.injectedRuleIds.includes(ruleId)) return;
    const rule = must(ctx.content.injectionRules.find((r) => r.id === ruleId), ruleId);
    p.instance.injectedRuleIds.push(ruleId);
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
  /** เลือกทั้งที่ใจต้าน */
  strained?: Resistance;
  followUp?: GameEventDef['id'];
  /** ชื่อที่ตั้งให้ใครสักคนใน event นี้ */
  named?: { characterId: Character['id']; name: string; byPlayer: boolean };
  /** บรรทัด log จาก effect (แต่งงานแล้วไปอยู่ที่ไหน) */
  notes: string[];
  /** ผลของตัวเลือกเสี่ยง — textKey คือบรรทัดที่บอกผู้เล่นว่าสำเร็จหรือพลาด */
  outcome?: { failed: boolean; textKey?: string };
}

/** input.name: ชื่อที่ผู้เล่นพิมพ์ สำหรับตัวเลือก input 'name' — ไม่ส่งมา = ใช้ชื่อที่ตั้งไว้ก่อน */
export function chooseOption(ctx: Ctx, p: PreparedEvent, optionId: string, input: { name?: string } = {}): EventReport {
  if (p.locked.has(optionId)) throw new Error(`option ${optionId} locked by ${p.locked.get(optionId)}`);
  const opt = must(p.options.find((o) => o.id === optionId), optionId);
  // ตรวจชื่อก่อนมี effect ใดๆ — ชื่อใช้ไม่ได้ต้องไม่ทำให้ event ครึ่งๆ กลางๆ
  const typedName = input.name === undefined ? undefined : cleanName(input.name);
  if (typedName === null) throw new Error('ชื่อต้องเป็นอักษรไทย 1–20 ตัว ไม่มีช่องว่าง');
  p.instance.optionId = optionId;
  recordHabit(ctx, p.actor, p, optionId);
  recordSeen(p, optionId);
  const report: EventReport = { optionId, wounds: [], trauma: [], notes: [] };
  const strain = p.resist.get(optionId);
  if (strain) {
    p.actor.stress = clamp01(p.actor.stress + strain.value * ctx.content.balance.will.stressPerResist);
    report.strained = strain;
  }
  const woundsByRole = new Map<string, { ids: WoundId[]; maxSeverity: number }>();
  const who = (role: string) => {
    const id = p.instance.bindings[role];
    return id ? ctx.state.characters[id] : undefined;
  };
  let effects = opt.effects;
  if (opt.risk) {
    const failed = ctx.rng.chance(riskChance(ctx, p.actor, opt.risk, who));
    report.outcome = { failed, textKey: failed ? opt.risk.fail.textKey : opt.risk.successKey };
    if (failed) effects = opt.risk.fail.effects;
  } else if (opt.replyKey) {
    report.outcome = { failed: false, textKey: opt.replyKey };
  }

  for (const e of [...effects, ...p.extraEffects]) {
    if (e.op === 'followUp') {
      if (!report.followUp && ctx.rng.chance(e.chance)) report.followUp = e.event;
      continue;
    }
    if (e.op === 'legend') {
      report.notes.push(...applyLegendTruth(ctx, p.actor, p.instance.vars['legend'] as string | undefined, e.action));
      continue;
    }
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
      case 'bond': {
        const other = who(e.toward);
        if (!other) break;
        if (e.affection) adjustBond(ctx, ch, other, 'affection', e.affection);
        if (e.awe) adjustBond(ctx, ch, other, 'awe', e.awe);
        break;
      }
      case 'skill':
        ch.skills[e.skill] = Math.min(100, Math.max(0, (ch.skills[e.skill] ?? 0) + e.delta));
        break;
      case 'merit':
        ch.merit += e.delta;
        break;
      case 'topknot':
        report.notes.push(markTopknot(ctx, ch));
        break;
      case 'nurse': {
        const other = who(e.toward);
        if (other) report.notes.push(...markNursing(ctx, ch, other, e.neglected));
        break;
      }
      case 'kill': {
        if ((!ch.local && !e.allowKin) || !isAlive(ch)) break;
        if (e.chance !== undefined && !ctx.rng.chance(e.chance)) break;
        markDead(ctx, ch, e.cause);
        report.notes.push(`${ch.name}ตายแล้ว`);
        break;
      }
      case 'plague':
        ctx.state.meta.plague = { year: yearOf(ctx, ctx.state.meta.day) + 1, kind: e.kind, householdId: ch.householdId ?? null };
        break;
      case 'inoculate':
        ch.hadSmallpox = true;
        break;
      case 'treat': {
        for (const wid of ch.woundIds) {
          const w = ctx.state.wounds[wid];
          if (!w || (w.stage !== 'infected' && w.stage !== 'festering')) continue;
          w.treatment = { quality: Math.max(w.treatment?.quality ?? 0, e.quality), by: null, remedy: null };
        }
        break;
      }
      case 'takeWife': {
        const other = who(e.with);
        if (other) report.notes.push(takeMinorWife(ctx, ch, other));
        break;
      }
      case 'divorce': {
        const other = who(e.with);
        if (other) report.notes.push(...divorce(ctx, ch, other));
        break;
      }
      case 'ordain':
        ch.ordainedYear = yearOf(ctx, ctx.state.meta.day);
        ch.skills['literacy'] = Math.max(ch.skills['literacy'] ?? 0, ctx.content.balance.ordination.literacy);
        report.notes.push(`${ch.name}เข้าพิธีอุปสมบท เล่าเรียนหนังสือกับพระอาจารย์ที่วัด — อ่านออกเขียนได้`);
        break;
      case 'intent': {
        // ความตั้งใจที่ role ทำอยู่ (คนละไม่เกินหนึ่ง) — ไม่มีแล้ว (เพิ่งจบ) ก็ไม่ต้องทำอะไร
        const i = Object.values(ctx.state.intents).find((x) => x.actorId === ch.id);
        if (!i) break;
        if (e.end) {
          delete ctx.state.intents[i.id];
          break;
        }
        if (e.progress) i.progress = clamp01(i.progress + e.progress);
        if (e.odds) i.bonus += e.odds;
        break;
      }
      case 'relation': {
        const other = who(e.toward);
        if (!other) break;
        const id = `${ch.id}|${other.id}|${e.kind}`;
        const prev = ctx.state.relations[id];
        const cur = prev?.strength ?? 0;
        const next = Math.max(-1, Math.min(1, Math.max(cur + (e.delta ?? 0), e.atLeast ?? -1)));
        ctx.state.relations[id] = { id, from: ch.id, to: other.id, kind: e.kind, strength: next, sinceDay: prev?.sinceDay ?? ctx.state.meta.day };
        break;
      }
      case 'marry': {
        const other = who(e.with);
        // event ค้างอยู่นานจนมีคนแต่งงานไปก่อน → ไม่แต่งซ้อน
        if (!other || other.deathDay !== null || livingSpouse(ctx, ch) || livingSpouse(ctx, other) || other.local?.wed) break;
        // สินสอดตามแบบคู่ NPC: ฝ่ายชายในตระกูลจ่ายออก ฝ่ายหญิงในตระกูลได้เข้าเรือน
        const sinsot = settleNpcSinsot(ctx, ch, other);
        report.notes.push(`${wed(ctx, ch, other)}${sinsot ? ` (สินสอด ${sinsot} ตำลึง)` : ''}`);
        break;
      }
      case 'career':
        report.notes.push(...applyCareer(ctx, ch, e.action, e.dept));
        break;
      case 'chore':
        report.notes.push(...applyChore(ctx, ch, e.action, p.instance.vars, e.teacher ? who(e.teacher) : undefined, e.factor));
        break;
      case 'favor':
        adjustFavor(ch, e.delta);
        break;
      case 'wealth': {
        // ปรับไหมตามบรรดาศักดิ์ (perSakdina × ศักดินา) — จ่ายไม่ไหวก็จ่ายเท่าที่มี เงินไม่ติดลบ
        const d = (e.delta ?? 0) + (e.perSakdina ?? 0) * ch.social.sakdina;
        if (d >= 0) ch.social.wealth += d;
        else spend(ctx, ch, -d); // เงินตัวเองไม่พอ ใช้เงินในเรือน (ผัว/เมีย พ่อแม่)
        break;
      }
      case 'marriage': {
        const other = who(e.with);
        if (!other) break;
        const r = applyMarriageStep(ctx, e.step, ch, other);
        report.notes.push(...r.notes);
        // ผู้ใหญ่ฝ่ายหญิงไม่ยอม → event ถัดไปใช้ role ชุดเดิม (prepareFollowUp)
        if (r.followUp && !report.followUp) report.followUp = r.followUp;
        break;
      }
      case 'name': {
        const byPlayer = e.by === 'input';
        const name = byPlayer ? typedName ?? ch.name : pickNameFor(ctx, ch);
        renameCharacter(ctx, ch, name);
        if (byPlayer) rememberCustomName(ctx, name, ch.sex);
        report.named = { characterId: ch.id, name, byPlayer };
        break;
      }
      case 'war':
        if (e.action === 'prep') ctx.state.meta.war = { ...ctx.state.meta.war, prep: (ctx.state.meta.war?.prep ?? 0) + e.delta };
        else if (e.action === 'bury') report.notes.push(...buryValuables(ctx, ch, e.fraction));
        else if (e.action === 'stay') report.notes.push(...stayInCity(ctx, ch));
        else if (e.action === 'taksin') report.notes.push(...joinTaksin(ctx, ch));
        else report.notes.push(...leaveCity(ctx, ch, e.dir, e.party));
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

/**
 * ความลับตำนานแตก — ผลของการตัดสินใจ (event family.legend_truth)
 * บารมีที่ได้จากการเสริมแต่งหายไปตามที่ตำนานคลาดจากความจริง (ตัวเลขของเกม)
 */
function applyLegendTruth(ctx: Ctx, teller: Character, legendId: string | undefined, action: 'reveal' | 'record' | 'keep'): string[] {
  const legend = legendId ? ctx.state.legends[legendId as LegendId] : undefined;
  if (!legend) return [];
  legend.truthToldYear = yearOf(ctx, ctx.state.meta.day);
  if (action === 'keep') return [`${teller.name}เก็บเรื่องจริงไว้คนเดียว ตำนานยังเล่ากันอย่างเดิม`];
  const dyn = ctx.state.dynasties[legend.dynastyId];
  const lost = Math.round(legend.divergence * 5 * 10) / 10;
  if (dyn) dyn.prestige = Math.max(0, dyn.prestige - lost);
  legend.current = structuredClone(legend.truth);
  legend.divergence = 0;
  if (action === 'record') legend.writtenRecord = true;
  return [
    `${teller.name}เล่าเรื่องจริงให้ลูกหลานฟัง${action === 'record' ? ' แล้วจดลงสมุดข่อยไว้' : ''} — บารมีตระกูล −${lost}`,
  ];
}

