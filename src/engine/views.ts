import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { CapabilityId, Character } from '../core/types';
import { DISTANCE_TH, familiarity, isSingle, knownLocals, localOrigin, relationStrength, tradeOf } from '../systems/acquaintance';
import { capability } from '../systems/body';
import type { PreparedEvent } from '../systems/events';
import { livingChildren, livingParents, livingSpouse } from '../systems/factory';
import { activeIntent, intentStatus, planIntent, targetProblem, type OddsFactor } from '../systems/intent';
import { marriageHint, marriageStatus } from '../systems/marriage';
import { renderLegend } from '../systems/legend';
import { describeTrait } from '../systems/traits';
import type { CharacterView, DynastyView, EventView, IntentPlanView, IntentStatusView, KnownPersonView, OddsFactorView } from './protocol';

// แปลง state → view model (plain data) ก่อนส่งข้ามเธรด

export type TextTable = Record<string, string>;

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

const CAPS: CapabilityId[] = ['manipulation.fine', 'manipulation.gross', 'mobility', 'sight'];

/** ข้อความจากตาราง text.th — ไม่มีคีย์ให้คืนค่าดิบ (เห็นชัดว่าลืมใส่คำแปล) */
const t = (text: TextTable, prefix: string, id: string) => text[`${prefix}.${id}`] ?? id;

/** UI ไม่ควรเห็นคีย์ภายใน ("noble", "finger.index.l", "manipulation.fine") — แปลงเป็นคำไทยที่นี่ */
export function playerView(ctx: Ctx, text: TextTable = {}): CharacterView {
  const ch = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const anatomy = ctx.content.anatomies[ch.anatomyId];
  const partLabel = (partDefId: string) => anatomy?.parts[partDefId]?.label.th ?? partDefId;
  const estateTag = `estate:${ch.social.estate}` as const;
  return {
    name: ch.name,
    age: ageOf(ctx, ch),
    year: yearOf(ctx, ctx.state.meta.day),
    estate: ctx.tags.def(estateTag) ? ctx.tags.label(estateTag) : ch.social.estate,
    title: ch.social.title,
    wealth: Math.round(ch.social.wealth),
    traits: ch.traitIds.map((id) => ctx.state.traits[id]).filter((t) => !!t && !t.latent).map((t) => describeTrait(ctx, t!)),
    scars: ch.bodyPartIds.flatMap((pid) => {
      const p = ctx.state.bodyParts[pid];
      if (!p) return [];
      const label = partLabel(p.partDefId);
      // แผลชนิดเดียวกันที่อวัยวะเดียวกันรวมเป็นบรรทัดเดียว "×N"
      const counts = new Map<string, number>();
      for (const s of p.scars) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
      const lines = [...counts].map(([kind, n]) => `แผลเป็น(${t(text, 'scar.kind', kind)})ที่${label}${n > 1 ? ` ×${n}` : ''}`);
      return p.status === 'missing' ? [...lines, `สูญเสีย${label}`] : lines;
    }),
    wounds: ch.woundIds.map((id) => ctx.state.wounds[id]).filter((w) => !!w).map((w) => `${partLabel(w!.partDefId)}: ${t(text, 'wound.stage', w!.stage)}`),
    // คีย์เป็นคำไทยเพราะ UI แสดงคีย์ตรงๆ
    capabilities: Object.fromEntries(CAPS.map((c) => [t(text, 'capability', c), Math.round(capability(ctx, ch, c) * 100) / 100])),
    ...lifestyleView(ctx, ch, text),
    marriage: marriageStatus(ctx, ch),
  };
}

// ---------------- คนที่รู้จัก / ความตั้งใจ ----------------

const pct = (x: number) => Math.round(x * 100);
const money = (x: number) => (Math.round(x * 10) / 10).toString();

function factorViews(text: TextTable, factors: OddsFactor[], target: Character): OddsFactorView[] {
  return factors.map((f) => ({ label: fill(text[`intent.factor.${f.key}`] ?? f.key, { target: target.name }), value: pct(f.value) }));
}

