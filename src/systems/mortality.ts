import { ageOf, isAlive, yearOf, type Ctx } from '../core/ctx';
import type { Character, PartDefId, TagId } from '../core/types';
import { addScar } from './body';
import { prepareEvent, type PreparedEvent } from './events';
import { livingChildren } from './factory';
import { isGraced, markDead } from './handover';
import { mortalityShield } from './skills';
import { institutionActive } from './eras';

// ============================================================================
// ความตายรายปี — ทอยทุก 1 ม.ค. ด้วยอายุตลอดปีที่เพิ่งผ่านไป (เด็กที่เกิดวันนี้ยังไม่ทอย)
// ทิศทางจาก lore หมวด health: เด็กตายมากที่สุด ไข้ทรพิษเป็นตัวฆ่าหลักและบางปีระบาดหนัก
// คนที่รอดเป็นผู้ใหญ่อยู่ถึง 70–80 ได้ ตัวเลขทั้งหมดอยู่ใน balance.mortality
// ============================================================================

/**
 * ตัวคูณความเสี่ยงตายจากร่างกายแต่กำเนิด — หารด้วยค่าเฉลี่ยของ e^(−kZ) (= e^(k²/2)) ให้ทั้งประชากรแรกเกิดตายเท่าเดิม
 * คนขี้โรคตายก่อน คนที่เหลือรอดเป็นผู้ใหญ่จึงแข็งแรงกว่าเฉลี่ยเล็กน้อย
 */
export function frailty(ctx: Ctx, ch: Character): number {
  const k = ctx.content.balance.constitution.riskPerSD;
  return Math.exp(-k * (ch.constitution ?? 0) - (k * k) / 2);
}

/** ความเสี่ยงตายด้วยโรคทั่วไป/ชราในหนึ่งปีของคนที่อายุ age ตลอดปีนั้น (ไม่รวมไข้ทรพิษ) */
export function yearlyDeathRisk(ctx: Ctx, age: number, frail = 1): number {
  const M = ctx.content.balance.mortality;
  const base = age < 1 ? M.infant : age < 5 ? M.young : age < 15 ? M.child : age < M.oldFrom ? M.adult
    : M.oldBase * 2 ** ((age - M.oldFrom) / M.oldDoublingYears);
  return Math.min(1, base * frail);
}

