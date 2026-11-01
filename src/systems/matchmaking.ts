import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, CharacterId } from '../core/types';
import { familiarity, forgetLocal, setRelation, spawnLocal } from './acquaintance';
import { prepareEvent, type PreparedEvent } from './events';
import { inLawNames, livingSpouse, spouseAgeFor } from './factory';
import { activeIntent } from './intent';
import { livingWives, minorWifeProblem } from './wives';

// ============================================================================
// หาคู่ — ผู้เล่นถามผู้ใหญ่ที่รู้จักหลายบ้านว่าบ้านไหนมีลูกหลานยังไม่ออกเรือน ได้รายชื่อมาดูตัว
//
//  ยังไม่มีคู่ → เลือกคนแล้วไปเกี้ยว/ฝากผู้ใหญ่ทาบทามตามระบบความตั้งใจเดิม (intent court)
//  ชายที่มีเมียแล้วและมีเงินพอ → เลือกหญิงมารับเป็นเมียน้อย (event marriage.minor_wife เดิม)
//  คนในรายชื่อที่ไม่ได้เลือกห่างหายไป ไม่ค้างในรายชื่อคนรู้จัก · ถามหาได้ทุก searchDays วัน
//  จำนวนคน ระยะห่างการถาม และสัดส่วนชนชั้นเป็นค่าของเกม
// ============================================================================

export type MatchMode = 'court' | 'minor_wife';

/** ทำไมยังหาคู่ไม่ได้ — null = หาได้ */
export function matchProblem(ctx: Ctx, me: Character): { mode: MatchMode } | { problem: string } {
  const B = ctx.content.balance;
  const age = ageOf(ctx, me);
  const wait = (me.matchSearchDay ?? -Infinity) + B.matchmaking.searchDays - ctx.state.meta.day;
  if (wait > 0) return { problem: `เพิ่งถามหาไป รออีกราว ${Math.ceil(wait / 30)} เดือน` };
  if (me.betrothal || me.eloped) return { problem: 'หมั้นหมายหรือมีคนอยู่ด้วยแล้ว' };
  if (!livingSpouse(ctx, me)) {
    if (age < B.world.marriageAge[me.sex][0]) return { problem: 'ยังไม่ถึงวัยออกเรือน' };
    const cur = activeIntent(ctx, me.id);
    if (cur && ctx.content.intents[cur.kind]?.target === 'court') return { problem: 'กำลังเกี้ยวคนอื่นอยู่' };
    return { mode: 'court' };
  }
  const no = minorWifeProblem(ctx, me);
  return no ? { problem: no } : { mode: 'minor_wife' };
}

/** ได้รายชื่อมาดูตัว — คนที่ยังไม่มีคู่ ต่างเพศ อายุพอเหมาะ ส่วนใหญ่ฐานะใกล้กัน */
export function findMatches(ctx: Ctx, me: Character): { mode: MatchMode; people: Character[] } {
  const m = matchProblem(ctx, me);
  if ('problem' in m) throw new Error(m.problem);
  const B = ctx.content.balance;
  me.matchSearchDay = ctx.state.meta.day;
  const sex = me.sex === 'm' ? 'f' : 'm';
  const age = ageOf(ctx, me);
  const avoid = inLawNames(ctx, me);
  const sameEstate = ctx.content.trades.filter((t) => t.estate === me.social.estate);
  const people: Character[] = [];
  for (let i = 0; i < B.matchmaking.candidates; i++) {
    const own = sameEstate.length && ctx.rng.chance(B.matchmaking.sameEstateShare);
    const trade = ctx.rng.weighted(own ? sameEstate : ctx.content.trades, (t) => t.weight);
    const otherAge = m.mode === 'minor_wife'
      ? B.wives.wifeAge[0] + Math.floor(ctx.rng.range(0, B.wives.wifeAge[1] - B.wives.wifeAge[0] + 1))
      : spouseAgeFor(ctx, sex, age);
    const ch = spawnLocal(ctx, me, {
      sex, age: otherAge, distance: ctx.rng.chance(0.5) ? 'near' : 'town', trade: trade ?? undefined, single: true,
      avoid: new Set([...avoid, ...people.map((p) => p.name)]),
    });
    setRelation(ctx, me.id, ch.id, 'acquaintance', 0.05);
    people.push(ch);
  }
  return { mode: m.mode, people };
}

/** คนในรายชื่อที่ไม่ได้เลือก → ห่างหายไป (ยังไม่สนิทและไม่ได้เป็นเป้าของความตั้งใจ) */
export function dropMatches(ctx: Ctx, me: Character, ids: CharacterId[], keep?: CharacterId): void {
  const targets = new Set(Object.values(ctx.state.intents).map((i) => i.targetId));
  for (const id of ids) {
    const ch = ctx.state.characters[id];
    if (!ch?.local || id === keep || targets.has(id) || familiarity(ctx, me.id, id) > 0.05) continue;
    forgetLocal(ctx, ch);
  }
}

/** เลือกหญิงจากรายชื่อมาเป็นเมียน้อย → event รับเมียน้อยเดิม (ค่าใช้จ่าย เมียหลวงไม่พอใจ) */
export function minorWifeProposal(ctx: Ctx, me: Character, other: Character): PreparedEvent {
  const m = matchProblem(ctx, { ...me, matchSearchDay: undefined });
  if ('problem' in m || m.mode !== 'minor_wife') throw new Error('problem' in m ? m.problem : 'ตอนนี้รับเมียน้อยไม่ได้');
  if (!isAlive(other) || !other.local || other.local.wed) throw new Error(`${other.name}ออกเรือนไปแล้ว`);
  const wife = livingWives(ctx, me).find((w) => w.wifeRank !== 'minor') ?? livingWives(ctx, me)[0]!;
  return prepareEvent(ctx, 'marriage.minor_wife', { actor: me.id, spouse: wife.id, other: other.id });
}
