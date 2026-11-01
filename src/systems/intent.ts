import { yearsToDays } from '../core/calendar';
import { ageOf, isAlive, must, newId, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, Estate, Intent, IntentApproachDef, IntentDef, IntentKindId } from '../core/types';
import { DISTANCE_TH, familiarity, isSingle, relationStrength, setRelation, spawnLocal, tradeOf } from './acquaintance';
import { scarModifiers } from './body';
import { prepareEvent, type PreparedEvent } from './events';
import { inLawNames, livingParents, livingSpouse, spouseAgeFor } from './factory';
import { livingWives, minorWifeProblem } from './wives';
import { officeLabor } from './career';
import { serviceLabor } from './marriage';
import { hasPerk } from './skills';
import { adjustBond } from './will';

// ============================================================================
// Intent — ความตั้งใจระยะยาวต่อคนหนึ่งคน (แบบ scheme ของเกมกลยุทธ์ราชวงศ์ ปรับให้เป็นชีวิตชาวบ้านอยุธยา)
//
//  เลือกคน + สิ่งที่ตั้งใจ (ผูกมิตร / เกี้ยว) + วิธี ──► เห็นโอกาสสำเร็จ เวลาโดยประมาณ และสิ่งที่ต้องแลก
//  ทุกเดือน: progress += 1/months · แรงงานหายจากเรือน (ต้องจ้างคนแทน พ่อแม่บ่น) · รู้จักกันมากขึ้น
//            · ได้ทักษะอาชีพบ้านเขา · อาจมี event แทรก (ลองใจ ทางบ้านตามตัว คำคน)
//  ครบ → ทอยโอกาส → event สำเร็จ/ไม่สำเร็จ (เกี้ยวสำเร็จ = สู่ขอแต่งงานได้)
//
//  แรงงาน (labor) ขึ้นกับวิธีและระยะทาง: เพื่อนบ้านแวะไปหาได้ไม่เสียงาน
//  แต่ไปช่วยงานบ้านคนต่างเมือง = ย้ายไปอยู่ที่นั่น เรือนตัวเองขาดคนทั้งคน (labor 1)
// ============================================================================

const MID_EVENT_REPEAT_DAYS = 3 * 360;

const ESTATE_RANK: Record<Estate, number> = {
  royal: 6, noble: 5, monk: 4, merchant: 3, foreigner: 3, phrai_luang: 2, phrai_som: 2, that: 0,
};

export interface OddsFactor {
  key: string;
  value: number;
}

export interface ApproachPlan {
  def: IntentApproachDef;
  /** เหตุผลที่ใช้วิธีนี้ไม่ได้ (key ใน text: intent.unavailable.*) */
  unavailable?: 'far' | 'age' | 'sex' | 'elder' | 'money';
  odds: number;
  factors: OddsFactor[];
  months: number;
  labor: number;
  /** ค่าจ้างคนแทนต่อเดือนที่เรือนต้องจ่าย */
  monthlyCost: number;
}

export function activeIntent(ctx: Ctx, actorId: Character['id']): Intent | undefined {
  return Object.values(ctx.state.intents).find((i) => i.actorId === actorId);
}

function approachOf(ctx: Ctx, i: Intent): { def: IntentDef; ap: IntentApproachDef } {
  const def = must(ctx.content.intents[i.kind], i.kind);
  return { def, ap: must(def.approaches.find((a) => a.id === i.approach), i.approach) };
}

/** สัดส่วนแรงงานที่ ch ไม่ได้อยู่ช่วยเรือนตัวเอง (1 = ย้ายไปอยู่ใกล้บ้านคนอื่น) */
export function awayLabor(ctx: Ctx, ch: Character): number {
  const i = activeIntent(ctx, ch.id);
  const target = i && ctx.state.characters[i.targetId];
  const intentLabor = i && target?.local ? approachOf(ctx, i).ap.by[target.local.distance]?.labor ?? 0 : 0;
  return Math.max(intentLabor, serviceLabor(ch), officeLabor(ctx, ch));
}