/** คืน log — ผู้เล่นที่ตายไม่ขึ้นใน log (world ส่ง playerDied เอง) */
export function mortalityYearTick(ctx: Ctx): string[] {
  const S = ctx.state;
  const M = ctx.content.balance.mortality;
  const day = S.meta.day;
  const smallpox = ctx.rng.chance(M.smallpoxYearChance);
  const out: string[] = smallpox ? ['ปีที่ผ่านมาไข้ทรพิษระบาดหนักช่วงหน้าแล้ง'] : [];
  const died = (name: string, age: number, cause: TagId) => {
    const when = age < 1 ? 'ยังไม่ทันขวบ' : age < 15 ? `อายุ ${age} ขวบ` : `อายุ ${age} ปี`;
    out.push(cause === 'situation:old_age' ? `${name}ถึงแก่กรรม ${when}`
      : cause === 'situation:smallpox' ? `${name}ตายด้วยไข้ทรพิษ ${when}`
        : age < 15 ? `${name}เจ็บไข้ตาย ${when}` : `${name}เจ็บไข้ถึงแก่กรรม ${when}`);
  };
  for (const ch of Object.values(S.characters)) {
    if (!isAlive(ch)) continue;
    const age = ageOf(ctx, ch, day - 1);
    if (age < 0) continue;
    const isPlayer = ch.id === S.meta.playerCharacterId;
    const frail = frailty(ctx, ch) * mortalityShield(ctx, ch, age);
    // ปีไข้ทรพิษ: เด็กที่ยังไม่เคยเป็นติดได้ — รอดแล้วไม่เป็นซ้ำ บางคนมีรอยบนหน้าไปตลอดชีวิต
    if (smallpox && age < 15 && !ch.hadSmallpox && ctx.rng.chance(M.smallpoxAttack)) {
      if (!isGraced(ctx, ch) && ctx.rng.chance(Math.min(1, M.smallpoxFatality * frail))) {
        markDead(ctx, ch, 'situation:smallpox');
        if (!isPlayer) died(ch.name, age, 'situation:smallpox');
        continue;
      }
      ch.hadSmallpox = true;
      const scarred = ctx.rng.chance(M.smallpoxScarChance);
      if (scarred) addScar(ctx, ch, 'face' as PartDefId, 'pox', ctx.rng.range(0.2, 0.6));
      if (isPlayer) out.push(`${ch.name}รอดจากไข้ทรพิษ${scarred ? ' แต่มีรอยแผลเป็นบนหน้า' : ''}`);
    }
    // ผู้เล่น: ลูกเต๋าฐานลดลง (playerAdultScale) และความหนักใจสูงเพิ่มความเสี่ยง — ดู docs/design-choice-risk.md
    const playerMult = isPlayer && age >= 15
      ? M.playerAdultScale * (1 + M.stressSlope * Math.max(0, ch.stress - M.stressFrom)) * (ch.illYear === yearOf(ctx, day - 1) ? M.illMult : 1) : 1;
    const risk = Math.min(1, yearlyDeathRisk(ctx, age, frail) * playerMult);
    if (isGraced(ctx, ch)) continue;
    const cause: TagId = age >= M.oldAgeCause ? 'situation:old_age' : 'situation:illness';
    // ผู้เล่นวัย 15–59: ส่วนหนึ่งของการตายด้วยไข้เปลี่ยนเป็น "ไข้หนัก" ให้ตัดสินใจรักษา (เสี่ยงรวมของผู้เล่นสุ่มคงเดิม)
    if (isPlayer && age >= 15 && cause === 'situation:illness') {
      const u = ctx.rng.next();
      // ลูกเต๋าล้วน risk×d + event risk×2(1−d) ที่ตายเฉลี่ยครึ่งหนึ่ง (ตัวเลือก 0.3/0.5/0.7) → ตายรวม = risk เท่าเดิมทุกค่า d
      if (u >= risk * (M.graveIllnessDiceShare + 2 * (1 - M.graveIllnessDiceShare))) continue;
      if (u >= risk * M.graveIllnessDiceShare) {
        S.meta.graveIllness = true;
        continue;
      }
    } else if (!ctx.rng.chance(risk)) continue;
    markDead(ctx, ch, cause);
    if (!isPlayer) died(ch.name, age, cause);
  }
  return out;
}

/**
 * ลูกของผู้เล่นที่ร่างกายอ่อนแอแต่กำเนิด → คนแถวบ้านทักว่าเลี้ยงยาก (lore: psyche.hard_to_raise_child) ครั้งเดียวต่อคน
 * ทางแก้ตามความเชื่อทำให้พ่อแม่ใจชื้นขึ้น แต่ไม่เปลี่ยนร่างกายเด็ก — เกมไม่ตัดสินว่าความเชื่อได้ผล
 */
export function hardToRaiseEvent(ctx: Ctx): PreparedEvent | null {
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player)) return null;
  const C = ctx.content.balance.constitution;
  const kid = livingChildren(ctx, player).find((k) =>
    !k.hardToRaise && (k.constitution ?? 0) < C.hardToRaiseBelow && ageOf(ctx, k) >= C.hardToRaiseAge && ageOf(ctx, k) < 5);
  if (!kid) return null;
  kid.hardToRaise = true;
  return prepareEvent(ctx, 'family.hard_to_raise', { actor: player.id, child: kid.id });
}

/**
 * ปลูกฝี (ตั้งแต่ rules.json › institutions.inoculation.from): เสนอให้ผู้เล่นตัดสินใจปีละไม่เกินหนึ่งครั้ง สำหรับลูกที่ยังไม่เคยเป็นไข้ทรพิษ อายุ 1–14
 * เสนอครั้งเดียวต่อเด็ก (inoculationOffered) — เรียกทุก 1 ม.ค. หลัง mortalityYearTick
 */
export function inoculationEvent(ctx: Ctx): PreparedEvent | null {
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || !institutionActive(ctx, 'inoculation')) return null;
  const kid = livingChildren(ctx, player).find((k) => !k.hadSmallpox && !k.inoculationOffered && ageOf(ctx, k) >= 1 && ageOf(ctx, k) < 15);
  if (!kid) return null;
  kid.inoculationOffered = true;
  return prepareEvent(ctx, 'health.inoculation', { actor: player.id, child: kid.id });
}
