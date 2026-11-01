import { isAlive, must, type Ctx } from '../core/ctx';
import type { Character, Household, HouseholdId, SlaveCare } from '../core/types';
import { spend } from './marriage';

// ============================================================================
// เรือนและบ่าวไพร่ — นับเป็นจำนวน ไม่ได้จำลองทีละคน
//
//  ทาส: ข้าสินไถ่และลูกทาสในเรือนเบี้ย อยู่เรือนเล็กในรั้วเดียวกับนาย
//       (lore: social.slave_types, material.houses_1680s) — มีเงินพอก็รับคนที่ขายตัวใช้หนี้เข้ามา
//  ไพร่ในสังกัด: ขุนนางที่มีตำแหน่งมีไพร่สมมาฝากตัว (lore: social.corvee, social.protection_patronage) — ตามศักดินา
//
//  ทุกเดือน: หัวเรือนจ่ายค่ากินอยู่ของคนในเรือน (ตามฐานะ) และค่าเลี้ยงดูทาสตามที่เลือกดูแล
//            ทาสทำนาทำสวนหาเงินเข้าเรือน — ทำได้มากน้อยตามการดูแลและใจของทาส (loyalty)
//  ทุกปี:   ใจของทาสค่อยๆ เข้าหาระดับที่การดูแลให้ · ทาสป่วยตาย · ทาสที่ไม่รักนายหนีไปพึ่งนายอื่น
//            (lore: social.slavery_as_strategy — ผู้รับไว้ไม่คืน นายเดิมเอาคืนไม่ได้)
//  ตระหนี่ = ประหยัดค่าเลี้ยงดูแต่ทาสทำงานไม่เต็มมือ ป่วยตายและหนีบ่อย ต้องหาคนใหม่ (เสียค่าไถ่) ชาวบ้านติฉิน
//  ใจกว้าง = จ่ายมาก ทาสรักนาย ทำงานดี อยู่ยาว และได้บุญ — ตัวเลขทั้งหมดเป็นค่าของเกม
// ============================================================================

export const CARE_TH: Record<SlaveCare, string> = { stingy: 'ตระหนี่', normal: 'ตามสมควร', generous: 'ใจกว้าง' };

function retainersOf(ctx: Ctx, hh: Household) {
  return (hh.retainers ??= { that: 0, phrai: 0, loyalty: ctx.content.balance.servants.care.normal.loyalty });
}

/** ค่าใช้จ่ายและรายได้ของเรือนต่อเดือน (ตำลึง) */
export function householdMonth(ctx: Ctx, hh: Household): { upkeep: number; slaveCost: number; slaveYield: number; phraiGifts: number } {
  const B = ctx.content.balance.servants;
  const head = ctx.state.characters[hh.headId];
  const r = hh.retainers;
  const care = B.care[hh.care ?? 'normal'];
  const members = hh.memberIds.filter((id) => isAlive(ctx.state.characters[id])).length;
  const loyalty = r?.loyalty ?? care.loyalty;
  return {
    upkeep: (members * (B.memberUpkeep[head?.social.estate ?? 'phrai_som'] ?? 0)) / 12,
    slaveCost: ((r?.that ?? 0) * care.cost) / 12,
    // ทาสที่รักนายทำงานเต็มมือ — ใจไม่อยู่กับงานก็ได้ครึ่งเดียว
    slaveYield: ((r?.that ?? 0) * B.slaveYield * care.work * (0.5 + loyalty)) / 12,
    phraiGifts: ((r?.phrai ?? 0) * B.phraiGift) / 12,
  };
}

/** ทุก 30 วัน: จ่ายค่ากินอยู่ ค่าเลี้ยงทาส รับเงินจากงานของทาสและของกำนัลจากไพร่ */
export function householdMonthTick(ctx: Ctx, householdId: HouseholdId): void {
  const hh = must(ctx.state.households[householdId], householdId);
  const head = ctx.state.characters[hh.headId];
  if (!isAlive(head)) return;
  const m = householdMonth(ctx, hh);
  head.social.wealth += m.slaveYield + m.phraiGifts;
  spend(ctx, head, m.upkeep + m.slaveCost);
}