/** ชีวิตประจำวันจะเปลี่ยนอย่างไรถ้าทำแบบนี้ (labor = สัดส่วนแรงงานที่หายจากเรือน) */
function lifestyleText(labor: number, monthlyCost: number, target: Character, learn: string | null): string {
  const parts =
    labor <= 0 ? ['ไม่กระทบงานที่บ้าน']
      : labor < 1 ? [`แบ่งเวลาจากงานที่บ้านราว ${pct(labor)}%`, `จ้างคนแทนเดือนละ ${money(monthlyCost)} ตำลึง`, 'พ่อแม่อาจบ่น']
        : [`ย้ายไปอยู่ใกล้บ้าน${target.name}`, `เรือนขาดแรงงานทั้งคน จ้างคนแทนเดือนละ ${money(monthlyCost)} ตำลึง`, 'ไม่ได้อยู่กับพ่อแม่'];
  if (labor > 0 && learn) parts.push(`ได้ฝึกวิชาบ้าน${learn}`);
  return parts.join(' · ');
}

function lifestyleView(ctx: Ctx, ch: Character, text: TextTable): { lifestyle: string; intent: IntentStatusView | null } {
  const st = intentStatus(ctx, ch);
  const host = ch.service && ctx.state.characters[ch.service.hostId];
  // ไปช่วยงานบ้านพ่อตาแม่ยายชดใช้สินสอด/ค่าน้ำนม — กินแรงงานเหมือนความตั้งใจที่ต้องไปช่วยงานบ้านคนอื่น
  const serving = ch.service && host
    ? `แบ่งเวลาไปช่วยงานบ้านพ่อแม่ของ${host.name}ราว ${pct(ch.service.labor)}% · จ้างคนแทนเดือนละ ${money(ch.service.labor * ctx.content.balance.intent.laborValue[ch.social.estate])} ตำลึง`
    : null;
  if (!st) return { lifestyle: serving ?? (ageOf(ctx, ch) < 6 ? 'ยังเล็ก อยู่ในความดูแลของผู้ใหญ่' : 'อยู่บ้าน ช่วยงานในเรือนตามปกติ'), intent: null };
  const learn = st.approach.learnTrade ? tradeOf(ctx, st.target)?.label.th ?? null : null;
  return {
    lifestyle: st.labor > 0 ? lifestyleText(st.labor, st.monthlyCost, st.target, learn) : 'อยู่บ้าน ช่วยงานในเรือนตามปกติ',
    intent: {
      title: `${text[st.def.textKey] ?? st.def.id}${st.target.name}`,
      approach: fill(text[st.approach.textKey] ?? st.approach.id, { target: st.target.name }),
      progress: pct(st.intent.progress),
      monthsLeft: st.monthsLeft,
      odds: pct(st.odds),
      factors: factorViews(text, st.factors, st.target),
    },
  };
}

/** ญาติเรียกกันว่าอะไร (มองจากผู้เล่น) */
function kinTies(ctx: Ctx, me: Character): Map<Character, string> {
  const out = new Map<Character, string>();
  const older = (c: Character) => c.birthDay < me.birthDay;
  for (const p of livingParents(ctx, me)) {
    out.set(p, p.sex === 'm' ? 'พ่อ' : 'แม่');
    for (const sib of livingChildren(ctx, p)) {
      if (sib === me || out.has(sib)) continue;
      out.set(sib, `${older(sib) ? 'พี่' : 'น้อง'}${sib.sex === 'm' ? 'ชาย' : 'สาว'}`);
    }
  }
  const spouse = livingSpouse(ctx, me);
  if (spouse) out.set(spouse, me.sex === 'm' ? 'ภรรยา' : 'สามี');
  for (const kid of livingChildren(ctx, me)) {
    out.set(kid, kid.sex === 'm' ? 'ลูกชาย' : 'ลูกสาว');
    for (const g of livingChildren(ctx, kid)) out.set(g, g.sex === 'm' ? 'หลานชาย' : 'หลานสาว');
  }
  return out;
}

