import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { TagId } from '../core/types';
import { isGraced, markDead } from './handover';

// ============================================================================
// ความตายรายปี — ทอยทุก 1 ม.ค. ด้วยอายุตลอดปีที่เพิ่งผ่านไป (เด็กที่เกิดวันนี้ยังไม่ทอย)
// ทิศทางจาก lore หมวด health: เด็กตายมากที่สุด ไข้ทรพิษเป็นตัวฆ่าหลักและบางปีระบาดหนัก
// คนที่รอดเป็นผู้ใหญ่อยู่ถึง 70–80 ได้ ตัวเลขทั้งหมดอยู่ใน balance.mortality
// ============================================================================

/** ความเสี่ยงตายในหนึ่งปีของคนที่อายุ age ตลอดปีนั้น */
export function yearlyDeathRisk(ctx: Ctx, age: number, smallpoxYear: boolean): number {
  const M = ctx.content.balance.mortality;
  const base = age < 1 ? M.infant : age < 5 ? M.young : age < 15 ? M.child : age < M.oldFrom ? M.adult
    : M.oldBase * 2 ** ((age - M.oldFrom) / M.oldDoublingYears);
  return Math.min(1, base + (smallpoxYear && age < 15 ? M.smallpoxChildRisk : 0));
}

/** คืน log — ผู้เล่นที่ตายไม่ขึ้นใน log (world ส่ง playerDied เอง) */
export function mortalityYearTick(ctx: Ctx): string[] {
  const S = ctx.state;
  const M = ctx.content.balance.mortality;
  const day = S.meta.day;
  const smallpox = ctx.rng.chance(M.smallpoxYearChance);
  const out: string[] = smallpox ? ['ปีที่ผ่านมาไข้ทรพิษระบาดหนักช่วงหน้าแล้ง'] : [];
  for (const ch of Object.values(S.characters)) {
    if (!isAlive(ch) || isGraced(ctx, ch)) continue;
    const age = ageOf(ctx, ch, day - 1);
    if (age < 0) continue;
    const risk = yearlyDeathRisk(ctx, age, smallpox);
    if (!ctx.rng.chance(risk)) continue;
    // ปีไข้ทรพิษ: เด็กที่ตายเพราะส่วนที่ระบาดเพิ่มขึ้นนับว่าตายด้วยไข้ทรพิษ
    const cause: TagId = age >= M.oldAgeCause ? 'situation:old_age'
      : smallpox && age < 15 && ctx.rng.chance(M.smallpoxChildRisk / risk) ? 'situation:smallpox' : 'situation:illness';
    markDead(ctx, ch, cause);
    if (ch.id === S.meta.playerCharacterId) continue;
    const when = age < 1 ? 'ยังไม่ทันขวบ' : age < 15 ? `อายุ ${age} ขวบ` : `อายุ ${age} ปี`;
    out.push(cause === 'situation:old_age' ? `${ch.name} ถึงแก่กรรม ${when}`
      : cause === 'situation:smallpox' ? `${ch.name} ตายด้วยไข้ทรพิษ ${when}`
        : age < 15 ? `${ch.name} เจ็บไข้ตาย ${when}` : `${ch.name} เจ็บไข้ถึงแก่กรรม ${when}`);
  }
  return out;
}
