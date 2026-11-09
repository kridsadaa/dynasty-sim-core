import { ageOf, dayOfYear, isAlive, yearOf, type Ctx } from '../core/ctx';
import type { Character, Effect } from '../core/types';
import { spend } from './marriage';
import { whereabouts } from './whereabouts';
import type { PreparedEvent } from './events';
import { prepareEvent } from './events';

// ============================================================================
// ลงหุ้นสำเภา (docs/design-eras.md หัวข้อ 8 ข้อ ง)
//  สำเภาเข้ามาต้นปี ออกกลางปี ปีละเที่ยว (lore social.junk_monsoon_cycle_2365) — ต้นปีมีคนชวนฝากสินค้า/ลงหุ้นไปกับสำเภา
//  เจ้าของสำเภาคือหลวง เจ้านาย ขุนนาง หรือจีนในกรุง · สำเภาเสียหาย ผู้ค้ำประกันผู้คุมสินค้าถูกจำคุก (social.junk_venture_owners_risk)
//  ผลรู้ต้นปีถัดไปเมื่อสำเภากลับ (meta.junk) — ทำแม้ผู้เล่นคนเดิมตายแล้ว เพราะเงินเป็นของเรือน
//  ตัวเลขทุกตัวเป็นของเกม (social.junk_venture_options — invented): หลักฐานไม่มีอัตราเรือแตกหรือกำไร มีแต่ "เรือแตกบ่อย"
// ============================================================================

export interface JunkTick {
  events: PreparedEvent[];
  lines: string[];
}

/** เรียกทุกวันจาก world.ts — ชวนลงหุ้นวัน offerDay และรู้ผลวัน resolveDay ของปีถัดไป */
export function junkToday(ctx: Ctx): JunkTick {
  const S = ctx.state;
  const J = ctx.content.balance.junk;
  const out: JunkTick = { events: [], lines: [] };
  const year = yearOf(ctx, S.meta.day);
  const doy = dayOfYear(ctx, S.meta.day);
  const player = S.characters[S.meta.playerCharacterId];
  const pending = S.meta.junk;
  if (pending && year > pending.year && doy === J.resolveDay) {
    delete S.meta.junk;
    if (isAlive(player)) out.lines.push(...settleJunk(ctx, player, pending));
    return out;
  }
  if (doy !== J.offerDay || pending || year < J.years[0] || year > J.years[1]) return out;
  if (!isAlive(player) || whereabouts(ctx, player) !== 'home' || ageOf(ctx, player) < J.minAge || !ctx.rng.chance(J.offerChance)) return out;
  out.events.push(prepareEvent(ctx, 'trade.junk_offer', { actor: player.id }));
  return out;
}

/** effect op 'junk' — จดว่าลงหุ้นแบบไหนไว้ (เงินลงหุ้น/ค่าค้ำจ่ายผ่าน effect wealth ของตัวเลือก) */
export function applyJunk(ctx: Ctx, e: Extract<Effect, { op: 'junk' }>): string[] {
  const J = ctx.content.balance.junk;
  const year = yearOf(ctx, ctx.state.meta.day);
  ctx.state.meta.junk = { year, action: e.action, stake: e.action === 'guarantee' ? 0 : J.stake[e.action] };
  return [];
}

/** สำเภากลับ: กำไร / เท่าทุน / เสียหายหมด — ค้ำประกันไว้แล้วเรือเสียหาย ต้องเสียเงินไถ่ญาติออกจากคุก */
function settleJunk(ctx: Ctx, player: Character, j: NonNullable<Ctx['state']['meta']['junk']>): string[] {
  const J = ctx.content.balance.junk;
  const r = ctx.rng.next();
  const outcome = r < J.loss ? 'loss' : r < J.loss + J.even ? 'even' : 'profit';
  if (j.action === 'guarantee') {
    if (outcome !== 'loss') return ['สำเภาที่รับค้ำประกันผู้คุมสินค้าไว้กลับเข้าท่าครบลำ ไม่มีใครมาทวงอะไร'];
    const paid = Math.round(spend(ctx, player, J.guaranteeFine));
    player.stress = Math.min(1, player.stress + J.guaranteeStress);
    return [`สำเภาที่รับค้ำประกันไว้ไม่กลับมา เจ้าของเรือให้จับญาติผู้ค้ำเข้าคุก ${player.name}ต้องเสียเงินไถ่ ${paid} ตำลึง`];
  }
  if (outcome === 'loss') return [`ข่าวมาว่าสำเภาที่${player.name}ฝากสินค้าไปเสียหายกลางทะเล ทุน ${j.stake} ตำลึงหายไปทั้งหมด`];
  const back = Math.round(j.stake * (outcome === 'profit' ? J.profitMult : 1));
  player.social.wealth += back;
  return [outcome === 'profit'
    ? `สำเภากลับจากเมืองจีน สินค้าที่${player.name}ฝากไปขายได้ราคา ได้คืน ${back} ตำลึง`
    : `สำเภากลับมาแล้ว แต่ปีนี้ของขายไม่ได้ราคา ได้ทุนคืน ${back} ตำลึงพอเท่าที่ลงไป`];
}
