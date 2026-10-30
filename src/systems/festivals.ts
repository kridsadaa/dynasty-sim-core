import { ageOf, dayOfYear, isAlive, type Ctx } from '../core/ctx';
import type { Character, CharacterId } from '../core/types';
import { singlePeer } from './acquaintance';
import type { ChoreEventRequest } from './chores';
import { livingParents, livingSpouse } from './factory';

// ============================================================================
// Festivals — งานบุญและงานประจำปีของผู้เล่น (ทุกวัยตั้งแต่ minAge)
//
//  เดือนในเกม (30 วัน) ถือเป็นเดือนจันทรคติ: วันที่ 15 = เพ็ญ, วันที่ 30 = ดับ — วันละไม่เกินหนึ่งงาน
//   ├─ เพ็ญเดือน 12: ลอยโคมเมื่อน้ำเริ่มลด                       (ritual.floating_lanterns_1680s)
//   ├─ เพ็ญเดือน 5: รดน้ำพ่อแม่                                (ritual.fifth_month_bathing_1680s)
//   ├─ วันพระ (เพ็ญ/ดับ): ไปวัดฟังเทศน์ ถือศีล หรือแอบไปหาปลา    (ritual.holy_days_1680s)
//   └─ หน้าแล้ง: งานวัดใกล้บ้าน ละคร มวย ปล่อยนกปล่อยปลา       (ritual.temple_festival_1680s)
//
//  วัยหนุ่มสาวที่ยังไม่มีคู่: งานวัดอาจมีคนต่างเพศให้แอบมอง (คนใหม่ได้) ลอยโคมชวนคนที่รู้จักอยู่แล้วไปด้วยได้
// ============================================================================

/** วันละครั้ง (ผู้เล่นเท่านั้น) — away ≥ 1 = ไปอยู่บ้านคนอื่น ไม่ได้รดน้ำพ่อแม่ที่เรือน */
export function tickFestivals(ctx: Ctx, away: number): ChoreEventRequest[] {
  const S = ctx.state;
  const F = ctx.content.balance.festivals;
  const ch = S.characters[S.meta.playerCharacterId];
  if (!isAlive(ch) || ageOf(ctx, ch) < F.minAge) return [];
  const doy = dayOfYear(ctx, S.meta.day);
  const month = Math.floor(doy / 30) + 1;
  const date = (doy % 30) + 1;
  const full = date === 15;
  const req = (event: string, bindings: Record<string, CharacterId>, vars = {}) => [{ event, bindings: { actor: ch.id, ...bindings }, vars }];

  if (full && month === F.lanternMonth && ctx.rng.chance(F.lanternChance)) {
    const peer = canCourt(ctx, ch) ? singlePeer(ctx, ch, false) : undefined;
    return req('festival.lanterns', peer ? { stranger: peer.id } : {});
  }
  if (full && month === F.bathingMonth && away < 1 && ctx.rng.chance(F.bathingChance)) {
    const parents = livingParents(ctx, ch);
    const parent = parents.find((p) => p.householdId === ch.householdId) ?? parents[0];
    if (parent) return req('festival.bathing', { parent: parent.id });
  }
  if ((full || date === 30) && ctx.rng.chance(F.holyDaysPerYear / 24)) {
    return req('festival.holy_day', {}, { moon: full ? 'moon:full' : 'moon:dark' });
  }
  const fairDays = (F.fairMonths[1] - F.fairMonths[0] + 1) * 30;
  if (month >= F.fairMonths[0] && month <= F.fairMonths[1] && ctx.rng.chance(F.templeFairsPerYear / fairDays)) {
    const peer = canCourt(ctx, ch) ? singlePeer(ctx, ch, true) : undefined;
    return req('festival.temple_fair', peer ? { stranger: peer.id } : {});
  }
  return [];
}

function canCourt(ctx: Ctx, ch: Character): boolean {
  const age = ageOf(ctx, ch);
  const [min, max] = ctx.content.balance.festivals.peerAge;
  return age >= min && age <= max && !livingSpouse(ctx, ch) && !ch.betrothal && !ch.eloped;
}
