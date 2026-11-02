import type { Ctx } from '../core/ctx';
import { newId, isAlive, yearOf } from '../core/ctx';
import type { Character, CharacterId, ItemId } from '../core/types';
import { livingChildren, livingSpouse } from './factory';
import { purse, spend } from './marriage';

// ============================================================================
// ศึกพม่า 2308–2310 (docs/design-war-2308.md) — การเตรียมตัวและการตัดสินใจของผู้เล่น
//  ฝังเงินทอง: ย้ายเงินสดเป็นไหทองที่ซ่อนไว้ (Item.hidden) — รอดจากการปล้นตอนกรุงแตก (applyHistoricalShocks ข้ามของที่ซ่อน
//  ส่วนเงินสดโดนริบ 50–90%) แต่ใช้ไม่ได้จนกว่าศึกจะผ่าน และตอนขุดคืนอาจหาไม่เจอ (ตัวเลขของเกม)
//  ออกจากกรุง: meta.war.party = คนที่ไปด้วย, dir = ทิศ — ตอนกรุงแตกคนที่อยู่นอกกรุงเสี่ยงตายต่างจากคนในกรุง
//  และพกเงินสดไปด้วยจึงถูกริบน้อยกว่า แต่เรือนและที่ดินที่ทิ้งไว้ยังเสียหายเท่าเดิม
//  lore: material.buried_valuables (ยังเป็น invented); ตัวคูณทุกตัวเป็นของเกม ไม่ใช่ตัวเลขประวัติศาสตร์
// ============================================================================

/** id ของไหทองที่ผู้เล่นฝังระหว่างศึก — ใช้แยกจากไหทองในฉากเริ่ม (itm_gold:buried_jar) ที่ไม่ถูกขุดคืนเป็นเงินสด */
export const WAR_JAR_PREFIX = 'itm_war';
/** โอกาสขุดไหทองเจอตอนศึกจบ */
export const WAR_JAR_RECOVER = 0.8;

/** camp = ออกไปยอมแพ้ที่ค่ายพม่าก่อนกรุงแตก */
export type WarWhere = 'city' | 'east' | 'forest' | 'camp';

/**
 * ตัวคูณความเสี่ยงตายตอนกรุงแตกตามที่อยู่ — ตะวันออกปลอดภัยกว่าแต่ไม่แน่นอน (ผู้ใช้ตัดสิน 2026-11-02; ประวัติศาสตร์ไม่มีข้อมูลพลเรือน),
 * ป่าตะวันตก: ผลค้นว่าคนที่หนีเข้าป่าถูกตามล่า จึงเสี่ยงกว่าอยู่ในกรุงเล็กน้อย
 */
export const WAR_DEATH_MULT: Record<WarWhere, number> = { city: 1, east: 0.3, forest: 1.3, camp: 0.1 };
/** สัดส่วนที่เงินสดถูกริบเทียบกับคนในกรุง — คนที่หนีพกเงินไปด้วย */
export const WAR_CASH_LOSS_MULT: Record<WarWhere, number> = { city: 1, east: 0.3, forest: 0.3, camp: 0.5 };

/** ความเสี่ยงตายตอนกรุงแตกลดลงตามการเตรียมตัว (meta.war.prep) เฉพาะคนที่อยู่ในกรุง — สูงสุด 40% (ตัวเลขของเกม) */
export const WAR_PREP_PER_POINT = 0.08;
export const WAR_PREP_MAX = 0.4;

/** deathCause ของคนที่ถูกกวาดต้อนไปพม่า — หายจากเกม (เหมือนตาย) ข้อความบอกชัดว่าถูกกวาดต้อน; เส้นทางเชลยของผู้เล่นเลื่อนไว้ (BACKLOG) */
export const CAPTIVE_TAG = 'history:captive_after_fall';
/** ตัวคูณความเสี่ยงถูกกวาดต้อนตามที่อยู่ — ตะวันออกอยู่นอกวงทัพพม่า ป่าตะวันตกถูกตามล่าบ้าง (ตัวเลขของเกม) */
export const WAR_CAPTURE_MULT: Record<WarWhere, number> = { city: 1, east: 0.1, forest: 0.9, camp: 1.4 };

const prepFactor = (ctx: Ctx, where: WarWhere) =>
  where === 'city' ? 1 - Math.min(WAR_PREP_MAX, Math.max(0, ctx.state.meta.war?.prep ?? 0) * WAR_PREP_PER_POINT) : 1;

export function warDeathMult(ctx: Ctx, id: CharacterId): number {
  const where = warWhere(ctx, id);
  return WAR_DEATH_MULT[where] * prepFactor(ctx, where);
}

export function warCaptureMult(ctx: Ctx, id: CharacterId): number {
  const where = warWhere(ctx, id);
  return WAR_CAPTURE_MULT[where] * prepFactor(ctx, where);
}

export function warWhere(ctx: Ctx, id: CharacterId): WarWhere {
  const w = ctx.state.meta.war;
  return w?.stance === 'leave' && w.dir && w.party?.includes(id) ? w.dir : 'city';
}

export function buryValuables(ctx: Ctx, ch: Character, fraction: number): string[] {
  const amount = Math.floor(purse(ctx, ch) * fraction * 10) / 10;
  if (amount < 1) return [];
  const paid = spend(ctx, ch, amount);
  const id = newId<ItemId>(ctx, WAR_JAR_PREFIX);
  ctx.state.items[id] = {
    id, tag: 'gold:buried_jar', kind: 'gold', value: paid, hidden: true, condition: 1,
    ownerCharacterId: ch.id, ownerDynastyId: null,
  };
  return [`${ch.name}ฝังเงินทอง ${paid.toFixed(0)} ตำลึงไว้ใต้เรือน`];
}

