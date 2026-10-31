import { formatLunar, formatSolar } from '../core/calendar';
import { ageOf, isAlive, lunarOf, must, solarOf, yearOf, type Ctx } from '../core/ctx';
import type { CapabilityId, Character, FamilyNode, Item, Parentage, Personality, Trait } from '../core/types';
import { DISTANCE_TH, familiarity, isSingle, knownLocals, localOrigin, relationStrength, tradeOf } from '../systems/acquaintance';
import { capability } from '../systems/body';
import type { PreparedEvent } from '../systems/events';
import { displayName, livingChildren, livingParents, livingSpouse, singleLabel } from '../systems/factory';
import { activeIntent, intentStatus, planIntent, targetProblem, type OddsFactor } from '../systems/intent';
import { careerHint, officeRank, officeStatus } from '../systems/career';
import { livingWives } from '../systems/wives';
import { estateHeirs, heirCandidates, PARENTAGE_TH, RELATION_TH } from '../systems/handover';
import { choreSkills } from '../systems/chores';
import { marriageHint, marriageStatus } from '../systems/marriage';
import { renderLegend } from '../systems/legend';
import { describeTrait } from '../systems/traits';
import type {
  CharacterView, DynastyView, EndingView, EndReason, EventView, InspectView, IntentPlanView, IntentStatusView, KnownPersonView,
  OddsFactorView, TreeView,
} from './protocol';

// แปลง state → view model (plain data) ก่อนส่งข้ามเธรด

export type TextTable = Record<string, string>;

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

const CAPS: CapabilityId[] = ['manipulation.fine', 'manipulation.gross', 'mobility', 'sight'];

/** ข้อความจากตาราง text.th — ไม่มีคีย์ให้คืนค่าดิบ (เห็นชัดว่าลืมใส่คำแปล) */
const t = (text: TextTable, prefix: string, id: string) => text[`${prefix}.${id}`] ?? id;

const estateLabel = (ctx: Ctx, estate: string) => {
  const tag = `estate:${estate}` as const;
  return ctx.tags.def(tag) ? ctx.tags.label(tag) : estate;
};

const partLabelOf = (ctx: Ctx, anatomyId: string) => (partDefId: string) =>
  ctx.content.anatomies[anatomyId]?.parts[partDefId]?.label.th ?? partDefId;

/** แผลชนิดเดียวกันที่อวัยวะเดียวกันรวมเป็นบรรทัดเดียว "×N" */
function scarLines(ctx: Ctx, ch: Character, text: TextTable): string[] {
  const partLabel = partLabelOf(ctx, ch.anatomyId);
  return ch.bodyPartIds.flatMap((pid) => {
    const p = ctx.state.bodyParts[pid];
    if (!p) return [];
    const label = partLabel(p.partDefId);
    const counts = new Map<string, number>();
    for (const s of p.scars) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
    const lines = [...counts].map(([kind, n]) => `แผลเป็น(${t(text, 'scar.kind', kind)})ที่${label}${n > 1 ? ` ×${n}` : ''}`);
    return p.status === 'missing' ? [...lines, `สูญเสีย${label}`] : lines;
  });
}

function woundLines(ctx: Ctx, ch: Character, text: TextTable): string[] {
  const partLabel = partLabelOf(ctx, ch.anatomyId);
  return ch.woundIds.map((id) => ctx.state.wounds[id]).filter((w) => !!w).map((w) => `${partLabel(w!.partDefId)}: ${t(text, 'wound.stage', w!.stage)}`);
}

