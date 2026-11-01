import { isAlive, must, type Ctx } from '../core/ctx';
import { DAYS_PER_YEAR } from '../core/calendar';
import { clamp01 } from '../core/rng';
import type { Character, Household, HouseholdId, SlaveCare, SlaveTask } from '../core/types';
import { purse, spend } from './marriage';
import { hasPerk, legacyLevel } from './skills';

// ============================================================================
// เรือน ที่ดิน และบ่าวไพร่
//
//  ขนาดเรือน (tier 1..4): กำหนดความจุคนในเรือน หากคนเกินความจุเรือนจะแออัด (หนักใจง่าย) และรับเมียเข้าเรือนเพิ่มไม่ได้จนกว่าจะขยายเรือน
//  ที่นาและสวน (land): สร้างผลผลิตรายเดือนคู่กับแรงงานทาส ซื้อที่นาเพิ่มได้
//  งานทาส (slaveTask): ทำนาทำสวน (เน้นรายได้) · รับใช้ในเรือน (ลดค่ากินอยู่/คลายใจหนัก) · เฝ้ายามคุ้มเรือน (กันทาสหนี/เสริมบารมี)
// ============================================================================

export const CARE_TH: Record<SlaveCare, string> = { stingy: 'ตระหนี่', normal: 'ตามสมควร', generous: 'ใจกว้าง' };
export const SLAVE_TASK_TH: Record<SlaveTask, { label: string; note: string }> = {
  farm: { label: 'ทำนาทำสวน', note: 'ทาสทุ่มแรงทำนาและสวนผลไม้ ได้เงินเข้าเรือนเต็มเม็ดเต็มหน่วย' },
  house: { label: 'รับใช้ในเรือน', note: 'แบ่งทาสมาดูแลงานบ้าน ลดค่ากินอยู่ลง 25% และคนในเรือนสบายใจขึ้น' },
  guard: { label: 'เฝ้ายามคุ้มเรือน', note: 'จัดเวรเฝ้ารั้วเรือนและดูแลระเบียบ โอกาสทาสหนีลดลงครึ่งหนึ่งและได้หน้าตา' },
};

export interface HouseTierDef {
  tier: number;
  name: string;
  capacity: number;
  cost: number;
  desc: string;
}

export const HOUSE_TIERS: HouseTierDef[] = [
  { tier: 1, name: 'เรือนฝากระดาน', capacity: 8, cost: 0, desc: 'เรือนพักอาศัยขนาดย่อม มีชานพักและเรือนครัวพออยู่กันในครอบครัว' },
  { tier: 2, name: 'เรือนเครื่องสับมีชานแล่น', capacity: 12, cost: 25, desc: 'ขยายชานเรือนและต่อเติมห้องนอน รองรับลูกหลานและบริวารได้มากขึ้น' },
  { tier: 3, name: 'เรือนหมู่คหบดี', capacity: 17, cost: 50, desc: 'ปลูกเรือนลูกและเรือนขวางเพิ่มในรั้วเดียวกัน กว้างขวางเป็นสัดส่วน' },
  { tier: 4, name: 'เรือนใหญ่ขุนนาง', capacity: 24, cost: 90, desc: 'เรือนหมู่ขนาดใหญ่ มีเรือนประธาน เรือนลูก เรือนครัว และเรือนบ่าวครบครัน' },
];

export const LAND_BASE_COST = 20;
export const LAND_YEARLY_YIELD = 4;

export function houseTierOf(hh: Household): HouseTierDef {
  const t = Math.max(1, Math.min(HOUSE_TIERS.length, hh.tier ?? 1));
  return HOUSE_TIERS[t - 1]!;
}

export function houseMembersCount(ctx: Ctx, hh: Household): number {
  return hh.memberIds.filter((id) => isAlive(ctx.state.characters[id])).length;
}

export function houseCapacity(ctx: Ctx, hh: Household): number {
  const head = ctx.state.characters[hh.headId];
  let cap = houseTierOf(hh).capacity;
  if (hasPerk(head, 'stewardship_3')) cap += 3;
  if (legacyLevel(ctx, head, 'wealth') >= 4) cap += 4;
  return cap;
}