/** ศึกจบ (กรุงแตกแล้ว) — ขุดไหที่เจ้าของยังมีชีวิตคืนเป็นเงินสด; เจ้าของตายแล้วไหยังซ่อนอยู่และตกเป็นมรดกตามปกติ */
export function unearthBuried(ctx: Ctx): string[] {
  const lines: string[] = [];
  for (const it of Object.values(ctx.state.items)) {
    if (!it.id.startsWith(WAR_JAR_PREFIX) || !it.ownerCharacterId) continue;
    const owner = ctx.state.characters[it.ownerCharacterId];
    if (!isAlive(owner)) continue;
    delete ctx.state.items[it.id];
    if (ctx.rng.chance(WAR_JAR_RECOVER)) {
      owner.social.wealth += it.value;
      lines.push(`${owner.name}ขุดไหทองที่ฝังไว้ขึ้นมา ได้คืน ${it.value.toFixed(0)} ตำลึง`);
    } else {
      lines.push(`${owner.name}ขุดหาไหทองที่ฝังไว้ ${it.value.toFixed(0)} ตำลึงอยู่หลายวันก็ไม่พบ`);
    }
  }
  return lines;
}

/** ตัดสินใจอยู่ในกรุง (ล้างรายชื่อคนที่ออกไปของครั้งก่อนถ้ามี) */
export function stayInCity(ctx: Ctx, ch: Character): string[] {
  const { party: _party, dir: _dir, ...rest } = ctx.state.meta.war ?? { prep: 0 };
  ctx.state.meta.war = { ...rest, prep: rest.prep ?? 0, stance: 'stay' };
  return [`${ch.name}ตัดสินใจปักหลักอยู่ในกรุง`];
}

/**
 * ออกจากกรุง: all = ทุกคนที่มีชีวิตในเรือนของ ch · nuclear = คู่ครองและลูกที่อยู่เรือนเดียวกัน · alone = ไปคนเดียว
 * ผู้เล่นไปด้วยเสมอ
 */
export function leaveCity(ctx: Ctx, ch: Character, dir: 'east' | 'forest' | 'camp', who: 'all' | 'nuclear' | 'alone'): string[] {
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  const sameHouse = (c: Character) => !!hh && c.householdId === hh.id;
  const members = who === 'all'
    ? (hh?.memberIds ?? []).map((id) => ctx.state.characters[id]).filter(isAlive)
    : who === 'nuclear'
      ? [livingSpouse(ctx, ch), ...livingChildren(ctx, ch)].filter((c): c is Character => !!c && isAlive(c) && (sameHouse(c) || c === livingSpouse(ctx, ch)))
      : [];
  const party = [...new Set([ch.id, ...members.map((c) => c.id)])];
  ctx.state.meta.war = { prep: ctx.state.meta.war?.prep ?? 0, stance: 'leave', dir, party };
  const where = dir === 'east' ? 'ทางตะวันออก' : dir === 'camp' ? 'ที่ค่ายพม่าเพื่อยอมแพ้' : 'เข้าป่าทางตะวันตก';
  return [`${ch.name}พา${party.length > 1 ? `คนในครอบครัวอีก ${party.length - 1} คน` : 'ตัวคนเดียว'}${dir === 'camp' ? 'ไป' : 'ออกจากกรุงไป'}${where}`];
}

/** ฝ่าวงล้อมตามพระยาตากออกไปทางตะวันออกคนเดียว */
export function joinTaksin(ctx: Ctx, ch: Character): string[] {
  const notes = leaveCity(ctx, ch, 'east', 'alone');
  ctx.state.meta.war = { ...ctx.state.meta.war!, taksin: true };
  return [`${ch.name}ตามพระยาตากตีฝ่าวงล้อมพม่าออกจากกรุงไปทางตะวันออก`, ...notes.slice(1)];
}

/** บรรทัดบันทึกตอนกรุงแตกของคนที่อยู่นอกกรุง (ผู้เล่นเห็นผลของการตัดสินใจ) */
export function fallLeaverLines(ctx: Ctx): string[] {
  const w = ctx.state.meta.war;
  if (w?.stance !== 'leave' || !w.dir) return [];
  const alive = (w.party ?? []).map((id) => ctx.state.characters[id]).filter(isAlive);
  if (!alive.length) return [];
  const where = w.dir === 'east' ? 'ทางตะวันออก' : w.dir === 'camp' ? 'ในค่ายพม่า' : 'ในป่าทางตะวันตก';
  return [`ขณะกรุงแตก ${alive.map((c) => c.name).slice(0, 3).join(' ')}${alive.length > 3 ? ` และอีก ${alive.length - 3} คน` : ''}อยู่${where} ไม่ได้อยู่ในเมืองตอนถูกปล้น`];
}

/** ป้ายสถานะบนแผงตัวละครช่วง 2308–2310 — ผู้เล่นตัดสินใจอะไรไว้ */
export function warBadges(ctx: Ctx): Array<{ label: string; tone: 'info' | 'warn' }> {
  const w = ctx.state.meta.war;
  const year = yearOf(ctx, ctx.state.meta.day);
  if (!w?.stance || year > 2310) return [];
  if (w.stance === 'stay') return [{ label: 'ปักหลักอยู่ในกรุง', tone: 'warn' }];
  if (w.dir === 'camp') return [{ label: 'ยอมแพ้ต่อพม่า', tone: 'warn' }];
  return [{ label: w.dir === 'east' ? 'หนีไปทางตะวันออก' : 'หนีเข้าป่าทางตะวันตก', tone: 'info' }];
}
