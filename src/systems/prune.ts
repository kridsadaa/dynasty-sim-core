import { isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { BranchSummary, Character, Dynasty, FamilyNode, FamilyNodeId } from '../core/types';
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
//  ญาติที่ยังมีชีวิตแต่ห่างเกิน driftKinDistance → แยกไปอยู่ที่อื่น (ยุบแบบคนตาย + FamilyNode.driftedYear)
//            ตระกูลนับญาติทั้งสองฝ่าย ลูกหลานจึงเพิ่มเท่าตัวทุกรุ่น — ไม่ยุบ เซฟโตและจำลองช้าลงเรื่อยๆ
//  Event log เก่าเกินกำหนด → ลบ (Memory อยู่ได้เองเพราะเก็บ percepts ไว้แล้ว)
// ============================================================================

export interface PruneReport {
  charactersCollapsed: number;
  charactersDrifted: number;
  nodesMerged: number;
  memoriesDropped: number;
  eventsDropped: number;
}

export function pruneState(ctx: Ctx): PruneReport {
  const B = ctx.content.balance.prune;
  const S = ctx.state;
  const report: PruneReport = { charactersCollapsed: 0, charactersDrifted: 0, nodesMerged: 0, memoriesDropped: 0, eventsDropped: 0 };
  const player = must(S.characters[S.meta.playerCharacterId], 'player');
  const dist = kinDistances(ctx, player.familyNodeId);
  const ancestors = ancestorSet(ctx, player.familyNodeId);

  // L0 → L1 — ยกเว้นคนตายที่ event ยังไม่ได้ตอบอ้างถึงอยู่ (งานศพที่ตายวันเดียวกับ handover) ยุบรอบหน้า
  const pending = new Set(Object.values(S.eventLog).filter((e) => e.optionId === null).flatMap((e) => Object.values(e.bindings)));
  collapseCharacters(ctx, Object.values(S.characters).filter((ch) => !isAlive(ch) && ch.id !== player.id && !pending.has(ch.id)), report);

  // ญาติห่างไกลที่ยังมีชีวิต → แยกไปอยู่ที่อื่น
  driftAway(ctx, dist, ancestors, pending, report);

  // NPC ไกลตัว → light (กลับมาใกล้หลัง handover → full อีกครั้ง แต่ความทรงจำที่ตัดไปแล้วไม่กลับมา)
  for (const ch of Object.values(S.characters)) {
    const d = dist.get(ch.familyNodeId) ?? Infinity;
    if (d <= B.keepKinDistance) {
      ch.lod = 'full';
      continue;
    }
    ch.lod = 'light';
    // memory ที่แผลเป็น/ปมยังอ้างอยู่ต้องอยู่ต่อ (ไม่นับโควตา) — ตำนานจากแผลเป็นนั้นต้องใช้ percepts ตอนคนนี้ตาย
    const referenced = referencedMemories(ctx, ch);
    const keep = [
      ...ch.memoryIds.filter((id) => referenced.has(id) && S.memories[id]),
      ...ch.memoryIds
        .filter((id) => !referenced.has(id))
        .map((id) => S.memories[id])
        .filter((m) => !!m)
        .sort((a, b) => Number(b!.formative) - Number(a!.formative) || b!.intensity - a!.intensity)
        .slice(0, B.lightMemoryKeep)
        .map((m) => m!.id),
    ];
    for (const id of ch.memoryIds) {
      if (keep.includes(id)) continue;
      delete S.memories[id];
      report.memoriesDropped++;
    }
    ch.memoryIds = keep;
  }

  // L1 → BranchSummary
  const pinned = pinnedNodes(ctx);
  const canDrop = (n: FamilyNode) => n.characterId === null && n.legendIds.length === 0 && !ancestors.has(n.id) && !pinned.has(n.id);
  for (const node of Object.values(S.familyNodes)) {
    if (!S.familyNodes[node.id]) continue; // ถูกยุบไปแล้วในรอบนี้
    if (ancestors.has(node.id) || (dist.get(node.id) ?? Infinity) <= B.keepKinDistance) continue;
    // ผูกสรุปสายไว้กับพ่อแม่ฝ่ายที่เป็นสายเลือด (ลูกสาวแต่งเขยคนนอก → ผูกกับแม่ ไม่ใช่เขยซึ่งอาจถูกยุบไปทีหลัง)
    const parents = [node.fatherId, node.motherId].map((id) => (id ? S.familyNodes[id] : undefined)).filter((n): n is FamilyNode => !!n);
    const parent = parents.find((n) => !isMarriedIn(ctx, n)) ?? parents[0];
    const dyn = node.dynastyId ? S.dynasties[node.dynastyId] : undefined;
    if (!parent || !dyn) continue; // คู่ครองคนนอก (ไม่มีพ่อแม่ในผัง) ยุบพร้อมสายของคู่ ไม่ยุบเดี่ยว
    const subtree = collectSubtree(ctx, node);
    const inLaws = marriedInOf(ctx, subtree);
    // สายที่ตายหมด — รวมคู่ครองคนนอกของสายด้วย (เขย/สะใภ้ที่ยังมีชีวิตอยู่ = สายยังไม่จบ)
    if (!subtree.every(canDrop) || !inLaws.every(canDrop)) continue;
    const gone = [...subtree, ...inLaws];
    // สายที่ยุบไว้ก่อนแล้วใต้คนในสายนี้ → รวมเข้ามา ไม่งั้นบรรทัดนั้นผูกกับคนที่ไม่อยู่ในผังแล้ว
    const goneIds = new Set<string>(gone.map((n) => n.id));
    const inner = dyn.branchSummaries.filter((b) => goneIds.has(b.rootNodeId));
    dyn.branchSummaries = dyn.branchSummaries.filter((b) => !goneIds.has(b.rootNodeId));
    const depth = (b: BranchSummary) => (S.familyNodes[b.rootNodeId]?.generation ?? node.generation) - node.generation + 1 + b.generations;
    addBranchSummary(dyn, parent.id, {
      names: [node.name],
      memberCount: gone.length + inner.reduce((a, b) => a + b.memberCount, 0),
      generations: Math.max(Math.max(...subtree.map((n) => n.generation)) - node.generation + 1, ...inner.map(depth)),
      drifted: subtree.some((n) => n.driftedYear !== undefined) || inner.some((b) => b.drifted),
    });
    for (const n of gone) delete S.familyNodes[n.id];
    report.nodesMerged += gone.length;
  }
  // เก็บกวาดเสมอ (ไม่ใช่เฉพาะรอบที่ยุบ) — เซฟเก่าอาจมีคู่ครองคนนอกค้างอยู่จากก่อนแก้
  dropDanglingKin(ctx, (n) => canDrop(n) && (dist.get(n.id) ?? Infinity) > B.keepKinDistance, report);

  // Event log
  for (const ev of Object.values(S.eventLog)) {
    if (S.meta.day - ev.day <= B.eventLogMaxAgeDays) continue;
    delete S.eventLog[ev.id];
    report.eventsDropped++;
  }
  for (const m of Object.values(S.memories)) if (m.eventInstanceId && !S.eventLog[m.eventInstanceId]) m.eventInstanceId = null;

  return report;
}

/** ยุบตัวละครทีละกลุ่ม — ตารางที่อ้างข้ามคน (relations, intents, เรือน, ผู้เลี้ยงดู) กวาดรอบเดียวทั้งกลุ่ม ไม่ใช่รอบละคน */
/** สายที่ยุบใต้คนเดียวกันรวมเป็นบรรทัดเดียว: "สายของ ก, ข และอีก 3 สาย — 40 คน 4 รุ่น" */
function addBranchSummary(
  dyn: Dynasty, rootNodeId: FamilyNodeId, b: { names: string[]; memberCount: number; generations: number; drifted: boolean },
): void {
  const prev = dyn.branchSummaries.find((x) => x.rootNodeId === rootNodeId);
  const names = [...(prev ? prev.names ?? [prev.label.replace(/^สายของ/, '').replace(/ \(แยกไปอยู่ที่อื่น\)$/, '')] : []), ...b.names];
  const drifted = b.drifted || !!prev?.drifted;
  const row: BranchSummary = {
    rootNodeId,
    names,
    label: `สายของ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` และอีก ${names.length - 3} สาย` : ''}${drifted ? ' (แยกไปอยู่ที่อื่น)' : ''}`,
    memberCount: b.memberCount + (prev?.memberCount ?? 0),
    generations: Math.max(b.generations, prev?.generations ?? 0),
    ...(drifted ? { drifted } : {}),
  };
  if (prev) Object.assign(prev, row);
  else dyn.branchSummaries.push(row);
}

function collapseCharacters(ctx: Ctx, chars: Character[], report: PruneReport): void {
  if (!chars.length) return;
  const S = ctx.state;
  const gone = new Set<string>(chars.map((c) => c.id));
  for (const ch of chars) {
    const node = S.familyNodes[ch.familyNodeId];
    if (node && !node.summary) snapshotToNode(ctx, ch);
    // memory ที่เป็นต้นเหตุแผลเป็นในตำนาน ถูก "ย่อย" ลง Legend.truth แล้ว จึงลบได้
    for (const id of ch.memoryIds) delete S.memories[id];
    for (const id of ch.traitIds) delete S.traits[id];
    for (const id of ch.woundIds) delete S.wounds[id];
    for (const id of ch.bodyPartIds) delete S.bodyParts[id];
    delete S.characters[ch.id];
    if (node) {
      node.characterId = null;
      node.pruneLevel = 1;
    }
    report.charactersCollapsed++;
  }
  for (const r of Object.values(S.relations)) if (gone.has(r.from) || gone.has(r.to)) delete S.relations[r.id];
  // ความตั้งใจที่คนเหล่านี้ทำหรือเป็นเป้า — ไม่รอให้ tickIntents เดือนหน้าเก็บกวาด (ตายวันเดียวกับรอบ prune)
  for (const i of Object.values(S.intents)) if (gone.has(i.actorId) || gone.has(i.targetId)) delete S.intents[i.id];
  for (const hh of Object.values(S.households)) if (hh.memberIds.some((id) => gone.has(id))) hh.memberIds = hh.memberIds.filter((id) => !gone.has(id));
  for (const c of Object.values(S.characters)) if (c.caregiverIds.some((id) => gone.has(id))) c.caregiverIds = c.caregiverIds.filter((id) => !gone.has(id));
}

/**
 * ญาติที่ห่างจากผู้เล่นเกิน driftKinDistance แยกไปอยู่ที่อื่น — เป็นกลไกของเกม (ขาดการติดต่อกันไป) ไม่ได้มาจาก lore
 * แยกทั้งเรือน: เรือนที่มีสมาชิกคนใดยังใกล้ผู้เล่นไม่แยก; คนที่ไม่มีเรือนแยกคนเดียว
 * ไม่แยก: คนรู้จักนอกตระกูล (ระบบคนรู้จักจัดการเอง), บรรพบุรุษ, ผู้นำ/ต้นตระกูล, คนที่ event รอคำตอบอ้างถึง,
 *         และคนที่ตัวละครอื่นผูกไว้ (คู่หมั้น หนีตามกัน ช่วยงานบ้าน มูลนาย)
 * ทรัพย์ส่วนตัวไปกับเจ้าของ; ของประจำตระกูลอยู่กับตระกูล
 */
function driftAway(
  ctx: Ctx, dist: Map<FamilyNodeId, number>, ancestors: Set<FamilyNodeId>, pending: Set<string>, report: PruneReport,
): void {
  const S = ctx.state;
  const B = ctx.content.balance.prune;
  const pinned = pinnedNodes(ctx);
  const bound = new Set<string>();
  for (const c of Object.values(S.characters)) {
    for (const id of [c.betrothal?.toId, c.eloped?.withId, c.service?.hostId, c.social.patronId]) if (id) bound.add(id);
  }
  const far = (c: Character) =>
    isAlive(c) && !c.local && c.id !== S.meta.playerCharacterId && (dist.get(c.familyNodeId) ?? Infinity) > B.driftKinDistance &&
    !ancestors.has(c.familyNodeId) && !pinned.has(c.familyNodeId) && !pending.has(c.id) && !bound.has(c.id);
  const leaving: Character[] = [];
  const leavingHouseholds: string[] = [];
  for (const hh of Object.values(S.households)) {
    const members = hh.memberIds.map((id) => S.characters[id]).filter((c): c is Character => !!c);
    if (members.length && members.every(far)) {
      leaving.push(...members);
      leavingHouseholds.push(hh.id);
    }
  }
  for (const c of Object.values(S.characters)) if (!c.householdId && far(c)) leaving.push(c);
  if (!leaving.length) return;
  const year = yearOf(ctx, S.meta.day);
  const ids = new Set<string>(leaving.map((c) => c.id));
  for (const it of Object.values(S.items)) if (it.ownerCharacterId && ids.has(it.ownerCharacterId)) delete S.items[it.id];
  for (const id of leavingHouseholds) delete S.households[id as keyof typeof S.households];
  for (const c of leaving) {
    const node = S.familyNodes[c.familyNodeId];
    if (node) node.driftedYear = year;
    c.householdId = null;
  }
  collapseCharacters(ctx, leaving, report);
  report.charactersCollapsed -= leaving.length;
  report.charactersDrifted += leaving.length;
}

function referencedMemories(ctx: Ctx, ch: Character): Set<string> {
  const S = ctx.state;
  const out = new Set<string>();
  for (const pid of ch.bodyPartIds) for (const s of S.bodyParts[pid]?.scars ?? []) if (s.originMemoryId) out.add(s.originMemoryId);
  for (const id of ch.traitIds) {
    const o = S.traits[id]?.origin;
    if (o?.type === 'experience') out.add(o.memoryId);
  }
  for (const id of ch.woundIds) {
    const m = S.wounds[id]?.memoryId;
    if (m) out.add(m);
  }
  return out;
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

/** คู่ครองคนนอก = ไม่มีพ่อแม่อยู่ในผัง (แต่งเข้ามา) */
function isMarriedIn(ctx: Ctx, n: FamilyNode): boolean {
  const S = ctx.state;
  return !(n.fatherId && S.familyNodes[n.fatherId]) && !(n.motherId && S.familyNodes[n.motherId]);
}

/** node ที่ห้ามยุบเพราะ Dynasty อ้างอิงอยู่ (ต้นตระกูล/หัวหน้าตระกูล — ต้นตระกูลก็ไม่มีพ่อแม่ในผังเหมือนคนนอก) */
function pinnedNodes(ctx: Ctx): Set<FamilyNodeId> {
  const out = new Set<FamilyNodeId>();
  for (const d of Object.values(ctx.state.dynasties)) out.add(d.founderNodeId).add(d.headNodeId);
  return out;
}

/**
 * คู่ครองคนนอกที่ผูกกับสายนี้สายเดียว (คู่ครองทุกคนและลูกทุกคนอยู่ใน subtree) → เป็นส่วนหนึ่งของสาย ยุบไปพร้อมกัน
 * คู่ครองที่มีพ่อแม่ในผัง (ญาติแต่งกันเอง) หรือมีคู่/ลูกนอกสาย ไม่นับ — แค่ตัด reference ทิ้งตอนเก็บกวาด
 */
function marriedInOf(ctx: Ctx, subtree: FamilyNode[]): FamilyNode[] {
  const S = ctx.state;
  const ids = new Set(subtree.map((n) => n.id));
  const inside = (id: FamilyNodeId) => ids.has(id) || !S.familyNodes[id];
  const out = new Map<FamilyNodeId, FamilyNode>();
  for (const n of subtree) {
    for (const sid of n.spouseIds) {
      const sp = S.familyNodes[sid];
      if (!sp || ids.has(sid) || out.has(sid) || !isMarriedIn(ctx, sp)) continue;
      if (sp.spouseIds.every(inside) && sp.childIds.every(inside)) out.set(sid, sp);
    }
  }
  return [...out.values()];
}

/**
 * ตัด childIds/spouseIds ที่ชี้ไป node ที่ถูกลบแล้ว (เช่น ลูกที่ยุบไปกับสายของอีกฝ่าย)
 * แล้วลบ node ที่เหลือโดดเดี่ยว (ไม่มีพ่อแม่ คู่ครอง หรือลูกเหลือในผัง) ซึ่ง drop ได้ — เช่นคู่ครองคนนอกค้างจากเซฟเก่า
 */
function dropDanglingKin(ctx: Ctx, droppable: (n: FamilyNode) => boolean, report: PruneReport): void {
  const S = ctx.state;
  const exists = (id: FamilyNodeId) => !!S.familyNodes[id];
  for (const n of Object.values(S.familyNodes)) {
    if (!n.childIds.every(exists)) n.childIds = n.childIds.filter(exists);
    if (!n.spouseIds.every(exists)) n.spouseIds = n.spouseIds.filter(exists);
  }
  for (const n of Object.values(S.familyNodes)) {
    if (!isMarriedIn(ctx, n) || n.spouseIds.length > 0 || n.childIds.length > 0 || !droppable(n)) continue;
    delete S.familyNodes[n.id];
    report.nodesMerged++;
  }
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
