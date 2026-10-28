import { isAlive, must, type Ctx } from '../core/ctx';
import type { Character, FamilyNode, FamilyNodeId } from '../core/types';
import { snapshotToNode } from './handover';

// ============================================================================
// Data Pruning — ทำทุกครั้งที่ handover (และเป็นระยะระหว่างเล่น)
//
//  L0 → L1 : ตัวละครที่ตาย → ลบ Character + memories/traits/wounds/bodyParts/relations
//            เหลือ FamilyNode.summary (ไม่กี่สิบ byte) — ปมที่ส่งต่อแล้วไม่ dangling
//            เพราะ TraitOrigin.social เก็บ fromNodeId/kind/target เป็น snapshot
//  L1 → BranchSummary : สายรองที่ตายหมด ไม่มีตำนาน ไม่ใช่บรรพบุรุษผู้เล่น
//            และอยู่ไกลเกิน keepKinDistance → ยุบเหลือบรรทัดเดียวใน Dynasty
//  NPC ที่ยังมีชีวิตแต่ไกลตัว → lod 'light' เก็บแค่ความทรงจำฝังใจ N อัน
//  Event log เก่าเกินกำหนด → ลบ (Memory อยู่ได้เองเพราะเก็บ percepts ไว้แล้ว)
// ============================================================================

export interface PruneReport {
  charactersCollapsed: number;
  nodesMerged: number;
  memoriesDropped: number;
  eventsDropped: number;
}

export function pruneState(ctx: Ctx): PruneReport {
  const B = ctx.content.balance.prune;
  const S = ctx.state;
  const report: PruneReport = { charactersCollapsed: 0, nodesMerged: 0, memoriesDropped: 0, eventsDropped: 0 };
  const player = must(S.characters[S.meta.playerCharacterId], 'player');
  const dist = kinDistances(ctx, player.familyNodeId);
  const ancestors = ancestorSet(ctx, player.familyNodeId);

  // L0 → L1
  for (const ch of Object.values(S.characters)) {
    if (isAlive(ch) || ch.id === player.id) continue;
    collapseCharacter(ctx, ch, report);
  }

  // NPC ไกลตัว → light
  for (const ch of Object.values(S.characters)) {
    const d = dist.get(ch.familyNodeId) ?? Infinity;
    if (d <= B.keepKinDistance) continue;
    ch.lod = 'light';
    const keep = ch.memoryIds
      .map((id) => S.memories[id])
      .filter((m) => !!m)
      .sort((a, b) => Number(b!.formative) - Number(a!.formative) || b!.intensity - a!.intensity)
      .slice(0, B.lightMemoryKeep)
      .map((m) => m!.id);
    for (const id of ch.memoryIds) {
      if (keep.includes(id)) continue;
      delete S.memories[id];
      report.memoriesDropped++;
    }
    ch.memoryIds = keep;
  }

  // L1 → BranchSummary
  for (const node of Object.values(S.familyNodes)) {
    if (!S.familyNodes[node.id]) continue; // ถูกยุบไปแล้วในรอบนี้
    if (ancestors.has(node.id) || (dist.get(node.id) ?? Infinity) <= B.keepKinDistance) continue;
    const subtree = collectSubtree(ctx, node);
    const removable = subtree.every((n) => n.characterId === null && n.legendIds.length === 0 && !ancestors.has(n.id));
    if (!removable) continue;
    const parentId = node.fatherId ?? node.motherId;
    const parent = parentId ? S.familyNodes[parentId] : undefined;
    const dyn = node.dynastyId ? S.dynasties[node.dynastyId] : undefined;
    if (!parent || !dyn) continue;
    dyn.branchSummaries.push({
      rootNodeId: parent.id,
      label: `สายของ${node.name}`,
      memberCount: subtree.length,
      generations: Math.max(...subtree.map((n) => n.generation)) - node.generation + 1,
    });
    parent.childIds = parent.childIds.filter((id) => id !== node.id);
    for (const n of subtree) {
      for (const sid of n.spouseIds) {
        const sp = S.familyNodes[sid];
        if (sp) sp.spouseIds = sp.spouseIds.filter((id) => id !== n.id);
      }
      delete S.familyNodes[n.id];
    }
    report.nodesMerged += subtree.length;
  }

  // Event log
  for (const ev of Object.values(S.eventLog)) {
    if (S.meta.day - ev.day <= B.eventLogMaxAgeDays) continue;
    delete S.eventLog[ev.id];
    report.eventsDropped++;
  }
  for (const m of Object.values(S.memories)) if (m.eventInstanceId && !S.eventLog[m.eventInstanceId]) m.eventInstanceId = null;

  return report;
}

function collapseCharacter(ctx: Ctx, ch: Character, report: PruneReport): void {
  const S = ctx.state;
  const node = S.familyNodes[ch.familyNodeId];
  if (node && !node.summary) snapshotToNode(ctx, ch);
  // memory ที่เป็นต้นเหตุแผลเป็นในตำนาน ถูก "ย่อย" ลง Legend.truth แล้ว จึงลบได้
  for (const id of ch.memoryIds) delete S.memories[id];
  for (const id of ch.traitIds) delete S.traits[id];
  for (const id of ch.woundIds) delete S.wounds[id];
  for (const id of ch.bodyPartIds) delete S.bodyParts[id];
  for (const r of Object.values(S.relations)) if (r.from === ch.id || r.to === ch.id) delete S.relations[r.id];
  for (const hh of Object.values(S.households)) hh.memberIds = hh.memberIds.filter((id) => id !== ch.id);
  for (const c of Object.values(S.characters)) c.caregiverIds = c.caregiverIds.filter((id) => id !== ch.id);
  delete S.characters[ch.id];
  if (node) {
    node.characterId = null;
    node.pruneLevel = 1;
  }
  report.charactersCollapsed++;
}

/** BFS บนผังตระกูล (พ่อ แม่ ลูก คู่ครอง) */
function kinDistances(ctx: Ctx, from: FamilyNodeId): Map<FamilyNodeId, number> {
  const dist = new Map<FamilyNodeId, number>([[from, 0]]);
  const queue: FamilyNodeId[] = [from];
  while (queue.length) {
    const id = queue.shift()!;
    const n = ctx.state.familyNodes[id];
    if (!n) continue;
    const d = dist.get(id)!;
    const next = [n.fatherId, n.motherId, ...n.childIds, ...n.spouseIds].filter((x): x is FamilyNodeId => !!x);
    for (const x of next) {
      if (dist.has(x)) continue;
      dist.set(x, d + 1);
      queue.push(x);
    }
  }
  return dist;
}

function ancestorSet(ctx: Ctx, from: FamilyNodeId): Set<FamilyNodeId> {
  const out = new Set<FamilyNodeId>();
  const stack: FamilyNodeId[] = [from];
  while (stack.length) {
    const n = ctx.state.familyNodes[stack.pop()!];
    if (!n || out.has(n.id)) continue;
    out.add(n.id);
    if (n.fatherId) stack.push(n.fatherId);
    if (n.motherId) stack.push(n.motherId);
  }
  return out;
}

function collectSubtree(ctx: Ctx, root: FamilyNode): FamilyNode[] {
  const out: FamilyNode[] = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    out.push(n);
    for (const c of n.childIds) {
      const child = ctx.state.familyNodes[c];
      if (child) stack.push(child);
    }
  }
  return out;
}