export function houseDiscountFactor(ctx: Ctx, ch: Character | undefined): number {
  let factor = 1;
  if (hasPerk(ch, 'stewardship_1')) factor *= 0.8;
  if (legacyLevel(ctx, ch, 'wealth') >= 3) factor *= 0.8;
  return factor;
}

export function expandHouseCost(ctx: Ctx, hh: Household): number | null {
  const cur = hh.tier ?? 1;
  const next = HOUSE_TIERS.find((t) => t.tier === cur + 1);
  if (!next) return null;
  const head = ctx.state.characters[hh.headId];
  return Math.max(5, Math.round(next.cost * houseDiscountFactor(ctx, head)));
}

/** ที่นาแปลงที่ N ราคาแพงขึ้นเรื่อยๆ (เหลือที่ดีๆ ให้ซื้อน้อยลง) และจำกัดตามขนาดเรือนที่ดูแลไหว */
export function landCap(hh: Household): number {
  return 3 + 3 * houseTierOf(hh).tier;
}

export function landCost(ctx: Ctx, hh: Household): number {
  const head = ctx.state.characters[hh.headId];
  const extra = Math.max(0, landOf(ctx, hh) - 2);
  return Math.max(5, Math.round(LAND_BASE_COST * (1 + 0.2 * extra) * houseDiscountFactor(ctx, head)));
}

/** ทาสที่ทรัพย์ของหัวเรือนเลี้ยงไหว — เกินนี้รอบปีจะมีทาสไถ่ตัวออก จึงไม่ให้ซื้อเกิน */
export function slaveCapacity(ctx: Ctx, hh: Household): number {
  const B = ctx.content.balance.servants;
  const head = ctx.state.characters[hh.headId];
  return Math.min(B.maxSlaves, Math.floor((head?.social.wealth ?? 0) / B.wealthPerSlave));
}

export function landOf(ctx: Ctx, hh: Household): number {
  if (hh.land !== undefined) return hh.land;
  const head = ctx.state.characters[hh.headId];
  return head?.social.estate === 'noble' ? 2 : 1;
}

function retainersOf(ctx: Ctx, hh: Household) {
  return (hh.retainers ??= { that: 0, phrai: 0, loyalty: ctx.content.balance.servants.care.normal.loyalty });
}

/** ค่าใช้จ่ายและรายได้ของเรือนต่อเดือน (ตำลึง) */
export function householdMonth(ctx: Ctx, hh: Household): { upkeep: number; slaveCost: number; slaveYield: number; landYield: number; phraiGifts: number } {
  const B = ctx.content.balance.servants;
  const head = ctx.state.characters[hh.headId];
  const r = hh.retainers;
  const care = B.care[hh.care ?? 'normal'];
  const task = hh.slaveTask ?? 'farm';
  const members = houseMembersCount(ctx, hh);
  const loyalty = r?.loyalty ?? care.loyalty;

  let upkeepFactor = 1;
  if (task === 'house' && (r?.that ?? 0) > 0) upkeepFactor *= 0.75;
  if (hasPerk(head, 'stewardship_3')) upkeepFactor *= 0.8;

  let slaveWorkFactor = task === 'farm' ? 1 : 0.55;
  if (hasPerk(head, 'stewardship_2')) slaveWorkFactor *= 1.25;

  let landFactor = 1;
  if (hasPerk(head, 'stewardship_4')) landFactor *= 1.25;
  if (legacyLevel(ctx, head, 'wealth') >= 1) landFactor *= 1.2;

  return {
    upkeep: (members * (B.memberUpkeep[head?.social.estate ?? 'phrai_som'] ?? 0) * upkeepFactor) / 12,
    slaveCost: ((r?.that ?? 0) * care.cost) / 12,
    // ทาสที่รักนายทำงานเต็มมือ — ใจไม่อยู่กับงานก็ได้ครึ่งเดียว
    slaveYield: ((r?.that ?? 0) * B.slaveYield * care.work * slaveWorkFactor * (0.5 + loyalty)) / 12,
    landYield: (landOf(ctx, hh) * LAND_YEARLY_YIELD * landFactor) / 12,
    phraiGifts: ((r?.phrai ?? 0) * B.phraiGift) / 12,
  };
}

