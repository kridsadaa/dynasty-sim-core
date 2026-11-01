import { isAlive, must, type Ctx } from '../core/ctx';
import type { HouseholdId } from '../core/types';

// ============================================================================
// บ่าวไพร่ในเรือน — นับเป็นจำนวน ไม่ได้จำลองทีละคน
//
//  ทาส: ข้าสินไถ่และลูกทาสในเรือนเบี้ย อยู่เรือนเล็กในรั้วเดียวกับนาย
//       (lore: social.slave_types, material.houses_1680s) — จำนวนตามเงินทองของหัวเรือน
//  ไพร่ในสังกัด: ขุนนางที่มีตำแหน่งมีไพร่สมมาฝากตัว (lore: social.corvee, social.protection_patronage) — ตามศักดินา
//  ปีละครั้งเข้าใกล้จำนวนที่ฐานะเลี้ยงได้ทีละคน · ทาสกินอยู่กับเรือน หักค่าเลี้ยงดูจากเงินของหัวเรือน
//  ตัวเลขทั้งหมดเป็นค่าของเกม
// ============================================================================

export function servantsYearTick(ctx: Ctx, householdId: HouseholdId): string[] {
  const B = ctx.content.balance.servants;
  const hh = must(ctx.state.households[householdId], householdId);
  const head = ctx.state.characters[hh.headId];
  if (!isAlive(head)) return [];
  const log: string[] = [];
  const keepsSlaves = B.estates.includes(head.social.estate);
  const wantThat = keepsSlaves ? Math.min(B.maxSlaves, Math.floor(head.social.wealth / B.wealthPerSlave)) : 0;
  const wantPhrai = Math.min(B.maxPhrai, Math.floor(head.social.sakdina / B.sakdinaPerPhrai));
  // เรือนที่มีอยู่ก่อนระบบนี้ (ฉากเริ่ม เซฟเก่า) — มีบ่าวไพร่ตามฐานะอยู่แล้ว ไม่ต้องค่อยๆ ได้มา
  if (!hh.retainers) {
    hh.retainers = { that: wantThat, phrai: wantPhrai };
    return log;
  }
  const r = hh.retainers;
  if (r.that < wantThat) {
    r.that++;
    log.push(`${head.name}รับคนที่ขายตัวใช้หนี้มาเป็นทาสในเรือน (มีทาส ${r.that} คน)`);
  } else if (r.that > wantThat) {
    r.that--;
    log.push(r.that ? `ทาสคนหนึ่งไถ่ตัวออกไป เพราะเรือนเลี้ยงไม่ไหว (เหลือ ${r.that} คน)` : 'ทาสคนสุดท้ายไถ่ตัวออกไปแล้ว');
  }
  if (r.phrai < wantPhrai) {
    r.phrai++;
    if (r.phrai === 1 || r.phrai % 5 === 0) log.push(`มีไพร่มาฝากตัวอยู่ในสังกัด${head.name} (${r.phrai} คน)`);
  } else if (r.phrai > wantPhrai) {
    r.phrai--;
  }
  const upkeep = Math.round(r.that * B.upkeep);
  if (upkeep) head.social.wealth = Math.max(0, head.social.wealth - upkeep);
  return log;
}

/** "ทาส 4 · ไพร่ในสังกัด 2" — ไม่มีใครคืนค่าว่าง */
export function servantsText(ctx: Ctx, householdId: HouseholdId): string {
  const r = ctx.state.households[householdId]?.retainers;
  return [r?.that ? `ทาส ${r.that}` : '', r?.phrai ? `ไพร่ในสังกัด ${r.phrai}` : ''].filter(Boolean).join(' · ');
}
