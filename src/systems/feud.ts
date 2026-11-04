import { ageOf, isAlive, type Ctx } from '../core/ctx';
import { spawnLocal } from './acquaintance';
import { prepareEvent, type PreparedEvent } from './events';

// ============================================================================
// ล้างแค้น (docs/design-choice-risk.md 2a) — ลอบฆ่าสำเร็จ (op feud ใน scheme.assassin) เก็บเรื่องไว้ใน meta.feuds
// ถึงกำหนด (1–3 ปีหลังเกิดเหตุ) ญาติของเหยื่อมาถึง: เรียกทุก 1 ม.ค. (world.ts) เสนอ event ให้เฉพาะ "ผู้เล่นคนที่สั่งฆ่า"
// ถ้าผู้สั่งตายไปแล้ว เรื่องจบ — ผู้สืบไม่ต้องรับกรรม (หลักการข้อ 5) ตัวเลขทั้งหมดเป็นของเกม (lore: social.feud_revenge, invented)
// ============================================================================

export function feudEvent(ctx: Ctx): PreparedEvent | null {
  const S = ctx.state;
  const feuds = S.meta.feuds;
  if (!feuds?.length) return null;
  const player = S.characters[S.meta.playerCharacterId];
  const day = S.meta.day;
  // เรื่องของคนที่ตายไปแล้ว หรือไม่ใช่ผู้เล่นปัจจุบัน → จบ (ไม่ส่งต่อให้ผู้สืบ)
  const live = feuds.filter((f) => f.actorId === player?.id && isAlive(player));
  const due = live.find((f) => f.dueDay <= day);
  S.meta.feuds = live.filter((f) => f !== due);
  if (!S.meta.feuds.length) delete S.meta.feuds;
  if (!due || !player || ageOf(ctx, player) < 16) return null;
  const avenger = spawnLocal(ctx, player, { sex: ctx.rng.chance(0.7) ? 'm' : 'f', age: Math.round(ctx.rng.range(24, 48)), distance: 'far' });
  return prepareEvent(ctx, 'feud.revenge', { actor: player.id, avenger: avenger.id });
}