/** ทุก 30 วัน: จ่ายค่ากินอยู่ ค่าเลี้ยงทาส รับเงินจากงานของทาส ที่นา และของกำนัลจากไพร่ */
export function householdMonthTick(ctx: Ctx, householdId: HouseholdId): void {
  const hh = must(ctx.state.households[householdId], householdId);
  const head = ctx.state.characters[hh.headId];
  if (!isAlive(head)) return;
  const m = householdMonth(ctx, hh);
  head.social.wealth += m.slaveYield + m.landYield + m.phraiGifts;
  spend(ctx, head, m.upkeep + m.slaveCost);
}

/** ขยายเรือนขึ้นอีกขั้น */
export function expandHousehold(ctx: Ctx, me: Character): string {
  const hh = canManage(ctx, me);
  if (!hh) throw new Error('ต้องเป็นหัวเรือนหรือแม่เรือนจึงจะขยายเรือนได้');
  const cost = expandHouseCost(ctx, hh);
  if (cost === null) throw new Error('เรือนใหญ่ที่สุดแล้ว');
  if (purse(ctx, me) < cost) throw new Error(`เงินในเรือนไม่พอ (ต้องใช้ ${cost} ตำลึง)`);
  spend(ctx, me, cost);
  hh.tier = (hh.tier ?? 1) + 1;
  const next = houseTierOf(hh);
  return `${me.name}ปลูกขยายเรือนเป็น "${next.name}" จ่ายไป ${cost} ตำลึง (รองรับคนในเรือนได้ ${houseCapacity(ctx, hh)} คน)`;
}

/** ซื้อที่นาและสวนเพิ่มให้เรือน */
export function buyHouseholdLand(ctx: Ctx, me: Character): string {
  const hh = canManage(ctx, me);
  if (!hh) throw new Error('ต้องเป็นหัวเรือนหรือแม่เรือนจึงจะซื้อที่นาได้');
  if (landOf(ctx, hh) >= landCap(hh)) throw new Error('เรือนขนาดนี้ดูแลที่นาได้ไม่เกิน ' + landCap(hh) + ' แปลง ต้องขยายเรือนก่อน');
  const cost = landCost(ctx, hh);
  if (purse(ctx, me) < cost) throw new Error(`เงินในเรือนไม่พอ (ต้องใช้ ${cost} ตำลึง)`);
  spend(ctx, me, cost);
  hh.land = landOf(ctx, hh) + 1;
  return `${me.name}ซื้อที่นาและสวนเพิ่มอีก 1 แปลง เป็นเงิน ${cost} ตำลึง (รวมมีที่ดิน ${hh.land} แปลง)`;
}

/** ไถ่ทาสเพิ่มเข้าเรือน 1 คน */
export function buyHouseholdSlave(ctx: Ctx, me: Character): string {
  const hh = canManage(ctx, me);
  if (!hh) throw new Error('ต้องเป็นหัวเรือนหรือแม่เรือน');
  const B = ctx.content.balance.servants;
  const r = retainersOf(ctx, hh);
  if (r.that >= B.maxSlaves) throw new Error('มีทาสในเรือนมากพอแล้ว');
  if (r.that >= slaveCapacity(ctx, hh)) throw new Error('ทรัพย์ของหัวเรือนเลี้ยงทาสเพิ่มไม่ไหว (ทาสจะไถ่ตัวออกไปเอง)');
  if (purse(ctx, me) < B.slavePrice) throw new Error(`เงินไม่พอค่าไถ่ทาส (${B.slavePrice} ตำลึง)`);
  spend(ctx, me, B.slavePrice);
  r.that++;
  return `${me.name}ไถ่ทาสเข้าเรือนเพิ่ม 1 คน เป็นเงิน ${B.slavePrice} ตำลึง (รวมมีทาส ${r.that} คน)`;
}