export function servantsYearTick(ctx: Ctx, householdId: HouseholdId): string[] {
  const B = ctx.content.balance.servants;
  const hh = must(ctx.state.households[householdId], householdId);
  const head = ctx.state.characters[hh.headId];
  if (!isAlive(head)) return [];
  const log: string[] = [];
  const care = B.care[hh.care ?? 'normal'];
  const keepsSlaves = B.estates.includes(head.social.estate);
  const wantThat = keepsSlaves ? Math.min(B.maxSlaves, Math.floor(head.social.wealth / B.wealthPerSlave)) : 0;
  const wantPhrai = Math.min(B.maxPhrai, Math.floor(head.social.sakdina / B.sakdinaPerPhrai));
  // เรือนที่มีอยู่ก่อนระบบนี้ (ฉากเริ่ม เซฟเก่า) — มีบ่าวไพร่ตามฐานะอยู่แล้ว ไม่ต้องค่อยๆ ได้มา
  if (!hh.retainers) {
    hh.retainers = { that: wantThat, phrai: wantPhrai, loyalty: care.loyalty };
    return log;
  }
  const r = retainersOf(ctx, hh);
  r.loyalty += (care.loyalty - r.loyalty) * B.loyaltyDrift;

  // ป่วยตาย และหนีไปพึ่งนายอื่น — ทาสที่ใจไม่อยู่กับนายหนีง่าย
  let died = 0;
  let fled = 0;
  for (let i = 0; i < r.that; i++) {
    if (ctx.rng.chance(care.death)) died++;
    else if (ctx.rng.chance(B.fleeBase * (1 - r.loyalty) * 2)) fled++;
  }
  r.that -= died + fled;
  if (died) log.push(`ทาสในเรือน${head.name}ป่วยตาย ${died} คน`);
  if (fled) log.push(`ทาส ${fled} คนหนีไปพึ่งนายอื่น${hh.care === 'stingy' ? ' ว่ากันว่าเพราะนายใจดำ' : ''}`);

  if (r.that < wantThat && head.social.wealth >= B.slavePrice + B.wealthPerSlave) {
    r.that++;
    head.social.wealth -= B.slavePrice;
    log.push(`${head.name}ไถ่คนที่ขายตัวใช้หนี้มาเป็นทาสในเรือน ${B.slavePrice} ตำลึง (มีทาส ${r.that} คน)`);
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

  // ชาวบ้านพูดถึงนายที่ดูแลคนในเรือน — ใจกว้างได้บุญ ตระหนี่เสียหน้า
  if (r.that) {
    head.merit += care.merit;
    const dyn = head.dynastyId ? ctx.state.dynasties[head.dynastyId] : undefined;
    if (dyn) dyn.prestige += care.prestige;
  }
  return log;
}

/** ใจของทาสเป็นคำ */
export function loyaltyText(v: number): string {
  return v >= 0.7 ? 'รักนาย' : v >= 0.45 ? 'ทำงานตามหน้าที่' : v >= 0.25 ? 'ไม่เต็มใจ' : 'คิดหนี';
}

/** "ทาส 4 · ไพร่ในสังกัด 2" — ไม่มีใครคืนค่าว่าง */
export function servantsText(ctx: Ctx, householdId: HouseholdId): string {
  const r = ctx.state.households[householdId]?.retainers;
  return [r?.that ? `ทาส ${r.that}` : '', r?.phrai ? `ไพร่ในสังกัด ${r.phrai}` : ''].filter(Boolean).join(' · ');
}

/** ผู้เล่นตั้งการดูแลได้ถ้าเป็นหัวเรือน หรือเมีย/ผัวของหัวเรือนที่อยู่เรือนเดียวกัน (แม่เรือนดูแลบ่าวไพร่) */
export function canManage(ctx: Ctx, ch: Character): Household | undefined {
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  if (!hh) return undefined;
  if (hh.headId === ch.id) return hh;
  const head = ctx.state.characters[hh.headId];
  const node = ctx.state.familyNodes[ch.familyNodeId];
  return head && node?.spouseIds.includes(head.familyNodeId) ? hh : undefined;
}