/** UI ไม่ควรเห็นคีย์ภายใน ("noble", "finger.index.l", "manipulation.fine") — แปลงเป็นคำไทยที่นี่ */
export function playerView(ctx: Ctx, text: TextTable = {}): CharacterView {
  const ch = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  return {
    name: ch.name,
    nodeId: ch.familyNodeId,
    age: ageOf(ctx, ch),
    year: yearOf(ctx, ctx.state.meta.day),
    solar: formatSolar(solarOf(ctx)),
    lunar: formatLunar(lunarOf(ctx)),
    estate: estateLabel(ctx, ch.social.estate),
    title: ch.social.title,
    wealth: Math.round(ch.social.wealth),
    traits: ch.traitIds.map((id) => ctx.state.traits[id]).filter((t) => !!t && !t.latent).map((t) => describeTrait(ctx, t!)),
    scars: scarLines(ctx, ch, text),
    wounds: woundLines(ctx, ch, text),
    // คีย์เป็นคำไทยเพราะ UI แสดงคีย์ตรงๆ
    capabilities: Object.fromEntries(CAPS.map((c) => [t(text, 'capability', c), Math.round(capability(ctx, ch, c) * 100) / 100])),
    ...lifestyleView(ctx, ch, text),
    marriage: marriageStatus(ctx, ch),
    office: officeStatus(ctx, ch),
    craftSkills: choreSkills(ctx, ch),
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
  const onDuty = ch.office
    ? `เข้าเวรรับราชการ${officeRank(ctx, ch) === 0 ? 'ในวัง' : ''} ไม่ได้อยู่ช่วยงานบ้านราว ${pct(ctx.content.balance.career.dutyLabor)}%`
    : null;
  if (!st) {
    const fallback = ageOf(ctx, ch) < 6 ? 'ยังเล็ก อยู่ในความดูแลของผู้ใหญ่' : 'อยู่บ้าน ช่วยงานในเรือนตามปกติ';
    return { lifestyle: [serving, onDuty].filter(Boolean).join(' · ') || fallback, intent: null };
  }
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
  const grand = new Map<Character, string>();
  for (const p of livingParents(ctx, me)) {
    out.set(p, p.sex === 'm' ? 'พ่อ' : 'แม่');
    for (const sib of livingChildren(ctx, p)) {
      if (sib === me || out.has(sib)) continue;
      out.set(sib, `${older(sib) ? 'พี่' : 'น้อง'}${sib.sex === 'm' ? 'ชาย' : 'สาว'}`);
      // ลูกของพี่น้อง — สำคัญเมื่อพี่น้องขึ้นสืบต่อแทนพี่/น้องที่ตาย ลูกของผู้ตายกลายเป็นหลาน
      for (const n of livingChildren(ctx, sib)) out.set(n, n.sex === 'm' ? 'หลานชาย' : 'หลานสาว');
    }
    // ฝ่ายพ่อ: ปู่ ย่า · ฝ่ายแม่: ตา ยาย
    for (const g of livingParents(ctx, p)) grand.set(g, p.sex === 'm' ? (g.sex === 'm' ? 'ปู่' : 'ย่า') : g.sex === 'm' ? 'ตา' : 'ยาย');
  }
  for (const [g, tie] of grand) out.set(g, tie);
  const spouse = livingSpouse(ctx, me);
  if (spouse) out.set(spouse, me.sex === 'm' ? 'ภรรยา' : 'สามี');
  if (me.sex === 'm') for (const w of livingWives(ctx, me)) if (w.wifeRank === 'minor') out.set(w, 'เมียน้อย');
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
    id: c.id, nodeId: c.familyNodeId, name: c.name, age: ageOf(ctx, c), tie, kin: true,
    detail: c.householdId && c.householdId === me.householdId ? 'อยู่เรือนเดียวกัน' : 'อยู่คนละเรือน',
    actions: [], focus: false,
  }));
  const locals: KnownPersonView[] = knownLocals(ctx, me)
    .sort((a, b) => familiarity(ctx, me.id, b.id) - familiarity(ctx, me.id, a.id))
    .map((c) => {
      const age = ageOf(ctx, c);
      const status = c.local!.wed ? 'ออกเรือนแล้ว' : isSingle(ctx, c) ? singleLabel(ctx, c.sex, age) : null;
      return {
        id: c.id, nodeId: c.familyNodeId, name: c.name, age,
        tie: me.betrothal?.toId === c.id ? 'คู่หมั้น' : me.eloped?.withId === c.id ? 'อยู่ด้วยกัน (ยังไม่ได้แต่ง)'
          : relationStrength(ctx, me.id, c.id, 'friend') >= 0.5 ? 'เพื่อนสนิท' : 'คนรู้จัก',
        kin: false,
        detail: [localOrigin(ctx, c), DISTANCE_TH[c.local!.distance], status, closeness(familiarity(ctx, me.id, c.id))].filter(Boolean).join(' · '),
        actions: Object.values(ctx.content.intents)
          // สิ่งที่กำลังทำกับคนนี้อยู่แล้วไม่ต้องมีปุ่มซ้ำ (เลิก/ดูความคืบหน้าที่แผงตัวละคร)
          .filter((def) => !targetProblem(ctx, def, me, c) && !(current?.targetId === c.id && current.kind === def.id))
          .map((def) => ({ kind: def.id, label: text[def.textKey] ?? def.id })),
        focus: c.id === current?.targetId || c.id === me.betrothal?.toId || c.id === me.eloped?.withId,
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

/** ผลคร่าวๆ ของตัวเลือกในราชการ: เงิน ความโปรดปราน บุญบาป — ไม่บอกตัวเลขความโปรดปราน (เดาใจนายได้แค่คร่าวๆ) */
function effectHint(ctx: Ctx, p: PreparedEvent, effects: PreparedEvent['options'][number]['effects']): string | undefined {
  const parts: string[] = [];
  for (const e of effects) {
    if (e.op === 'followUp') {
      parts.push('อาจมีคนรู้');
      continue;
    }
    const ch = ctx.state.characters[p.instance.bindings[e.role] ?? ('' as Character['id'])];
    if (e.op === 'wealth' && ch) {
      const d = Math.round((e.delta ?? 0) + (e.perSakdina ?? 0) * ch.social.sakdina);
      if (d) parts.push(`${ch === p.actor ? '' : ch.name}${d > 0 ? 'ได้' : 'เสีย'} ${Math.abs(d)} ตำลึง`);
    }
    if (e.op === 'favor' && Math.abs(e.delta) >= 0.05) parts.push(e.delta > 0 ? 'เป็นที่พอใจ' : 'ถูกมองไม่ดี');
    if (e.op === 'merit' && e.delta) parts.push(e.delta > 0 ? 'ได้บุญ' : 'เป็นบาป');
  }
  return parts.length ? parts.join(' · ') : undefined;
}

/** ตัวเลือกที่เป็นขั้นตอนแต่งงาน → บอกราคาและโอกาสไว้ก่อนเลือก */
function optionHint(ctx: Ctx, p: PreparedEvent, effects: PreparedEvent['options'][number]['effects']): string | undefined {
  for (const e of effects) {
    if (e.op === 'career') {
      const ch = ctx.state.characters[p.instance.bindings[e.role] ?? ('' as Character['id'])];
      if (ch) return careerHint(ctx, ch, e.action);
    }
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
  // ตัวแปรส่วนใหญ่เป็น tag → ชื่อไทย; บาง event ส่งข้อความมาตรงๆ (ตำนานที่เล่ากับเรื่องจริง)
  for (const [k, v] of Object.entries(p.instance.vars)) vars[k] = ctx.tags.def(v) ? ctx.tags.label(v) : v;
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
      hint: optionHint(ctx, p, o.effects) ?? (p.def.id.startsWith('career.') ? effectHint(ctx, p, o.effects) : undefined),
    })),
    triggered: [...new Set(p.hits.map((h) => describeTrait(ctx, h.trait)))],
  };
}