/** ใครจ่ายค่าจ้างคนแทน: หัวเรือนที่ ch อยู่ (มักเป็นพ่อ) ถ้าไม่มีก็ ch เอง */
function payer(ctx: Ctx, ch: Character): Character {
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  const head = hh ? ctx.state.characters[hh.headId] : undefined;
  return isAlive(head) ? head : ch;
}

/** ทำ intent นี้กับคนนี้ได้ไหม — คืนเหตุผลถ้าไม่ได้ */
export function targetProblem(ctx: Ctx, def: IntentDef, actor: Character, target: Character): string | null {
  if (!isAlive(actor) || !isAlive(target) || actor.id === target.id || !target.local) return 'invalid';
  if (ageOf(ctx, actor) < def.minAge) return 'age';
  if (def.target === 'befriend') {
    return relationStrength(ctx, actor.id, target.id, 'friend') >= 0.5 ? 'friends' : null;
  }
  if (target.sex === actor.sex) return 'invalid';
  if (ageOf(ctx, target) < def.minAge) return 'young';
  // ชายที่มีเมียแล้วเกี้ยวหญิงอื่นได้ถ้ารับเมียน้อยไหว — สำเร็จแล้วรับเป็นเมียน้อย (ดู tickIntents)
  if (livingSpouse(ctx, actor) && minorWifeProblem(ctx, actor)) return 'married';
  if (actor.betrothal || actor.eloped) return 'betrothed';
  if (!isSingle(ctx, target)) return 'taken';
  return null;
}

/**
 * โอกาสสำเร็จ แจกแจงเป็นข้อๆ ให้ผู้เล่นเห็นว่าอะไรช่วย อะไรขวาง
 * formal (ฝากผู้ใหญ่ทาบทาม): บ้านเรามีหน้ามีตากว่ากลับเป็นข้อดี, รู้จักกันมาก่อนมีผลน้อย, ความกล้าไม่เกี่ยว
 */
function odds(ctx: Ctx, def: IntentDef, ap: IntentApproachDef, actor: Character, target: Character, bonus: number) {
  const I = ctx.content.balance.intent;
  const f: OddsFactor[] = [{ key: 'base', value: def.baseOdds }];
  const push = (key: string, value: number) => {
    if (Math.abs(value) >= 0.01) f.push({ key, value });
  };
  push('approach', ap.odds);
  const fam = (familiarity(ctx, actor.id, target.id) - 0.5) * (ap.formal ? 0.2 : 0.4);
  push(fam >= 0 ? 'familiar' : 'stranger', fam);
  const agr = (target.personality.agreeableness - 0.5) * 0.3;
  push(agr >= 0 ? 'agreeable' : 'aloof', agr);
  // ฐานะต่างกันขวางการเป็นเพื่อนน้อยกว่าการเป็นคู่ครอง (ผู้ใหญ่สองบ้านไม่ต้องตกลงกัน)
  const gap = ESTATE_RANK[actor.social.estate] - ESTATE_RANK[target.social.estate];
  const gapWeight = I.estateGapPenalty * (def.target === 'befriend' ? 0.5 : 1);
  if (ap.formal && gap > 0) push('estate_high', gap * gapWeight);
  else push('estate_gap', -Math.abs(gap) * gapWeight * (ap.formal ? 2 : 1));
  if (!ap.formal) {
    const bold = (actor.personality.boldness - 0.5) * 0.2;
    push(bold >= 0 ? 'bold' : 'shy', bold);
  }
  if (hasPerk(actor, 'diplomacy_1')) push('speech', 0.12);
  else if ((actor.skills['speech'] ?? 0) >= 15) push('speech', Math.min(0.1, (actor.skills['speech'] ?? 0) * 0.002));
  if (def.target === 'befriend') {
    const story = scarModifiers(ctx, actor, new Set())
      .filter((m) => m.stat === 'social:story_hook' && m.op === 'add')
      .reduce((a, m) => a + m.value, 0);
    push('story', Math.min(story, 0.3) * 0.5);
  }
  if (def.target === 'court') {
    const attraction = scarModifiers(ctx, actor, new Set())
      .filter((m) => m.stat === 'social:attraction' && m.op === 'add')
      .reduce((a, m) => a + m.value, 0);
    push('scar', attraction * 0.5);
    const ageGap = Math.abs(ageOf(ctx, actor) - ageOf(ctx, target)) - 6;
    if (ageGap > 0) push('age_gap', -0.03 * ageGap);
  }
  push('events', bonus);
  const [lo, hi] = I.oddsRange;
  return { odds: Math.min(hi, Math.max(lo, f.reduce((a, x) => a + x.value, 0))), factors: f };
}