function closeness(f: number): string {
  return f < 0.25 ? 'รู้จักแค่หน้า' : f < 0.55 ? 'คุ้นเคย' : 'สนิทสนม';
}

export function knownView(ctx: Ctx, text: TextTable): KnownPersonView[] {
  const me = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const current = activeIntent(ctx, me.id);
  const kin: KnownPersonView[] = [...kinTies(ctx, me)].map(([c, tie]) => ({
    id: c.id, name: c.name, age: ageOf(ctx, c), tie, kin: true,
    detail: c.householdId && c.householdId === me.householdId ? 'อยู่เรือนเดียวกัน' : 'อยู่คนละเรือน',
    actions: [], focus: false,
  }));
  const locals: KnownPersonView[] = knownLocals(ctx, me)
    .sort((a, b) => familiarity(ctx, me.id, b.id) - familiarity(ctx, me.id, a.id))
    .map((c) => {
      const age = ageOf(ctx, c);
      const status = c.local!.wed ? 'ออกเรือนแล้ว' : age >= 15 && isSingle(ctx, c) ? 'ยังไม่ออกเรือน' : null;
      return {
        id: c.id, name: c.name, age,
        tie: me.betrothal?.toId === c.id ? 'คู่หมั้น' : relationStrength(ctx, me.id, c.id, 'friend') >= 0.5 ? 'เพื่อนสนิท' : 'คนรู้จัก',
        kin: false,
        detail: [localOrigin(ctx, c), DISTANCE_TH[c.local!.distance], status, closeness(familiarity(ctx, me.id, c.id))].filter(Boolean).join(' · '),
        actions: Object.values(ctx.content.intents)
          // สิ่งที่กำลังทำกับคนนี้อยู่แล้วไม่ต้องมีปุ่มซ้ำ (เลิก/ดูความคืบหน้าที่แผงตัวละคร)
          .filter((def) => !targetProblem(ctx, def, me, c) && !(current?.targetId === c.id && current.kind === def.id))
          .map((def) => ({ kind: def.id, label: text[def.textKey] ?? def.id })),
        focus: c.id === current?.targetId || c.id === me.betrothal?.toId,
      };
    });
  return [...kin, ...locals];
}

export function intentPlanView(ctx: Ctx, text: TextTable, targetId: string, kind: string): IntentPlanView {
  const me = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const target = must(ctx.state.characters[targetId as Character['id']], 'คนนี้');
  const def = must(ctx.content.intents[kind], kind);
  const problem = targetProblem(ctx, def, me, target);
  if (problem) throw new Error(`ตอนนี้${text[def.textKey] ?? def.id}${target.name}ไม่ได้`);
  const cur = intentStatus(ctx, me);
  const trade = tradeOf(ctx, target)?.label.th ?? null;
  return {
    kind, targetId,
    title: `${text[def.textKey] ?? def.id}${target.name}`,
    text: fill(text[`${def.textKey}.desc`] ?? '', { target: target.name }),
    replaces: cur ? `จะเลิก${text[cur.def.textKey] ?? cur.def.id}${cur.target.name}ที่ทำอยู่ (คืบหน้า ${pct(cur.intent.progress)}%)` : undefined,
    approaches: planIntent(ctx, kind, me, target).map((p) => ({
      id: p.def.id,
      label: fill(text[p.def.textKey] ?? p.def.id, { target: target.name }),
      odds: pct(p.odds),
      months: p.months,
      factors: factorViews(text, p.factors, target),
      lifestyle: [lifestyleText(p.labor, p.monthlyCost, target, p.def.learnTrade ? trade : null), p.def.cost ? `ใช้เงิน ${p.def.cost} ตำลึง` : '']
        .filter(Boolean).join(' · '),
      unavailable: p.unavailable ? text[`intent.unavailable.${p.unavailable}`] ?? p.unavailable : undefined,
    })),
  };
}