// ---------------------------------------------------------------------------
// ผังตระกูล + หน้าดูตัวละคร — ใช้เล่นทดสอบ/debug ระบบ จึงโชว์ข้อมูลภายในมากกว่าหน้าตัวละครปกติ (เช่น ปมแฝง นิสัยเป็นตัวเลข)
// ---------------------------------------------------------------------------

/** สถานะแม่ในผัง — ภรรยาหลวง/ไม่ทราบ เป็นค่าปกติ ไม่ต้องแสดง */
const parentageLabel = (p: Parentage): string | null =>
  p === 'principal_wife' || p === 'unknown' ? null : PARENTAGE_TH[p];

const PERSONALITY_TH: Record<keyof Personality, string> = {
  neuroticism: 'หวั่นไหว',
  imagination: 'จินตนาการ',
  boldness: 'ใจกล้า',
  agreeableness: 'ว่านอนสอนง่าย',
  piety: 'ศรัทธา/ถือโชคลาง',
  pride: 'ทะนงตัว',
  resilience: 'ใจฟื้นเร็ว',
};

const ITEM_KIND_TH: Record<Item['kind'], string> = {
  land: 'ที่ดิน',
  house: 'เรือน',
  gold: 'ทอง',
  heirloom: 'ของตกทอด',
  manual: 'ตำรา',
};