export function planIntent(ctx: Ctx, kind: IntentKindId, actor: Character, target: Character): ApproachPlan[] {
  const def = must(ctx.content.intents[kind], kind);
  const I = ctx.content.balance.intent;
  const dist = must(target.local, 'local').distance;
  const fam = familiarity(ctx, actor.id, target.id);
  const age = ageOf(ctx, actor);
  const pays = payer(ctx, actor);
  return def.approaches.map((ap) => {
    const by = ap.by[dist];
    const { odds: o, factors } = odds(ctx, def, ap, actor, target, 0);
    const plan: ApproachPlan = {
      def: ap, odds: o, factors,
      months: by ? Math.max(1, Math.round(by.months * (1.25 - 0.5 * fam))) : 0,
      labor: by?.labor ?? 0,
      monthlyCost: (by?.labor ?? 0) * I.laborValue[pays.social.estate],
    };
    if (!by) plan.unavailable = 'far';
    else if (ap.sex && ap.sex !== actor.sex) plan.unavailable = 'sex';
    else if (age < (ap.minAge ?? 0) || (by.labor >= 1 && age < I.relocateMinAge)) plan.unavailable = 'age';
    else if (ap.formal && !livingParents(ctx, actor).length) plan.unavailable = 'elder';
    else if ((ap.cost ?? 0) > Math.max(actor.social.wealth, pays.social.wealth)) plan.unavailable = 'money';
    return plan;
  });
}

export function startIntent(ctx: Ctx, kind: IntentKindId, actor: Character, target: Character, approachId: string): string[] {
  const def = must(ctx.content.intents[kind], kind);
  const problem = targetProblem(ctx, def, actor, target);
  if (problem) throw new Error(`ทำไม่ได้กับ${target.name} (${problem})`);
  const plan = must(planIntent(ctx, kind, actor, target).find((p) => p.def.id === approachId), approachId);
  if (plan.unavailable) throw new Error(`วิธีนี้ใช้ไม่ได้ (${plan.unavailable})`);
  const out = abandonIntent(ctx, actor);
  const cost = plan.def.cost ?? 0;
  if (cost) {
    const from = actor.social.wealth >= cost ? actor : payer(ctx, actor);
    from.social.wealth -= cost;
    out.push(from === actor ? `จ่ายไป ${cost} ตำลึง` : `ขอเงิน${from.name}มา ${cost} ตำลึง`);
  }
  const intent: Intent = {
    id: newId(ctx, 'int'), kind, approach: approachId, actorId: actor.id, targetId: target.id,
    startDay: ctx.state.meta.day, progress: 0, months: plan.months, bonus: 0,
  };
  ctx.state.intents[intent.id] = intent;
  if (plan.labor >= 1) out.push(`${actor.name}ย้ายไปอยู่ใกล้บ้าน${target.name} ${DISTANCE_TH[target.local!.distance]} — เรือนขาดแรงงานไปหนึ่งคน`);
  return out;
}

export function abandonIntent(ctx: Ctx, actor: Character): string[] {
  const i = activeIntent(ctx, actor.id);
  if (!i) return [];
  delete ctx.state.intents[i.id];
  const target = ctx.state.characters[i.targetId];
  return target ? [`เลิกความตั้งใจต่อ${target.name}`] : [];
}

export interface IntentStatus {
  intent: Intent;
  def: IntentDef;
  approach: IntentApproachDef;
  target: Character;
  odds: number;
  factors: OddsFactor[];
  monthsLeft: number;
  labor: number;
  monthlyCost: number;
}

