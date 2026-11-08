import { ageOf, isAlive, lunarOf, yearOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId, Effect } from '../core/types';
import { singlePeer } from './acquaintance';
import { atWar, campaignBindings } from './campaign';
import type { ChoreEventRequest } from './chores';
import { deptOf, officeRank, officeTier } from './career';
import { institutionActive } from './eras';
import { canCourt, companions } from './festivals';
import { adjustBond } from './will';

// ============================================================================
// ขบวนเรือหลวงต้นเดือน 12 (docs/design-barge-procession.md, PLAN ข้อ 15)
//  ปลายเดือน 11: ไพร่ชายวัยเกณฑ์ไม่มีตำแหน่งอาจได้หมายฝีพาย (barge.levy) — ไปเอง / ส่งลูกหรือญาติ / จ่ายแทน / หลบ (meta.barge)
//  ขึ้น 5 ค่ำ เดือน 12 วันขบวน — ปีละเรื่องหลักเดียวต่อผู้เล่น:
//   ขุนนาง → barge.official (เรือบอกยศและฝ่ายตาม lore) · ไพร่ที่ไปพายเอง → barge.rowing · คนอื่น → festival.barge_watch (ทำจนเป็นนิสัยได้)
//  งดปีที่ไม่มีขบวน: institutions.royalBargeProcession (งด 2308–2324) และปีที่มีหมายเกณฑ์ศึก/ศึกอยู่
//  lore: ritual.royal_balons_1680s, social.officer_rowers_from_band_1680s, ritual.kathin_water_procession_rama4 (attested)
//        event.barge_procession_options (invented — ความถี่ โอกาส ราคา รางวัล โทษ เป็นของเกมทั้งหมด)
// ============================================================================

/** ปีที่มีหมายเกณฑ์ศึก/ศึกอยู่ (ตาราง historyEvents ที่เป็นหมาย และ history ประเภท war) — งดขบวน (ผู้ใช้ตัดสิน 2026-11-08) */
function warYear(ctx: Ctx, year: number): boolean {
  return ctx.content.historyEvents.some((s) => s.year === year && !!s.event && /\.(levy|muster)$/.test(s.event))
    || ctx.content.history.some((h) => h.kind === 'war' && year >= h.year && year < h.year + (h.lasts ?? 1));
}

/** ปีนี้มีขบวนเรือหลวงไหม */
export function bargeYear(ctx: Ctx, year = yearOf(ctx, ctx.state.meta.day)): boolean {
  return institutionActive(ctx, 'royalBargeProcession', year) && !warYear(ctx, year);
}

const isLunar = (ctx: Ctx, month: number, waxing: boolean, day: number) => {
  const l = lunarOf(ctx);
  return l.month === month && l.waxing === waxing && l.phaseDay === day;
};

/** เรือของขุนนางตามขั้นยศและฝ่าย (lore ritual.royal_balons_1680s: ร่มคันเดียว / หลังคา, แดงฝ่ายขวา ดำฝ่ายซ้าย) */
function officialBoat(ctx: Ctx, ch: Character): string {
  const tier = officeTier(ctx, ch);
  if (tier === 'page') return 'ตามเสด็จอยู่ในเรือแซงกับมหาดเล็กคนอื่น ห่างเรือพระที่นั่งไม่กี่ลำ';
  const right = deptOf(ctx, ch).label.th.includes('ขวา');
  if (tier === 'low') return 'นั่งใต้ร่มคันเดียวกลางเรือของตัว ฝีพายเป็นไพร่ในสังกัด';
  return `นั่งยกพื้นใต้หลังคาเรือ${right ? 'ที่ลงรักสีแดงตามธรรมเนียมขุนนางฝ่ายขวา' : ''} ฝีพายเป็นไพร่ในสังกัด`;
}

export interface BargeTick {
  events: ChoreEventRequest[];
  lines: string[];
}

/** เรียกทุกวันจาก world.ts — หมายฝีพายปลายเดือน 11 และวันขบวนต้นเดือน 12 */
export function bargeToday(ctx: Ctx): BargeTick {
  const S = ctx.state;
  const B = ctx.content.balance.barge;
  const out: BargeTick = { events: [], lines: [] };
  const player = S.characters[S.meta.playerCharacterId];
  if (!player || !isAlive(player) || player.social.estate === 'monk' || atWar(ctx, player)) return out;
  const year = yearOf(ctx, S.meta.day);
  const levyDay = isLunar(ctx, B.levyMonth, false, B.levyDay);
  const procession = isLunar(ctx, B.month, true, B.day);
  if ((!levyDay && !procession) || !bargeYear(ctx, year)) return out;
  const age = ageOf(ctx, player);
  const official = officeRank(ctx, player) !== undefined;

  if (levyDay) {
    if (player.sex !== 'm' || official || age < B.levyAge[0] || age > B.levyAge[1] || !ctx.rng.chance(B.levyChance)) return out;
    S.meta.barge = { year };
    out.events.push({ event: 'barge.levy', bindings: { actor: player.id, ...campaignBindings(ctx, player, ['son', 'kin']) }, vars: {} });
    return out;
  }

  const st = S.meta.barge?.year === year ? S.meta.barge : undefined;
  if (official && player.sex === 'm') {
    out.events.push({ event: 'barge.official', bindings: { actor: player.id }, vars: { boat: officialBoat(ctx, player) } as never });
    return out;
  }
  if (st?.mode === 'self' && st.rower === player.id) {
    out.events.push({ event: 'barge.rowing', bindings: { actor: player.id }, vars: {} });
    return out;
  }
  const sent = st?.mode === 'send' && st.rower ? S.characters[st.rower] : undefined;
  if (sent && isAlive(sent)) {
    // คนที่ส่งไปพายแทนกลับมาพร้อมเรื่องเล่า — ผลอัตโนมัติ ไม่มีความเสี่ยงถึงชีวิต (งานพิธี ไม่ใช่ศึก)
    adjustBond(ctx, sent, player, 'affection', 0.03);
    sent.skills.combat = Math.min(100, (sent.skills.combat ?? 0) + 1);
    out.lines.push(`${sent.name}กลับจากพายเรือในขบวน เล่าให้คนในเรือนฟังว่าเรือปิดทองผ่านไปใกล้แค่ไหน`);
  }
  if (age < B.watchMinAge || !ctx.rng.chance(B.watchChance)) return out;
  const peer = canCourt(ctx, player) ? singlePeer(ctx, player, false) : undefined;
  const bindings: Record<string, CharacterId> = { actor: player.id, ...companions(ctx, player), ...(peer ? { stranger: peer.id } : {}) };
  out.events.push({ event: 'festival.barge_watch', bindings, vars: { rowerNote: sent && isAlive(sent) ? `ทุกคนพยายามมองหาเรือลำที่${sent.name}พายอยู่` : '' } as never });
  return out;
}

/** effect op 'barge' (เรียกจาก chooseOption) */
export function applyBarge(ctx: Ctx, ch: Character, e: Extract<Effect, { op: 'barge' }>, rower?: Character): string[] {
  const year = yearOf(ctx, ctx.state.meta.day);
  const st = (ctx.state.meta.barge = ctx.state.meta.barge?.year === year ? ctx.state.meta.barge : { year });
  if (e.action === 'serve') {
    st.mode = 'self';
    st.rower = ch.id;
  } else if (e.action === 'send' && rower) {
    st.mode = 'send';
    st.rower = rower.id;
  } else {
    st.mode = e.action === 'send' ? 'pay' : e.action;
    delete st.rower;
  }
  return [];
}