const AWARENESS_TH: Record<Trait['awareness'], string> = {
  knows_cause: 'รู้ต้นเหตุ',
  misremembers: 'จำต้นเหตุผิด',
  unknown: 'ไม่รู้ต้นเหตุ',
};

export function treeView(ctx: Ctx): TreeView {
  const S = ctx.state;
  const dyn = must(S.dynasties[S.meta.playerDynastyId], 'dynasty');
  const founders = new Set<string>(Object.values(S.dynasties).map((d) => d.founderNodeId));
  // คนในตระกูลและคู่ครอง — คนนอกที่ผู้เล่นรู้จัก (เพื่อนบ้าน คนที่เกี้ยว) ก็มี node แต่ไม่อยู่ในผัง
  const member = (n: FamilyNode | undefined) => n?.dynastyId === dyn.id;
  const included = Object.values(S.familyNodes).filter((n) => member(n) || n.spouseIds.some((s) => member(S.familyNodes[s])));
  const ids = new Set<string>(included.map((n) => n.id));
  const inTree = (id: FamilyNode['id'] | null) => !!id && ids.has(id);
  const player = S.characters[S.meta.playerCharacterId];
  return {
    dynastyName: dyn.name,
    founderNodeId: dyn.founderNodeId,
    headNodeId: dyn.headNodeId,
    playerNodeId: player?.familyNodeId ?? null,
    nodes: included.map((n) => {
      const ch = n.characterId ? S.characters[n.characterId] : undefined;
      return {
        id: n.id,
        name: n.name,
        sex: n.sex,
        birthYear: n.birthYear,
        deathYear: n.deathYear ?? (ch?.deathDay != null ? yearOf(ctx, ch.deathDay) : null),
        alive: isAlive(ch),
        pruned: !ch,
        drifted: n.driftedYear !== undefined,
        // คู่ครองคนนอก = ไม่มีพ่อแม่ในผัง และไม่ใช่ต้นตระกูล
        marriedIn: !founders.has(n.id) && !inTree(n.fatherId) && !inTree(n.motherId),
        parentage: parentageLabel(n.parentage),
        fatherId: n.fatherId,
        motherId: n.motherId,
        spouseIds: n.spouseIds.filter(inTree),
        childIds: n.childIds.filter(inTree),
      };
    }),
    branches: dyn.branchSummaries.map((b) => ({ ...b })),
  };
}

