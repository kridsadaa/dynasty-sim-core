import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, CharacterId } from '../core/types';
import { familiarity, isSingle, setRelation, spawnLocal } from './acquaintance';
import { prepareEvent, type PreparedEvent } from './events';
import { livingSpouse } from './factory';
import { activeIntent, targetProblem } from './intent';
import { purse, spend } from './marriage';
import { minorWifeProposal } from './matchmaking';
import { livingWives, minorWifeProblem, takeMinorWife } from './wives';
import { adjustBond } from './will';

// ============================================================================
// เมนูตัวละคร (⋯) — สิ่งที่ผู้เล่นทำกับคนหนึ่งได้ตอนนี้ และเหตุผลถ้ายังทำไม่ได้
//
//  ทำความรู้จัก / เกี้ยว       → หน้าวางแผนของระบบความตั้งใจ (intent) — ชายมีเมียแล้วเกี้ยวได้ถ้ารับเมียน้อยไหว
//  สู่ขอเป็นเมียน้อย          → event รับเมียน้อย (ต้องคุ้นเคยกันก่อน)
//  ให้ของกำนัล                → คนนั้นรู้สึกดีขึ้น (ทำได้ทุก giftDays วัน)
//  ไปค้างเรือนเมีย/ดูแลผัว     → สนิทกันขึ้น ปีนี้มีลูกด้วยกันง่ายขึ้น เมียคนอื่นน้อยใจ
//  จ้างคนลอบฆ่า              → event วางแผน (เฉพาะคนนอกตระกูล) — สำเร็จแล้วบาปติดตัว พลาดแล้วความแตก
//  ตัวเลขทั้งหมดเป็นค่าของเกม
// ============================================================================

export type InteractionId = 'befriend' | 'court' | 'minor_wife' | 'gift' | 'visit' | 'assassin';

export interface Interaction {
  id: InteractionId;
  label: string;
  /** ทำไม่ได้ตอนนี้ — เหตุผล (ปุ่มยังแสดงแต่กดไม่ได้) */
  problem?: string;
  /** ข้อความสั้นใต้ปุ่ม: ราคา ผลที่คาดได้ */
  hint?: string;
}

const lastKey = (id: InteractionId, target: Character) => `${id}@${target.id}`;

function waitText(ctx: Ctx, me: Character, id: InteractionId, target: Character, days: number): string | undefined {
  const last = me.lastActs?.[lastKey(id, target)];
  const left = last === undefined ? 0 : last + days - ctx.state.meta.day;
  return left > 0 ? `เพิ่งทำไป รออีกราว ${Math.ceil(left / 30)} เดือน` : undefined;
}

/** ผัว/เมียของ me ที่อยู่ด้วยกัน */
const isMySpouse = (ctx: Ctx, me: Character, other: Character) =>
  me.sex === 'm' ? livingWives(ctx, me).some((w) => w.id === other.id) : livingSpouse(ctx, me)?.id === other.id;