/** ปล่อยทาสให้เป็นไท 1 คน ได้บุญและบารมีตระกูล */
export function freeHouseholdSlave(ctx: Ctx, me: Character): string {
  const hh = canManage(ctx, me);
  if (!hh) throw new Error('ต้องเป็นหัวเรือนหรือแม่เรือน');
  const r = retainersOf(ctx, hh);
  if (r.that <= 0) throw new Error('ไม่มีทาสในเรือน');
  // ปล่อยทาสเพื่อเก็บบุญได้ปีละครั้ง — ปล่อยถี่ไม่ได้บุญเพิ่ม
  if (hh.lastFreedDay !== undefined && ctx.state.meta.day - hh.lastFreedDay < DAYS_PER_YEAR) {
    throw new Error('เพิ่งปล่อยทาสไปไม่ถึงปี รออีกสักพักจึงจะปล่อยคนต่อไปได้');
  }
  hh.lastFreedDay = ctx.state.meta.day;
  r.that--;
  me.merit += 3;
  const dyn = me.dynastyId ? ctx.state.dynasties[me.dynastyId] : undefined;
  if (dyn) dyn.prestige += 0.5;
  return `${me.name}ปล่อยทาสให้พ้นค่าตัวเป็นไท 1 คน ได้บุญกุศลใหญ่ (เหลือทาส ${r.that} คน)`;
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
  const targetLoyalty = Math.min(1, care.loyalty + (legacyLevel(ctx, head, 'wealth') >= 2 ? 0.12 : 0));
  r.loyalty += (targetLoyalty - r.loyalty) * B.loyaltyDrift;

  let fleeMul = 1;
  if (hh.slaveTask === 'guard') fleeMul *= 0.5;
  if (hasPerk(head, 'stewardship_2')) fleeMul *= 0.5;
  if (legacyLevel(ctx, head, 'wealth') >= 2) fleeMul *= 0.5;

  // ป่วยตาย และหนีไปพึ่งนายอื่น — ทาสที่ใจไม่อยู่กับนายหนีง่าย
  let died = 0;
  let fled = 0;
  for (let i = 0; i < r.that; i++) {
    if (ctx.rng.chance(care.death)) died++;
    else if (ctx.rng.chance(B.fleeBase * (1 - r.loyalty) * 2 * fleeMul)) fled++;
  }
  r.that -= died + fled;
  if (died) log.push(`ทาสในเรือน${head.name}ป่วยตาย ${died} คน`);
  if (fled) log.push(`ทาส ${fled} คนหนีไปพึ่งนายอื่น${hh.care === 'stingy' ? ' ว่ากันว่าเพราะนายใจดำ' : ''}`);

  const recentlyFreed = hh.lastFreedDay !== undefined && ctx.state.meta.day - hh.lastFreedDay < 5 * DAYS_PER_YEAR;
  if (r.that < wantThat && !recentlyFreed && head.social.wealth >= B.slavePrice + B.wealthPerSlave) {
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

  // เรือนคับแคบเกินความจุ → คนในเรือนอึดอัด หนักใจขึ้น; ถ้าแบ่งทาสรับใช้ในเรือน → คนในเรือนสบายใจขึ้น
  const members = houseMembersCount(ctx, hh);
  const cap = houseCapacity(ctx, hh);
  if (members > cap) {
    for (const id of hh.memberIds) {
      const m = ctx.state.characters[id];
      if (isAlive(m)) m.stress = clamp01(m.stress + 0.04);
    }
    if (hh.id === ctx.state.characters[ctx.state.meta.playerCharacterId]?.householdId) {
      log.push(`เรือนของ${head.name}คับแคบ (${members}/${cap} คน) — คนในเรือนอึดอัด ควรขยายเรือน`);
    }
  } else if (hh.slaveTask === 'house' && r.that > 0) {
    for (const id of hh.memberIds) {
      const m = ctx.state.characters[id];
      if (isAlive(m)) m.stress = clamp01(m.stress - 0.03);
    }
  }

  // ชาวบ้านพูดถึงนายที่ดูแลคนในเรือน — ใจกว้างได้บุญ ตระหนี่เสียหน้า
  if (r.that) {
    head.merit += care.merit;
    const dyn = head.dynastyId ? ctx.state.dynasties[head.dynastyId] : undefined;
    if (dyn) dyn.prestige += care.prestige + (hh.slaveTask === 'guard' ? 0.2 : 0);
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