export function inspectView(ctx: Ctx, nodeId: string, text: TextTable): InspectView {
  const S = ctx.state;
  const node = must(S.familyNodes[nodeId as FamilyNode['id']], `ไม่พบ ${nodeId} ในผังตระกูล`);
  const ch = node.characterId ? S.characters[node.characterId] : undefined;
  const nodeName = (id: FamilyNode['id'] | null) => {
    const n = id ? S.familyNodes[id] : undefined;
    return n ? displayName(ctx, n) : undefined;
  };
  const charName = (id: Character['id'] | null) => {
    const c = id ? S.characters[id] : undefined;
    return c ? displayName(ctx, c) : '?';
  };
  const deathYear = node.deathYear ?? (ch?.deathDay != null ? yearOf(ctx, ch.deathDay) : null);
  const cause = ch?.deathCause ?? node.summary?.causeOfDeath ?? null;
  const names = (ids: Array<FamilyNode['id'] | null>) => ids.map(nodeName).filter((x): x is string => !!x);
  const percent = (x: number) => `${pct(x)}%`;

  const facts: InspectView['facts'] = [];
  const sections: InspectView['sections'] = [];
  const section = (title: string, items: string[]) => {
    if (items.length) sections.push({ title, items });
  };

  // ข้อมูลในผัง — มีทุกคน รวมคนที่ถูก prune
  const dyn = node.dynastyId ? S.dynasties[node.dynastyId] : undefined;
  if (dyn?.founderNodeId === node.id) facts.push(['ต้นตระกูล', dyn.name]);
  if (dyn?.headNodeId === node.id) facts.push(['ตำแหน่ง', `ผู้นำตระกูล${dyn.name}`]);
  const parents = names([node.fatherId, node.motherId]);
  if (parents.length) facts.push(['บิดามารดา', parents.join(' · ')]);
  const parentage = parentageLabel(node.parentage);
  if (parentage) facts.push(['ฐานะในบ้าน', parentage]);
  facts.push(['รุ่นที่', String(node.generation)]);
  const spouses = names(node.spouseIds);
  if (spouses.length) facts.push(['คู่ครอง', spouses.join(', ')]);
  const kids = names(node.childIds);
  if (kids.length) facts.push(['บุตร', kids.join(', ')]);
  section('ตำนานที่เล่าถึงคนนี้', node.legendIds.map((id) => S.legends[id]).filter((l) => !!l).map((l) => renderLegend(ctx, l!, 'current')));

  if (!ch) {
    // ถูก prune แล้ว — เหลือแค่ snapshot ตอนตาย
    const sm = node.summary;
    if (sm) {
      facts.push(['ชนชั้น', estateLabel(ctx, sm.estate)]);
      if (sm.title) facts.push(['บรรดาศักดิ์', sm.title]);
      if (sm.merit) facts.push(['บุญ', sm.merit.toFixed(1)]);
      section('ปมที่คนยังจำได้', sm.notableTraits.map((x) =>
        `${ctx.content.traitKinds[x.kind]?.label.th ?? x.kind}${x.target ? ctx.tags.label(x.target) : ''}`));
      const partLabel = partLabelOf(ctx, 'human');
      const scars = new Map<string, number>();
      for (const x of sm.scars) {
        const line = `แผลเป็น(${t(text, 'scar.kind', x.kind)})ที่${partLabel(x.partDefId)}`;
        scars.set(line, (scars.get(line) ?? 0) + 1);
      }
      section('ร่องรอยบนร่างกาย', [...scars].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)));
    }
    return {
      nodeId: node.id, name: node.name, sex: node.sex,
      lifespan: `${node.birthYear}–${deathYear ?? '?'}`,
      status: node.driftedYear !== undefined
        ? `แยกไปอยู่ที่อื่นตั้งแต่ พ.ศ. ${node.driftedYear} — ขาดการติดต่อกับตระกูล`
        : `เหลือแต่ชื่อในผังตระกูล${cause ? ` · ${ctx.tags.label(cause)}` : ''}`,
      facts, sections,
    };
  }

  facts.unshift(['อายุ', `${ageOf(ctx, ch, ch.deathDay ?? S.meta.day)} ปี`], ['ชนชั้น', estateLabel(ctx, ch.social.estate)]);
  if (ch.social.title) facts.push(['บรรดาศักดิ์', ch.social.title]);
  if (ch.ordainedYear !== undefined) facts.push(['บวชเรียน', `พ.ศ. ${ch.ordainedYear}`]);
  const office = officeStatus(ctx, ch);
  if (office) facts.push(['ราชการ', office]);
  facts.push(['เงินสด', `${Math.round(ch.social.wealth)} ตำลึง${ch.social.debt ? ` · หนี้ ${Math.round(ch.social.debt)}` : ''}`]);
  facts.push(['ศักดินา', String(ch.social.sakdina)]);
  if (ch.social.patronId) facts.push(['มูลนาย', charName(ch.social.patronId)]);
  facts.push(['ความเครียด', percent(ch.stress)], ['บุญ', ch.merit.toFixed(1)], ['ถนัดมือ', ch.handedness === 'l' ? 'ซ้าย' : 'ขวา']);
  const hh = ch.householdId ? S.households[ch.householdId] : undefined;
  if (hh) facts.push(['เรือน', `${hh.headId === ch.id ? 'เป็นหัวเรือน' : `อยู่เรือนของ${charName(hh.headId)}`} · ${hh.memberIds.length} คน`]);

  section('ชีวิตคู่', marriageStatus(ctx, ch));
  section('ปมในใจ (รวมปมแฝง)', ch.traitIds.map((id) => S.traits[id]).filter((x): x is Trait => !!x).map((tr) => {
    const o = tr.origin;
    const from = o.type === 'experience' ? 'จากประสบการณ์'
      : o.type === 'social' ? `ซึมซับจาก${nodeName(o.fromNodeId) ?? 'ญาติ'}`
      : o.type === 'taboo' ? 'จากข้อห้ามตระกูล'
      : o.source === 'horoscope' ? 'ตามดวงชะตา' : 'นิสัยติดตัว';
    return `${describeTrait(ctx, tr)}${tr.latent ? ' (แฝง)' : ''} — ${from}, ${AWARENESS_TH[tr.awareness]}, กำเริบ ${tr.triggerCount} ครั้ง`;
  }));
  section('ร่างกาย', [
    ...scarLines(ctx, ch, text),
    ...woundLines(ctx, ch, text).map((w) => `แผลสด ${w}`),
    ...CAPS.map((c) => [c, capability(ctx, ch, c)] as const).filter(([, x]) => x < 1).map(([c, x]) => `${t(text, 'capability', c)} ${percent(x)}`),
  ]);
  section('นิสัย', (Object.keys(PERSONALITY_TH) as Array<keyof Personality>).map((k) => `${PERSONALITY_TH[k]} ${percent(ch.personality[k])}`));
  section('ทักษะ', Object.entries(ch.skills).filter(([, v]) => v > 0)
    .map(([k, v]) => `${ctx.content.chores.skillLabels[k] ?? t(text, 'skill', k)} ${Math.round(v)}`));
  section('ความสัมพันธ์', Object.values(S.relations).filter((r) => r.from === ch.id)
    .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
    .map((r) => `${RELATION_TH[r.kind]}กับ${charName(r.to)} (${percent(r.strength)})`));
  section('ทรัพย์สิน', Object.values(S.items).filter((i) => i.ownerCharacterId === ch.id)
    .map((i) => `${ctx.tags.label(i.tag)} (${ITEM_KIND_TH[i.kind]}) ${Math.round(i.value)} ตำลึง${i.hidden ? ' · ซ่อนไว้' : ''}`));
  section('ความทรงจำที่ฝังใจ', ch.memoryIds.map((id) => S.memories[id]).filter((m) => !!m && (m.formative || m.intensity >= 0.5)).map((m) => {
    const def = ctx.content.events[m!.eventDefId];
    const title = (def && text[`${def.textKey}.title`]) || m!.eventDefId;
    return `อายุ ${m!.ageAtTime}: ${title} (แรง ${percent(m!.intensity)}${m!.formative ? ', ฝังลึก' : ''})`;
  }));
  if (hh?.headId === ch.id) {
    section('กฎในเรือน', hh.rules.map((r) => `${r.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(r.target)} — ตั้งโดย${charName(r.imposedBy)}`));
  }

  return {
    nodeId: node.id, name: node.name, sex: node.sex,
    lifespan: `${node.birthYear}–${deathYear ?? ''}`,
    status: isAlive(ch) ? 'ยังมีชีวิต' : `ถึงแก่กรรม${cause ? ` (${ctx.tags.label(cause)})` : ''}`,
    facts, sections,
  };
}