export function interactionsFor(ctx: Ctx, me: Character, target: Character): Interaction[] {
  const B = ctx.content.balance.interactions;
  if (!isAlive(me) || !isAlive(target) || me.id === target.id) return [];
  const out: Interaction[] = [];
  const intents = ctx.content.intents;
  const reason = (p: string | null) => (p ? { invalid: 'ทำกับคนนี้ไม่ได้', age: 'ยังเด็กเกินไป', young: 'อีกฝ่ายยังเด็ก', friends: 'สนิทกันแล้ว',
    married: 'มีคู่อยู่แล้ว', betrothed: 'หมั้นหมายอยู่', taken: 'อีกฝ่ายมีคู่แล้ว' }[p] ?? p : undefined);
  const busy = (kind: string) => activeIntent(ctx, me.id)?.targetId === target.id && activeIntent(ctx, me.id)?.kind === kind ? 'กำลังทำอยู่' : undefined;

  if (target.local && intents['befriend']) {
    out.push({ id: 'befriend', label: 'ตีสนิท', problem: busy('befriend') ?? reason(targetProblem(ctx, intents['befriend'], me, target)) });
  }
  if (target.local && intents['court'] && target.sex !== me.sex) {
    const married = !!livingSpouse(ctx, me);
    out.push({
      id: 'court', label: married ? 'เกี้ยว (หมายเป็นเมียน้อย)' : 'เกี้ยว',
      // มีเมียแล้ว: บอกเหตุที่รับเมียเพิ่มไม่ได้ก่อน (เงิน วัย) — ชัดกว่า 'มีคู่อยู่แล้ว'
      problem: busy('court') ?? (married ? minorWifeProblem(ctx, me) ?? undefined : undefined) ?? reason(targetProblem(ctx, intents['court'], me, target)),
    });
  }
  if (target.local && me.sex === 'm' && target.sex === 'f' && livingSpouse(ctx, me)) {
    const problem = minorWifeProblem(ctx, me)
      ?? (!isSingle(ctx, target) ? 'อีกฝ่ายมีคู่แล้ว' : ageOf(ctx, target) < 15 ? 'อีกฝ่ายยังเด็ก'
        : familiarity(ctx, me.id, target.id) < B.minorWifeFamiliarity ? 'ยังไม่คุ้นเคยกันพอ — ลองเกี้ยวก่อน' : null);
    out.push({ id: 'minor_wife', label: 'สู่ขอเป็นเมียน้อย', problem: problem ?? undefined, hint: 'เสียเงินและเมียหลวงไม่พอใจ' });
  }
  if (isMySpouse(ctx, me, target)) {
    out.push({
      id: 'visit', label: me.sex === 'm' ? `ไปค้างเรือน${target.name}` : `ดูแลเอาใจ${target.name}`,
      problem: waitText(ctx, me, 'visit', target, B.visitDays),
      hint: me.sex === 'm' && livingWives(ctx, me).length > 1 ? 'สนิทกันขึ้น ปีนี้มีลูกง่ายขึ้น · เมียคนอื่นน้อยใจ' : 'สนิทกันขึ้น ปีนี้มีลูกง่ายขึ้น',
    });
  }
  out.push({
    id: 'gift', label: 'ให้ของกำนัล', hint: `${B.giftCost} ตำลึง · ${target.name}รู้สึกดีขึ้น`,
    problem: waitText(ctx, me, 'gift', target, B.giftDays) ?? (ageOf(ctx, me) < 12 ? 'ยังเด็กเกินไป'
      : purse(ctx, me) < B.giftCost ? 'เงินไม่พอ' : undefined),
  });
  if (target.local) {
    out.push({
      id: 'assassin', label: 'จ้างคนลอบฆ่า', hint: 'บาปหนัก · ถ้าความแตกเสียทั้งตำแหน่งและหน้าตา',
      problem: ageOf(ctx, me) < 18 ? 'ยังเด็กเกินไป' : ageOf(ctx, target) < 12 ? 'ไม่ทำกับเด็ก' : undefined,
    });
  }
  return out;
}

export type InteractionResult = { plan: string } | { event: PreparedEvent } | { lines: string[] };