export function dynastyView(ctx: Ctx): DynastyView {
  const dyn = must(ctx.state.dynasties[ctx.state.meta.playerDynastyId], 'dynasty');
  return {
    name: dyn.name,
    prestige: Math.round(dyn.prestige * 10) / 10,
    taboos: dyn.taboos.map((t) => `${t.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(t.target)} (${Math.round(t.strength * 100)}%)`),
    legends: dyn.legendIds.map((id) => ctx.state.legends[id]).filter((l) => !!l).map((l) => renderLegend(ctx, l!, 'current')),
    livingMembers: Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c)).length,
    familyNodes: Object.keys(ctx.state.familyNodes).length,
  };
}

/** ช่องพิมพ์ชื่อของ event ตั้งชื่อ — เด็กอยู่ใน role 'child' */
function nameInput(ctx: Ctx, p: PreparedEvent): { default: string; label: string } | undefined {
  const kid = p.instance.bindings.child ? ctx.state.characters[p.instance.bindings.child] : undefined;
  if (!kid) return undefined;
  return { default: kid.name, label: `ชื่อ${kid.sex === 'm' ? 'เด็กชาย' : 'เด็กหญิง'}` };
}

/** ตัวเลือกที่เป็นขั้นตอนแต่งงาน → บอกราคาและโอกาสไว้ก่อนเลือก */
function optionHint(ctx: Ctx, p: PreparedEvent, effects: PreparedEvent['options'][number]['effects']): string | undefined {
  for (const e of effects) {
    if (e.op !== 'marriage') continue;
    const actor = ctx.state.characters[p.instance.bindings[e.role] ?? ('' as Character['id'])];
    const other = ctx.state.characters[p.instance.bindings[e.with] ?? ('' as Character['id'])];
    if (actor && other) return marriageHint(ctx, e.step, actor, other);
  }
  return undefined;
}

export function eventView(ctx: Ctx, p: PreparedEvent, text: TextTable): EventView {
  const vars: Record<string, string> = {};
  const actorNode = ctx.state.familyNodes[p.actor.familyNodeId];
  for (const [role, id] of Object.entries(p.instance.bindings)) {
    const ch = ctx.state.characters[id];
    // เรียกพ่อแม่ตามที่ลูกเรียก: "แม่แย้ม" ไม่ใช่ "แย้ม"
    const kin = ch && (ch.familyNodeId === actorNode?.motherId ? 'แม่' : ch.familyNodeId === actorNode?.fatherId ? 'พ่อ' : '');
    vars[role] = ch ? `${kin}${ch.name}` : role;
  }
  for (const [k, v] of Object.entries(p.instance.vars)) vars[k] = ctx.tags.label(v);
  const willNote = (id: string) => {
    const r = p.resist.get(id);
    if (!r) return undefined;
    const reason = fill(text[`will.reason.${r.reasonKey}`] ?? r.reasonKey, { who: r.role ? vars[r.role] ?? r.role : '' });
    return fill(text[p.locked.get(id) === 'will' ? 'will.lock' : 'will.strain'] ?? '{reason}', { reason });
  };
  return {
    instanceId: p.instance.id,
    title: text[`${p.def.textKey}.title`] ?? p.def.id,
    text: fill(text[p.def.textKey] ?? p.def.textKey, vars),
    options: p.options.map((o) => ({
      id: o.id,
      text: fill(text[o.textKey] ?? o.textKey, { ...vars, ...o.params }),
      locked: p.locked.has(o.id),
      injected: !!o.injectedBy,
      note: willNote(o.id),
      nameInput: o.input === 'name' ? nameInput(ctx, p) : undefined,
      hint: optionHint(ctx, p, o.effects),
    })),
    triggered: [...new Set(p.hits.map((h) => describeTrait(ctx, h.trait)))],
  };
}
