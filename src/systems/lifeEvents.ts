import { ageOf, isAlive, yearOf, type Ctx } from '../core/ctx';
import type { Character } from '../core/types';
import { prepareEvent, type PreparedEvent } from './events';
import { livingChildren, livingParents } from './factory';

// ============================================================================
// event วัยผู้ใหญ่และวัยชรา — ปีละครั้ง เฉพาะผู้เล่น (ตัวเลขทั้งหมดเป็นของเกม)
//
//  โกนจุกลูก อายุ 11 หรือ 13 ทั้งลูกชายลูกสาว (lore: ritual.topknot_cutting)
//  พ่อแม่ป่วยหนัก — ลูกที่ไม่รักษาไข้เสียสิทธิ์มรดก (lore: social.nursing_cremation_condition)
//  ผู้ใหญ่ถือศีลวันพระ ไปจำศีลที่วัด (lore: ritual.holy_days_1680s)
// ============================================================================

/** ลูกของผู้เล่นที่อายุ 11 หรือ 13 และยังไม่ได้โกนจุก */
export function topknotEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.life;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player)) return null;
  const kid = livingChildren(ctx, player).find((k) => k.topknotCutYear === undefined && B.topknotAges.includes(ageOf(ctx, k)));
  return kid ? prepareEvent(ctx, 'ritual.topknot', { actor: player.id, child: kid.id }) : null;
}

/** effect topknot: โกนจุกแล้ว (หรือปล่อยผ่านจนพ้นวัย) — ไม่ถามอีก */
export function markTopknot(ctx: Ctx, kid: Character): string {
  kid.topknotCutYear = yearOf(ctx, ctx.state.meta.day);
  return `${kid.name}โกนจุกแล้ว`;
}

/** พ่อหรือแม่ของผู้เล่นที่แก่แล้วป่วยหนัก */
export function parentIllnessEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.life;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || ageOf(ctx, player) < B.adultAge) return null;
  const year = yearOf(ctx, ctx.state.meta.day);
  const parent = livingParents(ctx, player).find((p) => ageOf(ctx, p) >= B.illnessAge && p.illYear !== year);
  if (!parent || !ctx.rng.chance(B.illnessChance)) return null;
  parent.illYear = year;
  return prepareEvent(ctx, 'family.parent_illness', { actor: player.id, elder: parent.id });
}

/**
 * effect nurse: neglected = ไม่ได้รักษาไข้ → ไม่ได้ส่วนมรดกจากพ่อแม่คนนี้ (estateHeirs; ลักษณมรดก ม.๒๙ ญาติแขวงเดียวกัน)
 * ติดราชการ (มีตำแหน่ง) ได้รับยกเว้น — ตัวบท ม.๒๗–๒๘, ๓๐ แยกในวัง/หัวเมือง/เมืองไกล เกมรวบเป็นได้เต็มส่วน
 */
export function markNursing(ctx: Ctx, child: Character, parent: Character, neglected: boolean): string[] {
  if (!neglected) return [];
  if (child.office) return [`${child.name}ติดราชการ ไม่ได้ไปรักษาไข้${parent.name} — ตามกฎหมายยังมีสิทธิ์ในมรดกเต็มส่วน`];
  parent.neglectedBy = [...new Set([...(parent.neglectedBy ?? []), child.id])];
  return [`${child.name}ไม่ได้รักษาไข้${parent.name} — ถ้า${parent.name}ตาย จะไม่ได้ส่วนมรดก`];
}

/** ผู้เล่นวัยชราถือศีลวันพระ */
export function elderPreceptsEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.life;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || ageOf(ctx, player) < B.elderAge || !ctx.rng.chance(B.preceptsChance)) return null;
  return prepareEvent(ctx, 'ritual.elder_precepts', { actor: player.id });
}
