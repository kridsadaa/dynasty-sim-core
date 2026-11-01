import type { Ctx } from '../core/ctx';
import type { CharacterId, RelationKind } from '../core/types';

// ============================================================================
// Opinion — ความรู้สึกที่ from มีต่อ to เป็นตัวเลขเดียว −100..100 สำหรับแสดงผล
//
//  รวมจาก Relation หลายชนิดที่ระบบอื่นเก็บไว้ (เพื่อน ความรัก ความแค้น บุญคุณ …) — ไม่ได้เก็บเพิ่มใน state
//  น้ำหนักแต่ละชนิดเป็นค่าของเกม: ความแค้นหนักกว่ามิตรภาพ (ลืมยากกว่า)
// ============================================================================

const AFFECTION = 60;
const WEIGHT: Partial<Record<RelationKind, number>> = {
  friend: 50, gratitude: 40, spouse: 30, acquaintance: 15, grudge: -80, rival: -30,
};

/** พ่อแม่ ลูก ผัวเมีย — ความรักใคร่มีค่าตั้งต้นเสมอ (will.ts bond) แม้ยังไม่เคยมีเรื่องให้เปลี่ยน */
function closeKin(ctx: Ctx, from: CharacterId, to: CharacterId): boolean {
  const S = ctx.state;
  const fromNode = S.characters[from]?.familyNodeId;
  const a = fromNode ? S.familyNodes[fromNode] : undefined;
  const b = S.characters[to]?.familyNodeId;
  return !!a && !!b && (a.fatherId === b || a.motherId === b || a.childIds.includes(b) || a.spouseIds.includes(b));
}

export function opinion(ctx: Ctx, from: CharacterId, to: CharacterId): number {
  const stored = ctx.state.relations[`${from}|${to}|affection`]?.strength;
  let v = (stored ?? (closeKin(ctx, from, to) ? ctx.content.balance.bond.affection : 0)) * AFFECTION;
  for (const [kind, w] of Object.entries(WEIGHT) as Array<[RelationKind, number]>) {
    v += (ctx.state.relations[`${from}|${to}|${kind}`]?.strength ?? 0) * w;
  }
  return Math.round(Math.max(-100, Math.min(100, v)));
}

/** "ชอบพอ +35" — ใช้ทั้งหน้าดูตัวละครและหน้าผลของตัวเลือก */
export function opinionLabel(v: number): string {
  const word = v >= 60 ? 'รักใคร่' : v >= 25 ? 'ชอบพอ' : v > -25 ? 'เฉยๆ' : v > -60 ? 'ไม่ชอบหน้า' : 'เกลียดชัง';
  return `${word} ${v > 0 ? '+' : ''}${v}`;
}
