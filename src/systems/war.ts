import type { Ctx } from '../core/ctx';
import { newId, isAlive } from '../core/ctx';
import type { Character, ItemId } from '../core/types';
import { purse, spend } from './marriage';

// ============================================================================
// ศึกพม่า 2308–2310 (docs/design-war-2308.md) — การเตรียมตัวของผู้เล่น
//  ฝังเงินทอง: ย้ายเงินสดเป็นไหทองที่ซ่อนไว้ (Item.hidden) — รอดจากการปล้นตอนกรุงแตก (applyHistoricalShocks ข้ามของที่ซ่อน
//  ส่วนเงินสดโดนริบ 50–90%) แต่ใช้ไม่ได้จนกว่าศึกจะผ่าน และตอนขุดคืนอาจหาไม่เจอ (ตัวเลขของเกม)
//  lore: material.buried_valuables (ยังเป็น invented)
// ============================================================================

/** id ของไหทองที่ผู้เล่นฝังระหว่างศึก — ใช้แยกจากไหทองในฉากเริ่ม (itm_gold:buried_jar) ที่ไม่ถูกขุดคืนเป็นเงินสด */
export const WAR_JAR_PREFIX = 'itm_war';
/** โอกาสขุดไหทองเจอตอนศึกจบ */
export const WAR_JAR_RECOVER = 0.8;

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
