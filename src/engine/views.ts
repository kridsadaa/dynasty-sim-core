import { formatLunar, formatSolar } from '../core/calendar';
import { ageOf, isAlive, lunarOf, must, solarOf, yearOf, type Ctx } from '../core/ctx';
import type { CapabilityId, Character, FamilyNode, Item, Parentage, Personality, Trait } from '../core/types';
import { DISTANCE_TH, familiarity, isSingle, knownLocals, localOrigin, relationStrength, tradeOf } from '../systems/acquaintance';
import { capability } from '../systems/body';
import type { EventReport, PreparedEvent } from '../systems/events';
import { displayName, livingChildren, livingParents, livingSpouse, singleLabel } from '../systems/factory';
import { activeIntent, intentStatus, planIntent, targetProblem, type OddsFactor } from '../systems/intent';
import { careerHint, officeRank, officeStatus, officeTier } from '../systems/career';
import { warBadges } from '../systems/war';
import { activeFiction, isFictionYear } from '../systems/fiction';
import { livingWives } from '../systems/wives';
import { estateHeirs, heirCandidates, PARENTAGE_TH, RELATION_TH } from '../systems/handover';
import { choreSkills } from '../systems/chores';
import { funds, marriageHint, marriageStatus, purse } from '../systems/marriage';
import { renderLegend } from '../systems/legend';
import { eventArtTags, portraitArtTags } from '../art/select';
import { describeTrait } from '../systems/traits';
import { riskChance } from '../systems/will';
import { opinion, opinionLabel } from '../systems/opinion';
import {
  canManage, CARE_TH, expandHouseCost, HOUSE_TIERS, houseCapacity, householdMonth, houseMembersCount,
  houseTierOf, landCap, landCost, landOf, loyaltyText, servantsText, slaveCapacity, SLAVE_TASK_TH,
} from '../systems/servants';
import { hasPerk, LEGACY_TRACKS, legacyCost, legacyLevel, SKILL_TRACKS } from '../systems/skills';
import { interactionsFor, slaveConcubineProblem } from '../systems/interactions';
import type {
  InteractionView,
  HouseholdView,
  MatchView,
  ChoiceResult,
  CharacterView, DeathNotice, DynastyView, EndingView, EndReason, EventView, InspectView, IntentPlanView, IntentStatusView, KnownPersonView,
  EraSegment, OddsFactorView, SkillsView, StatusBadge, TreeView,
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

/** ป้ายสถานะของตัวละครที่ยังมีชีวิต — แสดงทั้งในแผงตัวละคร รายชื่อคนรู้จัก และหน้าดูรายละเอียด */
function statusBadges(ctx: Ctx, ch: Character, text: TextTable): StatusBadge[] {
  if (!isAlive(ch)) return [];
  const S = ctx.state;
  const out: StatusBadge[] = [];
  const partLabel = partLabelOf(ctx, ch.anatomyId);
  const year = yearOf(ctx, S.meta.day);

  if (ch.illYear === year) out.push({ label: 'ป่วยหนัก', tone: 'bad' });
  if ((ch.closeCalls ?? 0) > 0) out.push({ label: `รอดตายมาแล้ว ${ch.closeCalls} ครั้ง`, tone: 'info' });
  for (const wid of ch.woundIds) {
    const w = S.wounds[wid];
    if (!w) continue;
    const part = partLabel(w.partDefId);
    const stage = t(text, 'wound.stage', w.stage);
    if (w.stage === 'infected' || w.stage === 'festering') {
      out.push({ label: `แผล${stage}ที่${part}`, tone: 'bad' });
    } else if (w.severity >= 0.45) {
      out.push({ label: `แผลลึกที่${part} (${stage})`, tone: 'bad' });
    } else {
      out.push({ label: `แผลที่${part} (${stage})`, tone: 'warn' });
    }
  }
  for (const pid of ch.bodyPartIds) {
    const p = S.bodyParts[pid];
    if (p?.status === 'missing') out.push({ label: `สูญเสีย${partLabel(p.partDefId)}`, tone: 'warn' });
  }
  if (ch.pregnancy) {
    const months = Math.max(1, Math.round((ch.pregnancy.dueDay - S.meta.day) / 30));
    out.push({ label: `ตั้งครรภ์ (${months} เดือนคลอด)`, tone: 'good' });
  }
  if (ch.stress >= 0.7) out.push({ label: 'ใจหนักมาก', tone: 'bad' });
  else if (ch.stress >= 0.45) out.push({ label: 'ใจหนัก', tone: 'warn' });
  if (ageOf(ctx, ch) < 12 && ch.hardToRaise) out.push({ label: 'เด็กเลี้ยงยาก', tone: 'warn' });
  else if ((ch.constitution ?? 0) <= -0.8) out.push({ label: 'ขี้โรค', tone: 'warn' });
  if (ch.office) out.push({ label: ch.social.title ? `ราชการ (${ch.social.title})` : 'รับราชการ', tone: 'info' });
  if (ch.service) out.push({ label: 'ช่วยงานบ้านพ่อตา', tone: 'info' });
  if (ch.focus) {
    const tr = SKILL_TRACKS.find((t) => t.id === ch.focus);
    if (tr) out.push({ label: `ฝึก${tr.name}`, tone: 'info' });
  }
  if (ch.favoredUntil !== undefined && S.meta.day <= ch.favoredUntil) out.push({ label: 'เป็นที่รักใคร่', tone: 'good' });
  return out;
}

function skillsView(ctx: Ctx, ch: Character): SkillsView {
  const age = ageOf(ctx, ch);
  const canFocus = age >= 12 && ch.social.estate !== 'monk';
  return {
    canFocus,
    currentFocus: ch.focus ?? null,
    tracks: SKILL_TRACKS.map((tr) => {
      const xp = Math.round(ch.skillXp?.[tr.id] ?? 0);
      const unlockedCount = tr.perks.filter((p) => hasPerk(ch, p.id)).length;
      const canUnlock = unlockedCount < tr.perks.length && xp >= 100;
      return {
        id: tr.id,
        name: tr.name,
        focusLabel: tr.focusLabel,
        focusDesc: tr.focusDesc,
        focused: ch.focus === tr.id,
        xp,
        canUnlock,
        perks: tr.perks.map((p) => ({
          id: p.id,
          tier: p.tier,
          name: p.name,
          desc: p.desc,
          unlocked: hasPerk(ch, p.id),
        })),
      };
    }),
  };
}

function characterRoles(ctx: Ctx, ch: Character, node?: FamilyNode): string[] {
  const roles: string[] = [];
  if (ch.social.estate === 'monk') roles.push('monk');
  const rank = officeRank(ctx, ch);
  if (rank === 0) roles.push('page');
  else if (rank !== undefined && rank > 0) {
    roles.push('official');
    const dept = ch.office?.deptId;
    if (dept === 'royal_chamber_right') roles.push('official_palace');
    else if (dept === 'royal_scholars') roles.push('official_scholar');
    else roles.push('official_patrol');
  } else if (ch.social.title && !ch.formerOffice) {
    // มีบรรดาศักดิ์แต่ไม่มีตำแหน่งในระบบราชการของเกม (พ่อในฉากเริ่ม) — บรรดาศักดิ์ผูกกับตำแหน่ง จึงแต่งกายแบบขุนนาง
    roles.push('official');
  }
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
  if (ch.sex === 'f') {
    if (ch.pregnantUntilDay !== undefined && ctx.state.meta.day <= ch.pregnantUntilDay) roles.push('pregnant');
    if (ch.wifeRank === 'minor') roles.push('minor_wife');
    else {
      if (hh?.headId === ch.id || dyn?.headNodeId === ch.familyNodeId) roles.push('household_head');
      if (ch.marriedDay !== undefined || (node?.spouseIds.length ?? 0) > 0) roles.push('principal_wife');
    }
  }
  return roles;
}

/** เหตุการณ์ประวัติศาสตร์ที่ยังมีผลอยู่ในปีนี้ → ป้ายค้างบน UI (ปีที่เกิด ถึง year + lasts) */
export function eraConditions(ctx: Ctx): StatusBadge[] {
  const now = yearOf(ctx, ctx.state.meta.day);
  const seen = new Set<string>();
  const out: StatusBadge[] = [];
  for (const ev of [...ctx.content.history, ...activeFiction(ctx, now)]) {
    if (now < ev.year || now >= ev.year + (ev.lasts ?? 1) || seen.has(ev.tag)) continue;
    seen.add(ev.tag);
    out.push({ label: ctx.tags.label(ev.tag), tone: ev.kind === 'succession' ? 'warn' : ev.kind === 'boon' ? 'good' : 'bad' });
  }
  if (isFictionYear(ctx, now)) out.push({ label: 'ยุคสมมติ — ไม่อิงประวัติศาสตร์จริง', tone: 'info' });
  return out;
}

/** ช่วงยุคสำหรับหลอดยุคสมัย — ขอบยุคเป็นการแบ่งของเกม (ตรงกับเหตุการณ์ใน history ของ rules.json) */
const ERAS: ReadonlyArray<{ name: string; from: number; to: number }> = [
  { name: 'ปลายกรุงศรีอยุธยา', from: 2288, to: 2308 },
  { name: 'ศึกพม่าและเสียกรุง', from: 2308, to: 2313 },
  { name: 'กรุงธนบุรี', from: 2313, to: 2325 },
  { name: 'รัชกาลที่ 1', from: 2325, to: 2352 },
  { name: 'รัชกาลที่ 2–3', from: 2352, to: 2394 },
  { name: 'รัชกาลที่ 4', from: 2394, to: 2400 },
];

export function eraBar(ctx: Ctx): EraSegment[] {
  const now = yearOf(ctx, ctx.state.meta.day);
  return ERAS.map((e) => {
    const state = now >= e.to ? 'past' : now >= e.from ? 'now' : 'future';
    return { name: state === 'future' ? null : e.name, from: e.from, to: e.to, state };
  });
}

/** UI ไม่ควรเห็นคีย์ภายใน ("noble", "finger.index.l", "manipulation.fine") — แปลงเป็นคำไทยที่นี่ */
export function playerView(ctx: Ctx, text: TextTable = {}): CharacterView {
  const ch = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const age = ageOf(ctx, ch);
  const node = ctx.state.familyNodes[ch.familyNodeId];
  return {
    name: ch.name,
    nodeId: ch.familyNodeId,
    age,
    year: yearOf(ctx, ctx.state.meta.day),
    solar: formatSolar(solarOf(ctx)),
    lunar: formatLunar(lunarOf(ctx)),
    estate: estateLabel(ctx, ch.social.estate),
    title: ch.social.title,
    wealth: Math.round(ch.social.wealth),
    purse: Math.round(purse(ctx, ch)),
    statuses: statusBadges(ctx, ch, text),
    conditions: [...eraConditions(ctx), ...warBadges(ctx)],
    eraBar: eraBar(ctx),
    traits: ch.traitIds.map((id) => ctx.state.traits[id]).filter((t) => !!t && !t.latent).map((t) => describeTrait(ctx, t!)),
    scars: scarLines(ctx, ch, text),
    wounds: woundLines(ctx, ch, text),
    // คีย์เป็นคำไทยเพราะ UI แสดงคีย์ตรงๆ
    capabilities: Object.fromEntries(CAPS.map((c) => [t(text, 'capability', c), Math.round(capability(ctx, ch, c) * 100) / 100])),
    ...lifestyleView(ctx, ch, text),
    marriage: marriageStatus(ctx, ch),
    office: officeStatus(ctx, ch),
    household: householdView(ctx, ch),
    skills: skillsView(ctx, ch),
    craftSkills: choreSkills(ctx, ch),
    portraitTags: portraitArtTags({
      sex: ch.sex, age, topknotCut: ch.topknotCutYear !== undefined,
      estate: ch.social.estate, roles: characterRoles(ctx, ch, node), rank: officeTier(ctx, ch),
    }),
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
  if (spouse) out.set(spouse, me.sex === 'm' ? 'เมีย' : 'ผัว');
  if (me.sex === 'm') for (const w of livingWives(ctx, me)) if (w.wifeRank === 'minor') out.set(w, w.social.estate === 'that' ? 'เมียบ่าว (เมียน้อย)' : 'เมียน้อย');
  for (const kid of livingChildren(ctx, me)) {
    out.set(kid, kid.sex === 'm' ? 'ลูกชาย' : 'ลูกสาว');
    const inLaw = livingSpouse(ctx, kid);
    if (inLaw) out.set(inLaw, kid.sex === 'm' ? `ลูกสะใภ้ (เมีย${kid.name})` : `ลูกเขย (ผัว${kid.name})`);
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
  const kin: KnownPersonView[] = [...kinTies(ctx, me)].map(([c, tie]) => {
    const inHousehold = Boolean(c.householdId && c.householdId === me.householdId);
    return {
      id: c.id, nodeId: c.familyNodeId, name: c.name, age: ageOf(ctx, c), tie, kin: true, inHousehold,
      statuses: statusBadges(ctx, c, text),
      detail: inHousehold ? 'อยู่เรือนเดียวกัน' : 'อยู่คนละเรือน',
      actions: [], focus: false,
    };
  });
  const locals: KnownPersonView[] = knownLocals(ctx, me)
    .sort((a, b) => familiarity(ctx, me.id, b.id) - familiarity(ctx, me.id, a.id))
    .map((c) => {
      const age = ageOf(ctx, c);
      const status = c.local!.wed ? 'ออกเรือนแล้ว' : isSingle(ctx, c) ? singleLabel(ctx, c.sex, age) : null;
      return {
        id: c.id, nodeId: c.familyNodeId, name: c.name, age,
        tie: me.betrothal?.toId === c.id ? 'คู่หมั้น' : me.eloped?.withId === c.id ? 'อยู่ด้วยกัน (ยังไม่ได้แต่ง)'
          : relationStrength(ctx, me.id, c.id, 'friend') >= 0.5 ? 'เพื่อนสนิท' : 'คนรู้จัก',
        kin: false, inHousehold: false,
        statuses: statusBadges(ctx, c, text),
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
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  const isHead = Boolean(player && dyn.headNodeId === player.familyNodeId);
  const cost = legacyCost(dyn);
  return {
    name: dyn.name,
    prestige: Math.round(dyn.prestige * 10) / 10,
    taboos: dyn.taboos.map((t) => `${t.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(t.target)} (${Math.round(t.strength * 100)}%)`),
    legends: dyn.legendIds.map((id) => ctx.state.legends[id]).filter((l) => !!l).map((l) => ({
      text: renderLegend(ctx, l!, 'current'),
      // ภาพตำนานวาดตามฉบับที่เล่ากัน (สนามรบ ไม่ใช่โรงครัว) — art/README.md ข้อ 2
      artTags: ['legend:any', ...ctx.tags.expand(Object.values(l!.current.slots)), ...l!.current.supernatural],
    })),
    livingMembers: Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c)).length,
    familyNodes: Object.keys(ctx.state.familyNodes).length,
    isHead,
    nextLegacyCost: cost,
    legacies: LEGACY_TRACKS.map((tr) => {
      const level = legacyLevel(ctx, player, tr.id);
      return {
        id: tr.id,
        name: tr.name,
        desc: tr.desc,
        level,
        canUnlock: isHead && level < tr.steps.length && dyn.prestige >= cost,
        steps: tr.steps.map((s, idx) => ({
          tier: idx + 1,
          name: s.name,
          desc: s.desc,
          unlocked: idx < level,
        })),
      };
    }),
  };
}

/** ช่องพิมพ์ชื่อของ event ตั้งชื่อ — เด็กอยู่ใน role 'child' */
function nameInput(ctx: Ctx, p: PreparedEvent): { default: string; label: string } | undefined {
  const kid = p.instance.bindings.child ? ctx.state.characters[p.instance.bindings.child] : undefined;
  if (!kid) return undefined;
  return { default: kid.name, label: `ชื่อ${kid.sex === 'm' ? 'เด็กชาย' : 'เด็กหญิง'}` };
}

/**
 * ผลคร่าวๆ ที่ตัวละครเดาได้ก่อนเลือก
 *  ราชการ: เงิน ความโปรดปราน บุญบาป — ไม่บอกตัวเลขความโปรดปราน (เดาใจนายได้แค่คร่าวๆ)
 *  เรื่องในบ้าน: ใจต่อผู้ใหญ่ ความหนักใจ บุญบาป หน้าตาของตระกูล — ราคาอยู่ในข้อความตัวเลือกแล้ว จึงไม่บอกเงินซ้ำ
 */
function effectHint(
  ctx: Ctx, p: PreparedEvent, effects: PreparedEvent['options'][number]['effects'], vars: Record<string, string>, text: TextTable,
): string | undefined {
  const skills = skillHints(ctx, effects, vars, text);
  if (!p.def.id.startsWith('career.')) {
    const base = everydayHint(effects, vars, ['festival.', 'intent.', 'war.'].some((prefix) => p.def.id.startsWith(prefix)), !!p.actor.office);
    return [...skills, base].filter(Boolean).join(' · ') || undefined; // วิชาก่อน — เป็นผลหลักของตัวเลือกฝึก
  }
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
  parts.push(...skills);
  return parts.length ? parts.join(' · ') : undefined;
}

/**
 * ได้ฝึกวิชา: "ได้ฝึกเพลงมวยและเพลงอาวุธ" / "{child}ได้ฝึกงานบุญ" — ไม่บอกตัวเลข (ตัวละครรู้แค่ว่าได้ฝึก)
 * วิชาที่ไม่มีชื่อให้ผู้เล่นอ่าน (เช่น stoicism) ไม่บอก
 */
function skillHints(ctx: Ctx, effects: PreparedEvent['options'][number]['effects'], vars: Record<string, string>, text: TextTable): string[] {
  const out: string[] = [];
  for (const e of effects) {
    if (e.op !== 'skill' || e.delta <= 0) continue;
    const label = ctx.content.chores.skillLabels[e.skill] ?? text[`skill.${e.skill}`];
    if (!label) continue;
    out.push(`${e.role === 'actor' ? '' : (vars[e.role] ?? e.role)}ได้ฝึก${label}`);
  }
  return [...new Set(out)];
}

/** showCost: บอกเงินที่เสียด้วย (งานบุญ/ผูกมิตร ราคาไม่อยู่ในข้อความตัวเลือก) */
function everydayHint(effects: PreparedEvent['options'][number]['effects'], vars: Record<string, string>, showCost = false, hasOffice = true): string | undefined {
  const parts: string[] = [];
  for (const e of effects) {
    if (showCost && e.op === 'wealth' && e.role === 'actor' && (e.delta ?? 0) < 0) parts.push(`เสียเงิน ${+Math.abs(e.delta!).toFixed(1)} ตำลึง`);
    if (showCost && e.op === 'wealth' && e.role === 'actor' && (e.delta ?? 0) > 0) parts.push(`ได้เงิน ${+e.delta!.toFixed(1)} ตำลึง`);
    if (e.op === 'bond' && e.role === 'actor') {
      const to = vars[e.toward] ?? e.toward;
      if (e.affection) parts.push(e.affection > 0 ? `สนิทกับ${to}ขึ้น` : `ห่างเหิน${to}`);
      if (e.awe && e.awe > 0) parts.push(`เกรง${to}ขึ้น`);
    }
    if (e.op === 'wound' && e.role === 'actor') parts.push(e.severity[1] >= 0.3 ? 'เจ็บหนัก' : 'เจ็บตัว');
    // คนอื่นรู้สึกต่อเรา: "{rival}ไม่พอใจ" / "{patron}เอ็นดู"
    if (e.op === 'relation' && e.role !== 'actor' && e.toward === 'actor' && e.delta) {
      const who = vars[e.role] ?? e.role;
      if (e.kind === 'grudge' || e.kind === 'rival') parts.push(e.delta > 0 ? `${who}ไม่พอใจ` : `${who}หายเคือง`);
      else if (e.kind === 'friend' || e.kind === 'gratitude' || e.kind === 'affection') parts.push(e.delta > 0 ? `${who}เอ็นดู` : `${who}ห่างเหิน`);
    }
    if (e.op === 'relation' && e.role === 'actor' && (e.kind === 'grudge' || e.kind === 'rival')) {
      parts.push(`ไม่ชอบหน้า${vars[e.toward] ?? e.toward}`);
      continue;
    }
    if (e.op === 'relation' && e.role === 'actor' && e.kind === 'patron') {
      parts.push(`เป็นคนของ${vars[e.toward] ?? e.toward}`);
      continue;
    }
    if (e.op === 'relation' && e.role === 'actor') {
      const to = vars[e.toward] ?? e.toward;
      const up = Math.max(e.atLeast ?? 0, e.delta ?? 0);
      if ((e.delta ?? 0) < 0) parts.push(`ห่างเหิน${to}`);
      else if (up >= 0.3 || (e.delta ?? 0) >= 0.1) parts.push(`สนิทกับ${to}ขึ้น`);
      else if (up > 0) parts.push(`รู้จัก${to}`);
    }
    if (e.op === 'stress' && e.role === 'actor' && e.delta) parts.push(e.delta > 0 ? 'หนักใจขึ้น' : 'สบายใจขึ้น');
    if (e.op === 'merit' && e.delta) parts.push(e.delta > 0 ? 'ได้บุญ' : 'เป็นบาป');
    if (e.op === 'war' && e.action === 'prep' && e.delta > 0) parts.push('รับมือศึกได้ดีขึ้น');
    if (e.op === 'war' && e.action === 'bury') parts.push('ฝังเงินทองไว้ (ใช้ไม่ได้จนกว่าศึกจะผ่าน)');
    if (e.op === 'war' && e.action === 'stay') parts.push('อยู่ในกรุง');
    if (e.op === 'war' && e.action === 'taksin') parts.push('ออกจากกรุงไปกับพระยาตาก');
    if (e.op === 'war' && e.action === 'leave') parts.push(`${e.dir === 'east' ? 'ไปทางตะวันออก' : e.dir === 'camp' ? 'ยอมแพ้ที่ค่ายพม่า (รอดชีวิตง่ายแต่มักถูกกวาดต้อน)' : 'เข้าป่าทางตะวันตก'} · ${e.party === 'all' ? 'ทั้งเรือน' : e.party === 'nuclear' ? 'คนใกล้ชิด' : 'คนเดียว'}`);
    if (showCost && hasOffice && e.op === 'favor' && e.delta < 0) parts.push('ถูกมองว่าทิ้งราชการ');
    if (e.op === 'prestige' && e.delta) parts.push(e.delta > 0 ? 'ตระกูลได้หน้า' : 'ตระกูลเสียหน้า');
  }
  return parts.length ? [...new Set(parts)].join(' · ') : undefined;
}

/**
 * ข้อความของ event ที่ผู้ใหญ่ (ADULT_AGE ขึ้นไป) อ่านแล้วไม่ขัด — งานบุญเขียนจากสายตาเด็กที่ตามผู้ใหญ่ไป
 * ใส่ `<key>.adult` ไว้ข้างกันใน text.th.json แล้วระบบเลือกให้ (ไม่มี = ใช้ข้อความเดิม)
 */
const ADULT_AGE = 20;
function ageKey(ctx: Ctx, p: PreparedEvent, key: string, text: TextTable): string {
  return ageOf(ctx, p.actor) >= ADULT_AGE && text[`${key}.adult`] ? `${key}.adult` : key;
}

/** ตัวเลือกเสี่ยง: "อาจถูกจับได้ (ราว 40%)" แล้วตามด้วยผลถ้าพลาด */
function riskHint(ctx: Ctx, p: PreparedEvent, o: PreparedEvent['options'][number], text: TextTable, vars: Record<string, string>): string | undefined {
  if (!o.risk) return undefined;
  const who = (role: string) => ctx.state.characters[p.instance.bindings[role] ?? ('' as Character['id'])];
  const chance = Math.round(riskChance(ctx, p.actor, o.risk, who) * 20) * 5; // ปัดทีละ 5% — เดาได้แค่คร่าวๆ
  const ifFail = everydayHint(o.risk.fail.effects.filter((e) => e.op !== 'war' || e.action !== 'leave'), vars);
  return `${fill(text[ageKey(ctx, p, o.risk.hintKey, text)] ?? o.risk.hintKey, vars)} (ราว ${chance}%)${ifFail ? ` — ถ้าพลาด: ${ifFail}` : ''}`;
}

/** ชื่อคนในแต่ละ role (พ่อแม่ของ actor เรียกแบบลูก) และตัวแปรของ event — ใช้เติมข้อความ event และบรรทัดผลของตัวเลือก */
export function eventVars(ctx: Ctx, p: PreparedEvent): Record<string, string> {
  const vars: Record<string, string> = {};
  const actorNode = ctx.state.familyNodes[p.actor.familyNodeId];
  // ญาติที่ตาย: คำเรียกมากับ event (tie) — "เมีย(บัว)"
  const tie = p.instance.vars['tie'] ? ctx.tags.label(p.instance.vars['tie']) : '';
  for (const [role, id] of Object.entries(p.instance.bindings)) {
    const ch = ctx.state.characters[id];
    // เรียกพ่อแม่ตามที่ลูกเรียก ชื่ออยู่ในวงเล็บ: "แม่(แย้ม)" ไม่ใช่ "แย้ม"
    const kin = ch && (ch.familyNodeId === actorNode?.motherId ? 'แม่' : ch.familyNodeId === actorNode?.fatherId ? 'พ่อ' : role === 'deceased' ? tie : '');
    vars[role] = !ch ? role : kin ? `${kin}(${ch.name})` : ch.name;
  }
  // ตัวแปรส่วนใหญ่เป็น tag → ชื่อไทย; บาง event ส่งข้อความมาตรงๆ (ตำนานที่เล่ากับเรื่องจริง)
  for (const [k, v] of Object.entries(p.instance.vars)) vars[k] = ctx.tags.def(v) ? ctx.tags.label(v) : v;
  return vars;
}

/**
 * event ที่มาซ้ำทุกปี (งานบุญ) มีข้อความหลายแบบ: key, key.v2, key.v3… — เลือกตาม id ของ event
 * ครั้งเดียวกันได้ข้อความเดิมเสมอ (โหลดเซฟแล้วไม่เปลี่ยน)
 */
function variantKey(ctx: Ctx, p: PreparedEvent, text: TextTable): string {
  const adult = ageKey(ctx, p, p.def.textKey, text);
  if (adult !== p.def.textKey) return adult;
  const keys = [p.def.textKey];
  for (let i = 2; text[`${p.def.textKey}.v${i}`]; i++) keys.push(`${p.def.textKey}.v${i}`);
  let h = 0;
  for (const c of p.instance.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return keys[h % keys.length]!;
}

/** งานบุญที่ทำตามนิสัย: "วันพระ — ตามผู้ใหญ่ไปวัด… (ตามเคย)" ตามด้วยผลของตัวเลือกเสี่ยงและบรรทัดจาก effect */
export function habitLines(ctx: Ctx, p: PreparedEvent, report: EventReport, text: TextTable): string[] {
  const vars = eventVars(ctx, p);
  const opt = p.options.find((o) => o.id === report.optionId);
  const did = opt ? fill(text[ageKey(ctx, p, opt.textKey, text)] ?? opt.textKey, { ...vars, ...opt.params }) : report.optionId;
  const lines = [`${text[`${p.def.textKey}.title`] ?? p.def.id} — ${did} (ตามเคย)`];
  if (report.outcome?.textKey) lines.push(outcomeLine(ctx, p, report.outcome.textKey, text));
  return [...lines, ...report.notes];
}

/** บรรทัดในบันทึกที่บอกว่าตัวเลือกเสี่ยงสำเร็จหรือพลาด */
export function outcomeLine(ctx: Ctx, p: PreparedEvent, textKey: string, text: TextTable): string {
  return fill(text[ageKey(ctx, p, textKey, text)] ?? textKey, eventVars(ctx, p));
}

/** ตัวเลือกที่เป็นขั้นตอนแต่งงาน → บอกราคาและโอกาสไว้ก่อนเลือก */
function optionHint(ctx: Ctx, p: PreparedEvent, effects: PreparedEvent['options'][number]['effects']): string | undefined {
  for (const e of effects) {
    if (e.op === 'career' && e.action !== 'restore' && e.action !== 'decline') {
      const ch = ctx.state.characters[p.instance.bindings[e.role] ?? ('' as Character['id'])];
      if (ch) return careerHint(ctx, ch, e.action, e.dept);
    }
    if (e.op !== 'marriage') continue;
    const actor = ctx.state.characters[p.instance.bindings[e.role] ?? ('' as Character['id'])];
    const other = ctx.state.characters[p.instance.bindings[e.with] ?? ('' as Character['id'])];
    if (actor && other) return marriageHint(ctx, e.step, actor, other);
  }
  return undefined;
}

export function eventView(ctx: Ctx, p: PreparedEvent, text: TextTable): EventView {
  const vars = eventVars(ctx, p);
  const willNote = (id: string) => {
    const r = p.resist.get(id);
    if (!r) return undefined;
    const reason = fill(text[`will.reason.${r.reasonKey}`] ?? r.reasonKey, { who: r.role ? vars[r.role] ?? r.role : '' });
    return fill(text[p.locked.get(id) === 'will' ? 'will.lock' : 'will.strain'] ?? '{reason}', { reason });
  };
  return {
    instanceId: p.instance.id,
    title: text[`${p.def.textKey}.title`] ?? p.def.id,
    text: fill(text[variantKey(ctx, p, text)] ?? p.def.textKey, vars),
    options: p.options.map((o) => ({
      id: o.id,
      text: fill(text[ageKey(ctx, p, o.textKey, text)] ?? o.textKey, { ...vars, ...o.params }),
      locked: p.locked.has(o.id),
      injected: !!o.injectedBy,
      note: willNote(o.id),
      nameInput: o.input === 'name' ? nameInput(ctx, p) : undefined,
      hint: [optionHint(ctx, p, o.effects) ?? effectHint(ctx, p, o.effects, vars, text), riskHint(ctx, p, o, text, vars)]
        .filter(Boolean).join(' · ') || undefined,
    })),
    triggered: [...new Set(p.hits.map((h) => describeTrait(ctx, h.trait)))],
    artTags: eventArtTags(p.def.id, ctx.tags.expand(p.instance.resolvedTags)),
  };
}

// ---------------------------------------------------------------------------
// ผังตระกูล + หน้าดูตัวละคร — ใช้เล่นทดสอบ/debug ระบบ จึงโชว์ข้อมูลภายในมากกว่าหน้าตัวละครปกติ (เช่น ปมแฝง นิสัยเป็นตัวเลข)
// ---------------------------------------------------------------------------

/**
 * เงินของคนนี้ — เกมนับเงินเป็นรายคน แต่ลูกที่ยังอยู่ในเรือนพ่อแม่และเมียที่ผัวถือเงินอยู่ไม่มีเงินของตัวเอง
 * ไม่แสดง "0 ตำลึง" ให้ดูเหมือนยากจน แต่บอกว่าทรัพย์อยู่กับใคร
 */
function wealthText(ctx: Ctx, ch: Character): string {
  const debt = ch.social.debt ? ` · หนี้ ${Math.round(ch.social.debt)}` : '';
  if (Math.round(ch.social.wealth) > 0 || !isAlive(ch)) return `${Math.round(ch.social.wealth)} ตำลึง${debt}`;
  const spouse = livingSpouse(ctx, ch);
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  const head = hh && hh.headId !== ch.id ? ctx.state.characters[hh.headId] : undefined;
  const holder = spouse && spouse.social.wealth > 0 ? spouse : head;
  return holder ? `ไม่มีเงินของตัวเอง ทรัพย์อยู่กับ${holder.name}${debt}` : `ไม่มีเงิน${debt}`;
}

/** สถานะแม่ในผัง — ภรรยาหลวง/ไม่ทราบ เป็นค่าปกติ ไม่ต้องแสดง */
const parentageLabel = (p: Parentage): string | null =>
  p === 'principal_wife' || p === 'unknown' ? null : PARENTAGE_TH[p];

const PERSONALITY_TH: Record<keyof Personality, string> = {
  neuroticism: 'หวั่นไหว',
  imagination: 'ช่างคิด',
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
  const percent = (x: number) => `${pct(x)}%`;

  const facts: InspectView['facts'] = [];
  const sections: InspectView['sections'] = [];
  const links: NonNullable<InspectView['links']> = {};
  const section = (title: string, items: string[]) => {
    if (items.length) sections.push({ title, items });
  };
  // ญาติในผัง — UI ทำชื่อเป็นปุ่มเปิดดูคนนั้นต่อได้
  // คนที่ตายแล้วบอกไว้ — "คู่ครอง: อยู่" ทั้งที่ผัวตายไปแล้วชวนให้เข้าใจผิด
  const gone = (id: FamilyNode['id']) => {
    const n = S.familyNodes[id]!;
    const c = n.characterId ? S.characters[n.characterId] : undefined;
    return n.deathYear != null || (!!c && !isAlive(c));
  };
  const linked = (label: string, ids: Array<FamilyNode['id'] | null>, sep: string) => {
    const list = ids.filter((id): id is FamilyNode['id'] => !!id && !!S.familyNodes[id])
      .map((id) => ({ name: `${nodeName(id)!}${gone(id) ? ' (ล่วงลับ)' : ''}`, nodeId: id }));
    if (!list.length) return;
    facts.push([label, list.map((x) => x.name).join(sep)]);
    links[label] = list;
  };

  // ข้อมูลในผัง — มีทุกคน รวมคนที่ถูก prune
  const dyn = node.dynastyId ? S.dynasties[node.dynastyId] : undefined;
  if (dyn?.founderNodeId === node.id) facts.push(['ต้นตระกูล', dyn.name]);
  if (dyn?.headNodeId === node.id) facts.push(['ตำแหน่ง', `ผู้นำตระกูล${dyn.name}`]);
  linked('บิดามารดา', [node.fatherId, node.motherId], ' · ');
  const parentage = parentageLabel(node.parentage);
  if (parentage) facts.push(['ฐานะในบ้าน', parentage]);
  facts.push(['รุ่นที่', String(node.generation + 1)]); // generation นับจาก 0 ที่รุ่นต้นตระกูล
  linked('คู่ครอง', node.spouseIds, ', ');
  linked('บุตร', node.childIds, ', ');
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
    const prunedAge = Math.max(0, (deathYear ?? node.birthYear + 50) - node.birthYear);
    const prunedRoles: string[] = [];
    if (sm?.estate === 'monk') prunedRoles.push('monk');
    else if (sm?.title && node.sex === 'm') prunedRoles.push('official');
    else if (node.sex === 'f') {
      if (dyn?.headNodeId === node.id) prunedRoles.push('household_head');
      if (node.spouseIds.length > 0) prunedRoles.push('principal_wife');
    }
    return {
      nodeId: node.id, name: node.name, sex: node.sex,
      lifespan: `${node.birthYear}–${deathYear ?? '?'}`,
      status: node.driftedYear !== undefined
        ? `แยกไปอยู่ที่อื่นตั้งแต่ พ.ศ. ${node.driftedYear} — ขาดการติดต่อกับตระกูล`
        : `เหลือแต่ชื่อในผังตระกูล${cause ? ` · ${ctx.tags.label(cause)}` : ''}`,
      statuses: [],
      facts, sections, links,
      portraitTags: portraitArtTags({
        sex: node.sex, age: prunedAge, topknotCut: prunedAge >= 13,
        estate: sm?.estate ?? 'noble', roles: prunedRoles,
      }),
    };
  }

  const charAge = ageOf(ctx, ch, ch.deathDay ?? S.meta.day);
  facts.unshift(['อายุ', `${charAge} ปี`], ['ชนชั้น', estateLabel(ctx, ch.social.estate)]);
  if (ch.social.title) facts.push(['บรรดาศักดิ์', ch.social.title]);
  if (ch.ordainedYear !== undefined) facts.push(['บวชเรียน', `พ.ศ. ${ch.ordainedYear}`]);
  if (ch.topknotCutYear !== undefined) facts.push(['โกนจุก', `พ.ศ. ${ch.topknotCutYear}`]);
  const office = officeStatus(ctx, ch);
  if (office) facts.push(['ราชการ', office]);
  facts.push(['เงินทอง', wealthText(ctx, ch)]);
  // ศักดินาในเกมมาจากตำแหน่งราชการเท่านั้น — คนไม่มีตำแหน่งยังไม่มีตัวเลขที่ lore ยืนยัน จึงไม่แสดง 0
  facts.push(['ศักดินา', ch.social.sakdina ? String(ch.social.sakdina) : 'ไม่มีตำแหน่ง']);
  if (ch.social.patronId) facts.push(['มูลนาย', charName(ch.social.patronId)]);
  if (ch.pregnancy && isAlive(ch)) facts.push(['ครรภ์', `ตั้งครรภ์อยู่ อีกราว ${Math.max(1, Math.round((ch.pregnancy.dueDay - S.meta.day) / 30))} เดือนจะคลอด`]);
  facts.push(['ความหนักใจ', percent(ch.stress)], ['บุญ', ch.merit.toFixed(1)], ['ถนัดมือ', ch.handedness === 'l' ? 'ซ้าย' : 'ขวา']);
  const hh = ch.householdId ? S.households[ch.householdId] : undefined;
  if (hh) {
    const help = servantsText(ctx, hh.id);
    facts.push(['เรือน', `${hh.headId === ch.id ? 'เป็นหัวเรือน' : `อยู่เรือนของ${charName(hh.headId)}`} · ${hh.memberIds.length} คน${help ? ` · ${help}` : ''}`]);
  }

  // ความรู้สึกระหว่างคนนี้กับผู้เล่น −100..100 (systems/opinion.ts)
  const me = S.characters[S.meta.playerCharacterId];
  if (me && me.id !== ch.id && isAlive(ch)) {
    facts.unshift(
      [`รู้สึกต่อ${me.name}`, opinionLabel(opinion(ctx, ch.id, me.id))],
      [`${me.name}รู้สึกต่อคนนี้`, opinionLabel(opinion(ctx, me.id, ch.id))],
    );
  }
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
    statuses: statusBadges(ctx, ch, text),
    facts, sections, links,
    ...(isAlive(ch) && ch.id !== S.meta.playerCharacterId ? { characterId: ch.id } : {}),
    portraitTags: portraitArtTags({
      sex: ch.sex, age: charAge, topknotCut: ch.topknotCutYear !== undefined,
      estate: ch.social.estate, roles: characterRoles(ctx, ch, node), rank: officeTier(ctx, ch),
    }),
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

export function deathNotice(ctx: Ctx, dead: Character, heir: Character | undefined, extinct: boolean): DeathNotice {
  return {
    name: dead.name,
    age: ageOf(ctx, dead, dead.deathDay ?? ctx.state.meta.day),
    year: yearOf(ctx, dead.deathDay ?? ctx.state.meta.day),
    cause: ctx.tags.label(dead.deathCause ?? 'situation:old_age'),
    ...(heir ? { heir: heir.name } : {}),
    extinct,
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

// ---------------------------------------------------------------------------
// หน้าผลของตัวเลือก: เก็บค่าก่อนเลือก แล้วเทียบหลังเลือก → "บุญ +0.5 · ความหนักใจ −8" และความรู้สึกของคนใน event
// ---------------------------------------------------------------------------

/** ความรู้สึกเปลี่ยนอย่างน้อยเท่านี้จึงเด้งหน้าผล (ไม่มีตัวเลือกเสี่ยง) */
const RESULT_MIN_SHIFT = 5;

interface ChoiceSnapshot {
  stats: Record<string, number>;
  /** "<role>|in" = คนนั้นรู้สึกต่อผู้เล่น, "<role>|out" = ผู้เล่นรู้สึกต่อคนนั้น */
  opinions: Record<string, number>;
  /** คนที่เงินนับรวมเป็นของผู้เล่นตอนก่อนเลือก — หลังเลือกนับคนชุดเดิม (แต่งงานแยกเรือนแล้วเงินพ่อไม่ได้หายไปไหน) */
  payers: Array<Character['id']>;
}

const STAT_LABEL: Record<string, [label: string, scale: number, digits: number, higherIsGood: boolean]> = {
  merit: ['บุญ', 1, 1, true],
  stress: ['ความหนักใจ', 100, 0, false],
  wealth: ['เงินทอง', 1, 0, true],
  favor: ['ความโปรดปรานของเจ้ากรม', 100, 0, true],
  prestige: ['บารมีตระกูล', 1, 1, true],
};

export function choiceSnapshot(ctx: Ctx, p: PreparedEvent, payers?: Array<Character['id']>): ChoiceSnapshot {
  const a = p.actor;
  const dyn = a.dynastyId ? ctx.state.dynasties[a.dynastyId] : undefined;
  const who = payers ?? funds(ctx, a).map((c) => c.id);
  const wealth = who.reduce((sum, id) => sum + Math.max(0, ctx.state.characters[id]?.social.wealth ?? 0), 0);
  const stats: Record<string, number> = { merit: a.merit, stress: a.stress, wealth, prestige: dyn?.prestige ?? 0 };
  if (a.office) stats['favor'] = a.office.favor;
  for (const [k, v] of Object.entries(a.skills)) stats[`skill:${k}`] = v;
  const opinions: Record<string, number> = {};
  for (const [role, id] of Object.entries(p.instance.bindings)) {
    if (role === 'actor' || id === a.id) continue;
    opinions[`${role}|in`] = opinion(ctx, id, a.id);
    opinions[`${role}|out`] = opinion(ctx, a.id, id);
  }
  return { stats, opinions, payers: who };
}

export function choiceResult(
  ctx: Ctx, p: PreparedEvent, before: ChoiceSnapshot, report: EventReport, text: TextTable,
): ChoiceResult | undefined {
  const vars = eventVars(ctx, p);
  const after = choiceSnapshot(ctx, p, before.payers);
  const changes: ChoiceResult['changes'] = [];
  for (const [k, v] of Object.entries(after.stats)) {
    const d = v - (before.stats[k] ?? 0);
    const [label, scale, digits, up] = STAT_LABEL[k]
      ?? [ctx.content.chores.skillLabels[k.slice(6)] ?? t(text, 'skill', k.slice(6)), 1, 0, true];
    const shown = d * scale;
    if (Math.abs(shown) < (digits ? 0.05 : 0.5)) continue;
    changes.push({ label, delta: `${shown > 0 ? '+' : '−'}${Math.abs(shown).toFixed(digits)}`, good: (shown > 0) === up });
  }
  const relations: ChoiceResult['relations'] = [];
  for (const [key, v] of Object.entries(after.opinions)) {
    const prev = before.opinions[key] ?? 0;
    if (v === prev) continue;
    const [role, dir] = key.split('|');
    const name = vars[role!] ?? role!;
    relations.push({ who: dir === 'in' ? `${name}รู้สึกต่อ${p.actor.name}` : `${p.actor.name}รู้สึกต่อ${name}`, before: prev, after: v });
  }
  const outcome = report.outcome?.textKey
    ? { text: fill(text[ageKey(ctx, p, report.outcome.textKey, text)] ?? report.outcome.textKey, vars), failed: report.outcome.failed }
    : undefined;
  // เปลี่ยนนิดเดียว (ช่วยงานบ้านทุกวัน) ไม่ต้องเด้งหน้าผล — บันทึกยังมีบรรทัดตามปกติ
  // ตัวเลือกเสี่ยงที่สำเร็จแต่เปลี่ยนแค่ความหนักใจ/บุญเล็กน้อย (ขอไปเล่นแล้วแม่ยอม) ไม่ต้องเด้ง — พลาดเด้งเสมอ
  const shifted = relations.some((r) => Math.abs(r.after - r.before) >= RESULT_MIN_SHIFT);
  const weighty = changes.some((c) => c.label !== STAT_LABEL.stress![0] && c.label !== STAT_LABEL.merit![0]);
  if (!shifted && !(outcome && (outcome.failed || weighty))) return undefined;
  const opt = p.options.find((o) => o.id === report.optionId);
  return {
    title: text[`${p.def.textKey}.title`] ?? p.def.id,
    did: opt ? fill(text[ageKey(ctx, p, opt.textKey, text)] ?? opt.textKey, { ...vars, ...opt.params }) : report.optionId,
    outcome, changes, relations,
  };
}

/** รายชื่อจากปุ่มหาคู่หรือรายชื่อบ่าวในเรือน — ใครบ้านไหน อยู่ไกลแค่ไหน นิสัยที่คนพูดถึง */
export function matchView(ctx: Ctx, mode: MatchView['mode'], people: Character[]): MatchView {
  return {
    mode,
    people: people.map((c) => {
      const p = c.personality;
      const said = mode === 'slave_wife'
        ? (p.agreeableness >= 0.65 ? 'ว่านอนสอนง่าย' : p.agreeableness <= 0.35 ? 'ปากจัด'
          : p.piety >= 0.7 ? 'ใฝ่บุญ' : p.boldness >= 0.65 ? 'ใจกล้า' : p.pride >= 0.7 ? 'ถือตัว'
          : p.resilience >= 0.65 ? 'สู้งาน' : p.imagination >= 0.65 ? 'ช่างคิด' : p.neuroticism >= 0.65 ? 'ขี้ตกใจ' : 'เรียบร้อย')
        : (p.agreeableness >= 0.65 ? 'ว่ากันว่าใจดี' : p.agreeableness <= 0.35 ? 'ว่ากันว่าปากจัด'
          : p.piety >= 0.7 ? 'ว่ากันว่าเข้าวัดเป็นนิจ' : p.boldness >= 0.65 ? 'ว่ากันว่าใจกล้า' : p.pride >= 0.7 ? 'ว่ากันว่าถือตัว' : '');
      const detail = mode === 'slave_wife'
        ? ['ทาสในเรือน', said].filter(Boolean).join(' · ')
        : [localOrigin(ctx, c), estateLabel(ctx, c.social.estate), DISTANCE_TH[c.local!.distance], said].filter(Boolean).join(' · ');
      return {
        id: c.id, nodeId: c.familyNodeId, name: c.name, age: ageOf(ctx, c),
        detail,
        portraitTags: portraitArtTags({ sex: c.sex, age: ageOf(ctx, c), topknotCut: true, estate: c.social.estate, roles: [] }),
      };
    }),
  };
}

/** แผงเรือนของผู้เล่น — เงินเข้าออกต่อเดือน ขยายเรือน ซื้อที่นา และสั่งงานทาสในเรือน */
function householdView(ctx: Ctx, ch: Character): HouseholdView | undefined {
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  if (!hh) return undefined;
  const S = ctx.state;
  const head = S.characters[hh.headId];
  const r = hh.retainers;
  const m = householdMonth(ctx, hh);
  // เก็บและจ่ายทุกเดือน แต่ยอดต่อเดือนเล็กจนอ่านยาก — แสดงเป็นยอดต่อปี
  const money = (perMonth: number) => { const y = perMonth * 12; return (y >= 10 ? Math.round(y) : Math.round(y * 10) / 10).toString(); };
  const members = houseMembersCount(ctx, hh);
  const cap = houseCapacity(ctx, hh);
  const tierDef = houseTierOf(hh);
  const crowded = members > cap;
  const landPlots = landOf(ctx, hh);
  const lines = [
    `คนในเรือน ${members}/${cap} คน${crowded ? ' (เรือนคับแคบ คนในเรือนอึดอัดใจ)' : ''} — ค่ากินอยู่ปีละ ${money(m.upkeep)} ตำลึง`,
  ];
  if (landPlots > 0) {
    lines.push(`ที่นาและสวน ${landPlots} แปลง — ผลผลิตปีละ ${money(m.landYield)} ตำลึง`);
  }
  if (r?.that) {
    const taskName = SLAVE_TASK_TH[hh.slaveTask ?? 'farm'].label;
    lines.push(`ทาส ${r.that} คน (${loyaltyText(r.loyalty)} · หน้าที่: ${taskName}) — ค่าเลี้ยงดูปีละ ${money(m.slaveCost)} · ทำเงินได้ปีละ ${money(m.slaveYield)} ตำลึง`);
  }
  if (r?.phrai) lines.push(`ไพร่ในสังกัด ${r.phrai} คน — ของกำนัลปีละ ${money(m.phraiGifts)} ตำลึง`);
  const net = m.slaveYield + m.phraiGifts + m.landYield - m.upkeep - m.slaveCost;
  lines.push(`รวมเรือนนี้ ${net >= 0 ? 'ได้' : 'เสีย'}ปีละ ${money(Math.abs(net))} ตำลึง หักและรับทุกเดือน (ไม่นับเบี้ยหวัดราชการ)`);
  const C = ctx.content.balance.servants.care;
  const note = (id: keyof typeof C) => id === 'stingy' ? 'ประหยัด แต่ทาสทำงานไม่เต็มมือ ป่วยตายและหนีง่าย ชาวบ้านติฉิน'
    : id === 'generous' ? 'จ่ายมาก ทาสรักนาย ทำงานดี อยู่ยาว ได้บุญ' : 'เลี้ยงดูพอสมควร';

  const manage = Boolean(canManage(ctx, ch));
  const totalPurse = purse(ctx, ch);
  const expCost = expandHouseCost(ctx, hh);
  const nextTier = HOUSE_TIERS.find((t) => t.tier === tierDef.tier + 1);
  const lCost = landCost(ctx, hh);
  const slaveBuyCost = 8;

  return {
    title: head && head.id !== ch.id ? `เรือนของ${head.name}` : 'เรือนของเรา',
    tierName: tierDef.name,
    tierDesc: tierDef.desc,
    members,
    capacity: cap,
    crowded,
    landPlots,
    lines,
    canManage: manage,
    expand: nextTier && expCost !== null ? {
      nextName: nextTier.name,
      nextCapacity: nextTier.capacity,
      cost: expCost,
      canAfford: manage && totalPurse >= expCost,
    } : undefined,
    buyLand: landPlots < landCap(hh) ? {
      cost: lCost,
      canAfford: manage && totalPurse >= lCost,
    } : undefined,
    slaveActions: manage ? {
      canBuy: totalPurse >= slaveBuyCost && (r?.that ?? 0) < slaveCapacity(ctx, hh),
      buyCost: slaveBuyCost,
      canFree: (r?.that ?? 0) > 0 && (hh.lastFreedDay === undefined || S.meta.day - hh.lastFreedDay >= 360),
    } : undefined,
    slaveConcubine: !slaveConcubineProblem(ctx, ch),
    care: r?.that && manage ? {
      current: hh.care ?? 'normal',
      options: (['stingy', 'normal', 'generous'] as const).map((id) => ({ id, label: CARE_TH[id], note: `ค่าเลี้ยงดูทาสคนละ ${C[id].cost} ตำลึงต่อปี · ${note(id)}` })),
    } : undefined,
    slaveTask: r?.that && manage ? {
      current: hh.slaveTask ?? 'farm',
      options: (['farm', 'house', 'guard'] as const).map((id) => ({ id, label: SLAVE_TASK_TH[id].label, note: SLAVE_TASK_TH[id].note })),
    } : undefined,
  };
}

export function interactionView(ctx: Ctx, targetId: string): InteractionView {
  const me = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const target = must(ctx.state.characters[targetId as Character['id']], 'คนนี้');
  return { name: target.name, actions: interactionsFor(ctx, me, target) };
}
