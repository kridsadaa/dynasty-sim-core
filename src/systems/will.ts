import type { Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, Resist } from '../core/types';

// ============================================================================
// Will — นิสัยและความรู้สึกต่อคนรอบตัว กำหนดว่าตัวละคร "ยอม" เลือกอะไรได้บ้าง
//
//  ตัวเลือก.resist ──► แรงต้าน r ──┬─ r < strainAt : เลือกได้ตามปกติ
//                                 ├─ r < lockAt   : เลือกได้แต่ฝืนใจ → เครียดเพิ่ม r × stressPerResist
//                                 └─ r ≥ lockAt   : ล็อก พร้อมเหตุผลจากข้อที่ต้านแรงที่สุด
//
// Bond (ความรู้สึกของลูกต่อพ่อแม่) เก็บเป็น Relation kind 'affection' / 'awe'
// ยังไม่มีค่าใน state → ใช้ค่าเริ่มต้นจากความดุของพ่อแม่ (เซฟเก่าใช้ได้ไม่ต้อง migrate)
// ============================================================================

export type BondAxis = 'affection' | 'awe';

/** ความดุ = 1 − agreeableness: พ่อแม่ที่ดุทำให้ลูกเกรงตั้งแต่แรก และดุแล้วลูกเจ็บกว่า */
const harshness = (ch: Character) => 1 - ch.personality.agreeableness;

export function bond(ctx: Ctx, from: Character, to: Character, axis: BondAxis): number {
  const r = ctx.state.relations[`${from.id}|${to.id}|${axis}`];
  if (r) return r.strength;
  const B = ctx.content.balance.bond;
  return axis === 'affection' ? B.affection : clamp01(B.aweBase + B.aweFromHarshness * harshness(to));
}

/** ส่วนที่ทำให้แย่ลง (affection ลด / awe เพิ่ม) แรงขึ้นตามความดุของ to — ×0.5 (ใจดีมาก) ถึง ×1.5 (ดุมาก) */
export function adjustBond(ctx: Ctx, from: Character, to: Character, axis: BondAxis, delta: number): number {
  const hurt = axis === 'affection' ? delta < 0 : delta > 0;
  const d = hurt ? delta * (0.5 + harshness(to)) : delta;
  const next = bond(ctx, from, to, axis) + d;
  const strength = axis === 'affection' ? Math.max(-1, Math.min(1, next)) : clamp01(next);
  const id = `${from.id}|${to.id}|${axis}`;
  const prev = ctx.state.relations[id];
  ctx.state.relations[id] = { id, from: from.id, to: to.id, kind: axis, strength, sinceDay: prev?.sinceDay ?? ctx.state.meta.day };
  return strength;
}

export interface Resistance {
  value: number;
  /** reasonKey ของข้อที่ต้านแรงที่สุด + role ที่เกี่ยวข้อง (ใช้เติมชื่อในข้อความ) */
  reasonKey: string;
  role?: string;
}

export function resistance(
  ctx: Ctx, actor: Character, resist: Resist[], who: (role: string) => Character | undefined,
): Resistance | null {
  let value = 0;
  let top: { part: number; reasonKey: string; role?: string } | null = null;
  for (const r of resist) {
    let v: number;
    if (r.source === 'bond') {
      const other = who(r.role);
      if (!other) continue;
      v = bond(ctx, actor, other, r.axis);
    } else {
      const p = actor.personality[r.trait];
      v = r.invert ? 1 - p : p;
    }
    const part = Math.max(0, r.weight * v);
    value += part;
    if (part > 0 && (!top || part > top.part)) top = { part, reasonKey: r.reasonKey, role: r.source === 'bond' ? r.role : undefined };
  }
  return top ? { value, reasonKey: top.reasonKey, role: top.role } : null;
}