export function performInteraction(ctx: Ctx, me: Character, target: Character, id: InteractionId): InteractionResult {
  const B = ctx.content.balance.interactions;
  const act = interactionsFor(ctx, me, target).find((a) => a.id === id);
  if (!act) throw new Error('ทำกับคนนี้ไม่ได้');
  if (act.problem) throw new Error(act.problem);
  const day = ctx.state.meta.day;
  const mark = () => ((me.lastActs ??= {})[lastKey(id, target)] = day);
  switch (id) {
    case 'befriend':
    case 'court':
      return { plan: id };
    case 'minor_wife':
      return { event: minorWifeProposal(ctx, me, target) };
    case 'assassin':
      return { event: prepareEvent(ctx, 'scheme.assassin', { actor: me.id, target: target.id }) };
    case 'gift': {
      const paid = spend(ctx, me, B.giftCost);
      const cur = ctx.state.relations[`${target.id}|${me.id}|gratitude`]?.strength ?? 0;
      setRelation(ctx, target.id, me.id, 'gratitude', cur + B.giftGratitude);
      const fam = familiarity(ctx, me.id, target.id);
      if (target.local) setRelation(ctx, me.id, target.id, 'acquaintance', Math.min(1, fam + 0.05));
      mark();
      return { lines: [`${me.name}ส่งของกำนัลไปให้${target.name} ${Math.round(paid)} ตำลึง`] };
    }
    case 'visit': {
      adjustBond(ctx, target, me, 'affection', B.visitAffection);
      const wife = me.sex === 'm' ? target : me;
      wife.favoredUntil = day + 365;
      const lines = [me.sex === 'm' ? `${me.name}ไปค้างเรือน${target.name}หลายคืน` : `${me.name}ดูแลเอาใจ${target.name}`];
      if (me.sex === 'm') {
        for (const w of livingWives(ctx, me)) {
          if (w.id === target.id) continue;
          adjustBond(ctx, w, me, 'affection', -B.visitJealousy);
          lines.push(`${w.name}น้อยใจ`);
        }
      }
      mark();
      return { lines };
    }
  }
}

/**
 * รับทาสหญิงในเรือนเป็นเมียน้อย — ทาสเป็นจำนวนในเรือน จึงสร้างตัวคนขึ้นมาตอนนี้ (สถานะทาส)
 * ทาสหญิงที่มีบุตรกับนายพ้นจากความเป็นทาส (lore: social.slavery_as_strategy — deliverBirths จัดการ)
 */
export function slaveConcubineProblem(ctx: Ctx, me: Character): string | null {
  const hh = me.householdId ? ctx.state.households[me.householdId] : undefined;
  if (me.sex !== 'm' || !hh || hh.headId !== me.id) return 'ต้องเป็นหัวเรือน';
  if (!hh.retainers?.that) return 'ในเรือนไม่มีทาส';
  if (livingWives(ctx, me).length >= ctx.content.balance.matchmaking.maxWives) return 'มีเมียมากพอแล้ว';
  const age = ageOf(ctx, me);
  return age < ctx.content.balance.wives.age[0] ? 'ไม่อยู่ในวัยที่จะรับเมียเพิ่ม' : null;
}

export function takeSlaveConcubine(ctx: Ctx, me: Character): string[] {
  const no = slaveConcubineProblem(ctx, me);
  if (no) throw new Error(no);
  const hh = ctx.state.households[me.householdId!]!;
  const B = ctx.content.balance;
  const that = ctx.content.trades.find((t) => t.estate === 'that');
  const woman = spawnLocal(ctx, me, {
    sex: 'f', distance: 'near', single: true, ...(that ? { trade: that } : {}),
    age: B.wives.wifeAge[0] + Math.floor(ctx.rng.range(0, B.wives.wifeAge[1] - B.wives.wifeAge[0] + 1)),
  });
  woman.social.estate = 'that';
  hh.retainers!.that--;
  const lines = [takeMinorWife(ctx, me, woman)];
  // เมียหลวงรับไม่ได้ที่ผัวยกทาสในเรือนขึ้นมาเทียบ — หนักกว่ารับเมียน้อยจากนอกบ้าน
  for (const w of livingWives(ctx, me)) {
    if (w.id === woman.id) continue;
    adjustBond(ctx, w, me, 'affection', -B.interactions.slaveConcubineHurt);
    setRelation(ctx, w.id, woman.id, 'grudge', 0.5);
  }
  return [...lines, 'เมียหลวงไม่พอใจหนัก'];
}

export const interactionTarget = (ctx: Ctx, id: string) => ctx.state.characters[id as CharacterId];