// ---------------------------------------------------------------------------
// เลือกผู้สืบตระกูล (แสดงแบบ event) + หน้าสรุปตอนจบ
// ---------------------------------------------------------------------------

/** instanceId ของ "event" เลือกทายาท — worker แยกออกจาก event จริงด้วยค่านี้ */
export const HEIR_CHOICE_ID = 'heir-choice';
const MAX_HEIR_OPTIONS = 8;

/** ผู้สืบเกี่ยวเป็นอะไรกับผู้ตาย (ตามกลุ่มใน heirCandidates) */
function tieTo(ctx: Ctx, dead: Character, ch: Character): string {
  const N = ctx.state.familyNodes;
  const me = N[dead.familyNodeId];
  const n = N[ch.familyNodeId];
  const parents = (x: typeof n) => [x?.fatherId, x?.motherId].filter((id): id is FamilyNode['id'] => !!id);
  const sex = ch.sex === 'm' ? 'ชาย' : 'สาว';
  if (!me || !n) return 'ญาติ';
  if (parents(n).includes(me.id)) return `ลูก${sex}`;
  if (parents(n).some((p) => parents(N[p]).includes(me.id))) return `หลาน${sex}`;
  if (parents(n).some((p) => parents(me).includes(p))) return `${ch.birthDay < dead.birthDay ? 'พี่' : 'น้อง'}${sex}`;
  return `หลาน${sex} (ลูกของพี่น้อง)`;
}