export function intentStatus(ctx: Ctx, actor: Character): IntentStatus | null {
  const i = activeIntent(ctx, actor.id);
  const target = i && ctx.state.characters[i.targetId];
  if (!i || !target?.local) return null;
  const { def, ap } = approachOf(ctx, i);
  const { odds: o, factors } = odds(ctx, def, ap, actor, target, i.bonus);
  const labor = ap.by[target.local.distance]?.labor ?? 0;
  return {
    intent: i, def, approach: ap, target, odds: o, factors,
    monthsLeft: Math.max(0, Math.ceil((1 - i.progress) * i.months)),
    labor, monthlyCost: labor * ctx.content.balance.intent.laborValue[payer(ctx, actor).social.estate],
  };
}

/** พ่อหรือแม่ที่ยังมีชีวิต — อยู่เรือนเดียวกันก่อน (คนที่บ่น/ตามตัวกลับ) */
function elderOf(ctx: Ctx, ch: Character): Character | undefined {
  const parents = livingParents(ctx, ch);
  return parents.find((p) => p.householdId === ch.householdId) ?? parents[0];
}

function bindings(ctx: Ctx, actor: Character, target: Character) {
  const elder = elderOf(ctx, actor);
  return { actor: actor.id, target: target.id, ...(elder ? { elder: elder.id } : {}) };
}

/** เดือนละครั้ง */
export function tickIntents(ctx: Ctx): { lines: string[]; events: PreparedEvent[] } {
  const S = ctx.state;
  const I = ctx.content.balance.intent;
  const lines: string[] = [];
  const events: PreparedEvent[] = [];
  for (const i of Object.values(S.intents)) {
    const actor = S.characters[i.actorId];
    const target = S.characters[i.targetId];
    // ผู้เล่นเปลี่ยนรุ่นแล้ว — ความตั้งใจของคนก่อนจบไปกับเขา
    if (!isAlive(actor) || actor.id !== S.meta.playerCharacterId) {
      delete S.intents[i.id];
      continue;
    }
    const { def, ap } = approachOf(ctx, i);
    const problem = target ? targetProblem(ctx, def, actor, target) : 'invalid';
    if (!isAlive(target) || problem) {
      delete S.intents[i.id];
      if (!target) continue;
      lines.push(
        !isAlive(target) ? `${target.name}ถึงแก่กรรม ความตั้งใจของ${actor.name}จึงจบลง`
          : problem === 'taken' ? `${target.name}ออกเรือนไปกับคนอื่นเสียแล้ว`
            : problem === 'married' ? `${actor.name}มีคู่ครองแล้ว จึงเลิกเกี้ยว${target.name}`
              : problem === 'betrothed' ? `${actor.name}หมั้นหมายแล้ว จึงเลิกเกี้ยว${target.name}`
              : `เลิกความตั้งใจต่อ${target.name}`,
      );
      continue;
    }

    // ชีวิตประจำวันที่เปลี่ยนไป
    const labor = ap.by[target.local!.distance]?.labor ?? 0;
    if (labor > 0) {
      const p = payer(ctx, actor);
      const cost = labor * I.laborValue[p.social.estate];
      const paid = Math.min(cost, Math.max(0, p.social.wealth));
      p.social.wealth -= paid;
      if (paid < cost) actor.stress = clamp01(actor.stress + 0.02); // ไม่มีเงินจ้างคนแทน งานที่บ้านค้าง
      for (const parent of livingParents(ctx, actor)) {
        if (parent.householdId === actor.householdId) adjustBond(ctx, actor, parent, 'affection', I.awayAffectionPerMonth * labor);
      }
      const trade = tradeOf(ctx, target);
      if (trade && ap.learnTrade) actor.skills[trade.skill] = Math.min(100, (actor.skills[trade.skill] ?? 0) + ap.learnTrade * labor);
    }
    setRelation(ctx, actor.id, target.id, 'acquaintance', Math.min(1, familiarity(ctx, actor.id, target.id) + I.familiarityPerMonth * (0.5 + labor)));
    i.progress = Math.min(1, i.progress + 1 / i.months);

    if (i.progress >= 1) {
      delete S.intents[i.id];
      const { odds: o } = odds(ctx, def, ap, actor, target, i.bonus);
      const won = ctx.rng.chance(o);
      const wife = def.target === 'court' && won ? livingWives(ctx, actor).find((w) => w.wifeRank !== 'minor') : undefined;
      // มีเมียหลวงอยู่แล้ว → หญิงที่เกี้ยวได้ใจมาเป็นเมียน้อย (เมียหลวงย่อมไม่พอใจ)
      if (wife) events.push(prepareEvent(ctx, 'marriage.minor_wife', { actor: actor.id, spouse: wife.id, other: target.id }));
      else events.push(prepareEvent(ctx, won ? ap.success ?? def.success : def.failure, bindings(ctx, actor, target)));
      continue;
    }
    if (ctx.rng.chance(I.midEventChance)) {
      const age = ageOf(ctx, actor);
      const hasElder = !!elderOf(ctx, actor);
      // เรื่องเดิมไม่วนกลับมาภายใน MID_EVENT_REPEAT_DAYS — เด็กตีสนิทเพื่อนหลายคนติดกันจะได้ไม่เจอแต่เรื่องขโมยมะม่วง
      const seen = new Set(Object.values(S.eventLog)
        .filter((e) => e.bindings.actor === actor.id && S.meta.day - e.day < MID_EVENT_REPEAT_DAYS)
        .map((e) => e.defId));
      const fits = def.midEvents.filter((m) =>
        (!m.approaches || m.approaches.includes(ap.id)) && (!m.needsElder || hasElder)
        && labor >= (m.minLabor ?? 0) && age <= (m.maxAge ?? Infinity) && !seen.has(m.event));
      const pick = ctx.rng.pick(fits);
      if (pick) events.push(prepareEvent(ctx, pick.event, bindings(ctx, actor, target)));
    }
  }
  return { lines, events };
}

