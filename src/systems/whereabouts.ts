import { isNovice, type Ctx } from '../core/ctx';
import type { Character, GameEventDef, Whereabouts } from '../core/types';
import { atWar } from './campaign';

// ============================================================================
// ที่อยู่ตอนนี้ (PLAN ข้อ 5b) — ตัวละครอยู่เรือน อยู่วัด หรืออยู่ในทัพ
//  ที่เดียวที่ตอบคำถามนี้: world.ts งดเรื่องในเรือน, intent.ts awayLabor, barge.ts, festivals.ts companions, views.ts แผงตัวละคร
//  event ประกาศที่ที่เกิดได้ใน trigger.at (ไม่ใส่ = เฉพาะที่เรือน) — pickEvent กรองตามนี้ และ sim:check ตรวจทุก event ที่ส่งถึงผู้เล่น
//  ย้ายไปอยู่ใกล้บ้านคนที่หมายปอง (intent) ยังนับเป็นเรือน — แรงงานที่หายไปคิดใน awayLabor
//  สถานะใหม่ (ถูกกวาดต้อน บวชตลอดชีวิต ไปราชการหัวเมือง) เพิ่มที่นี่ที่เดียว
// ============================================================================

export function whereabouts(ctx: Ctx, ch: Character): Whereabouts {
  if (atWar(ctx, ch)) return 'army';
  if (isNovice(ctx, ch) || ch.social.estate === 'monk') return 'temple';
  return 'home';
}

/** event นี้เกิดกับคนที่อยู่ที่นี่ได้ไหม (trigger.at ไม่ใส่ = เฉพาะที่เรือน) */
export function allowedAt(def: GameEventDef, where: Whereabouts): boolean {
  return (def.trigger.at ?? ['home']).includes(where);
}