/** ผู้เล่นตายและมีผู้สืบได้มากกว่าหนึ่งคน → ให้เลือก (ตัวเลือกแรก = ตามธรรมเนียม) */
export function heirChoiceView(ctx: Ctx): EventView | null {
  const dead = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!dead || isAlive(dead)) return null;
  const cands = heirCandidates(ctx, dead).slice(0, MAX_HEIR_OPTIONS);
  if (cands.length < 2) return null;
  const heirs = estateHeirs(ctx, dead);
  const totalW = heirs.reduce((a, h) => a + h.weight, 0);
  return {
    instanceId: HEIR_CHOICE_ID,
    title: 'ผู้สืบตระกูล',
    text: `${dead.name}ถึงแก่กรรมเมื่ออายุ ${ageOf(ctx, dead)} ปี — ใครจะเป็นผู้นำตระกูลและเป็นตัวละครที่เล่นต่อ ` +
      'มรดกแบ่งตามกฎหมายเหมือนเดิม ผู้สืบได้ตำแหน่ง ไม่ได้ทรัพย์ทั้งหมด',
    options: cands.map(({ ch }, i) => {
      const age = ageOf(ctx, ch);
      const share = heirs.find((h) => h.ch.id === ch.id);
      return {
        id: ch.id,
        text: `${ch.name} — ${tieTo(ctx, dead, ch)} อายุ ${age} ปี${age < 15 ? ' (ยังเด็ก)' : ''}`,
        locked: false,
        injected: false,
        hint: [i === 0 ? 'ตามธรรมเนียม' : '', share && totalW ? `ได้มรดกราว ${pct(share.weight / totalW)}%` : 'ไม่ได้ส่วนมรดก']
          .filter(Boolean).join(' · '),
      };
    }),
    triggered: [],
  };
}

export function endingView(ctx: Ctx, reason: EndReason, startYear: number): EndingView {
  const S = ctx.state;
  const dyn = must(S.dynasties[S.meta.playerDynastyId], 'dynasty');
  const year = yearOf(ctx, S.meta.day);
  const nodes = Object.values(S.familyNodes).filter((n) => n.dynastyId === dyn.id);
  const gens = nodes.map((n) => n.generation);
  const folded = dyn.branchSummaries.reduce((a, b) => a + b.memberCount, 0);
  const living = Object.values(S.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c)).length;
  const facts: EndingView['facts'] = [
    ['ช่วงเวลา', `พ.ศ. ${startYear}–${year} (${year - startYear} ปี)`],
    ['จำนวนรุ่น', String(gens.length ? Math.max(...gens) - Math.min(...gens) + 1 : 1)],
    ['คนในตระกูลตลอดเรื่อง', `${nodes.length + folded} คน${folded ? ` (รวมสายที่ยุบแล้ว ${folded} คน)` : ''}`],
    ['ยังมีชีวิต', `${living} คน`],
    ['บารมีตระกูล', String(Math.round(dyn.prestige * 10) / 10)],
  ];
  const sections: EndingView['sections'] = [];
  const heads = dyn.headHistory ?? [];
  if (heads.length) sections.push({ title: 'ผู้นำตระกูลแต่ละช่วง', items: heads.map((h) => `พ.ศ. ${h.fromYear} ${h.name}`) });
  const legends = dyn.legendIds.map((id) => S.legends[id]).filter((l) => !!l);
  if (legends.length) {
    sections.push({
      title: 'ตำนานที่ลูกหลานเล่าต่อ — กับเรื่องจริง',
      items: legends.flatMap((l) => [
        `เล่ากันว่า: ${renderLegend(ctx, l!, 'current')}`,
        `เรื่องจริง: ${renderLegend(ctx, l!, 'truth')} (คลาดไป ${pct(l!.divergence)}%${l!.writtenRecord ? ', จดลงสมุดข่อยแล้ว' : ''})`,
      ]),
    });
  }
  if (dyn.taboos.length) {
    sections.push({
      title: 'ข้อห้ามที่ยังถือกันอยู่',
      items: dyn.taboos.map((t) => `${t.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(t.target)} — ${t.originKnown ? 'ยังรู้ต้นเหตุ' : 'ไม่มีใครจำต้นเหตุได้แล้ว'}`),
    });
  }
  return {
    reason,
    title: reason === 'era' ? `จบเรื่อง พ.ศ. ${year}` : `ตระกูล${dyn.name}สิ้นสาย พ.ศ. ${year}`,
    text: reason === 'era'
      ? `เรื่องของตระกูล${dyn.name}ดำเนินมาถึงปลายช่วงที่เกมครอบคลุม`
      : 'ไม่เหลือลูก หลาน หรือพี่น้องที่จะสืบตระกูลต่อ',
    facts,
    sections,
  };
}