/**
 * ผู้เล่นถึงวัยแต่งงานแต่ยังไม่มีคู่และไม่ได้เกี้ยวใครอยู่ → ผู้ใหญ่ทาบทามคู่ที่ฐานะเท่ากันให้ (ปีละครั้งตามรอบ)
 * ปฏิเสธได้ (ถ้าไม่เกรงพ่อแม่จนไม่กล้าขัด) แล้วคนที่ถูกทาบทามกลายเป็นคนรู้จัก เกี้ยวเองทีหลังได้
 */
export function arrangedMatchEvent(ctx: Ctx): PreparedEvent | null {
  const S = ctx.state;
  const W = ctx.content.balance.world;
  const I = ctx.content.balance.intent;
  const player = S.characters[S.meta.playerCharacterId];
  if (!isAlive(player)) return null;
  const age = ageOf(ctx, player);
  if (age < W.marriageAge[player.sex][0] || age > I.arrangedMaxAge) return null;
  if ((S.familyNodes[player.familyNodeId]?.spouseIds.length ?? 0) > 0 || player.betrothal || player.eloped) return null;
  const current = activeIntent(ctx, player.id);
  if (current && ctx.content.intents[current.kind]?.target === 'court') return null;
  const since = yearsToDays(I.arrangedEveryYears);
  const recent = Object.values(S.eventLog).some(
    (e) => e.defId === 'family.arranged_match' && e.bindings.actor === player.id && S.meta.day - e.day < since,
  );
  if (recent) return null;

  // คู่ฐานะเดียวกัน จากต่างตำบล ไม่ซ้ำชื่อคนที่จะเป็นญาติเขย/สะใภ้ด้วยกัน
  const sex = player.sex === 'm' ? 'f' : 'm';
  const spouseAge = spouseAgeFor(ctx, sex, age);
  const sameEstate = ctx.content.trades.filter((t) => t.estate === player.social.estate);
  const trade = ctx.rng.weighted(sameEstate.length ? sameEstate : ctx.content.trades, (t) => t.weight);
  const match = spawnLocal(ctx, player, { sex, age: spouseAge, distance: 'town', trade, avoid: inLawNames(ctx, player), single: true });
  setRelation(ctx, player.id, match.id, 'acquaintance', 0.05);
  return prepareEvent(ctx, 'family.arranged_match', bindings(ctx, player, match));
}
