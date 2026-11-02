import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, isAlive, must, newId, yearOf, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, Dynasty, FamilyNode, FamilyTaboo, HistoricalEvent, Item, KinRelation, Parentage, Relation, TagId } from '../core/types';
import { livingSpouse, pickCaregiverChild } from './factory';
import { renderLegend, retellLegend, seedLegendsFromLife, type DriftOp } from './legend';
import { pruneState, type PruneReport } from './prune';
import { addOrReinforceTrait } from './traits';
import { applyCareer } from './career';
import { CAPTIVE_TAG, fallLeaverLines, unearthBuried, WAR_CASH_LOSS_MULT, warCaptureMult, warDeathMult, warWhere } from './war';

// ============================================================================
// Generational Handover — เรียกเมื่อตัวละครผู้เล่นตาย
//
//  [1] Snapshot   : แช่แข็งผู้ตายลง FamilyNode.summary (ข้อมูลขั้นต่ำที่ต้องอยู่ถาวร)
//  [2] Legends    : แผลเป็น/ความทรงจำเด่น → Legend ใหม่ (truth = ความจริง)
//  [3] Heir       : เลือกทายาท (ผู้เล่นเลือกได้จาก candidates)
//  [4] Funeral    : งานศพแปลงทรัพย์เป็นบารมี/บุญ                         ← anti-snowball
//  [5] Estate     : แบ่งมรดกตามสถานะแม่ (ไม่ใช่ winner-takes-all) + หนี้ตกทอด ← anti-snowball
//  [6] Social     : บรรดาศักดิ์ไม่สืบทอด, prestige เสื่อม, บุญคุณ/ความแค้นตกทอดแบบลดทอน
//  [7] Taboos     : กฎในเรือนที่อยู่นานพอ → ข้อห้ามตระกูล; ข้อห้ามเก่าเสื่อม/กลายพันธุ์ (รุ่นละครั้ง)/ถูกฝ่าฝืน
//  [8] Retell     : ตำนานทุกเรื่องของตระกูลถูกเล่าต่อ 1 รุ่น (บิดเบือนตาม personality ของทายาท)
//                   หัวหน้า NPC กับผู้เล่นอาจ handover ให้ทายาทรุ่นเดียวกัน → นับรุ่นด้วย Dynasty.agedGeneration
//  [9] Prune      : ยุบ NPC ที่ตายแล้ว/ไกลตัว
//
// สิ่งที่ "ไม่" ส่งต่อ: skill (ต้องเรียนใหม่ — ส่งต่อได้แค่ตำราที่เร่งการเรียน), บรรดาศักดิ์,
// ความทรงจำของผู้ตาย (เหลือแค่ตำนานที่บิดเบือน), ปมจิตใจโดยตรง (ส่งต่อเฉพาะผ่าน social learning ระหว่างมีชีวิต + taboo)
// ============================================================================

/** ชื่อความสัมพันธ์ที่ผู้เล่นเห็น (log มรดก, หน้าดูตัวละคร) */
export const RELATION_TH: Record<Relation['kind'], string> = {
  caregiver: 'ความผูกพันกับผู้เลี้ยงดู',
  spouse: 'ความผูกพันคู่ครอง',
  patron: 'สายมูลนาย',
  friend: 'มิตรภาพ',
  rival: 'ความเป็นคู่แข่ง',
  gratitude: 'บุญคุณ',
  grudge: 'ความแค้น',
  affection: 'ความรักใคร่',
  awe: 'ความเกรงขาม',
  acquaintance: 'ความคุ้นเคย',
};

/** สถานะแม่ที่กำหนดสิทธิ์รับมรดก (lore: ลักษณมรดก) — views ซ่อน principal_wife/unknown ในผังเพราะเป็นค่าปกติ */
export const PARENTAGE_TH: Record<Parentage, string> = {
  principal_wife: 'บุตรภรรยาหลวง',
  minor_wife: 'บุตรภรรยาน้อย',
  slave_wife: 'บุตรภรรยาทาส',
  adopted: 'บุตรบุญธรรม',
  unknown: 'ไม่ทราบสถานะแม่',
};

export interface HandoverReport {
  deceased: string;
  heir: string;
  candidates: Array<{ name: string; score: number }>;
  log: string[];
  prune: PruneReport;
}

/** ตัวละครแรกของผู้เล่นไม่ตายด้วยโรค/ชรา/โรคระบาดจนพ้นวัยเด็ก (Character.deathGraceUntil) */
export const isGraced = (ctx: Ctx, ch: Character) => ch.deathGraceUntil !== undefined && ctx.state.meta.day < ch.deathGraceUntil;

export function markDead(ctx: Ctx, ch: Character, cause: TagId): void {
  ch.deathDay = ctx.state.meta.day;
  ch.deathCause = cause;
  snapshotToNode(ctx, ch);
  // ความตั้งใจของคนตายจบลงทันที — ถ้าตระกูลสิ้นสายจะไม่มีรอบรายเดือนมาเก็บกวาดให้
  for (const i of Object.values(ctx.state.intents)) if (i.actorId === ch.id) delete ctx.state.intents[i.id];
}

export function snapshotToNode(ctx: Ctx, ch: Character): void {
  const node = must(ctx.state.familyNodes[ch.familyNodeId], ch.familyNodeId);
  node.deathYear = ch.deathDay === null ? null : yearOf(ctx, ch.deathDay);
  node.summary = {
    estate: ch.social.estate,
    title: ch.social.title,
    notableTraits: ch.traitIds
      .map((id) => ctx.state.traits[id])
      .filter((t) => !!t && t.intensity >= 0.4)
      .map((t) => ({ kind: t!.kind, target: t!.target })),
    scars: ch.bodyPartIds.flatMap((pid) => {
      const p = ctx.state.bodyParts[pid];
      return p ? p.scars.map((s) => ({ partDefId: p.partDefId, kind: s.kind })) : [];
    }),
    causeOfDeath: ch.deathCause,
    merit: ch.merit,
  };
}

function livingKids(ctx: Ctx, node: FamilyNode | undefined): Character[] {
  return (node?.childIds ?? [])
    .map((id) => ctx.state.familyNodes[id]?.characterId)
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .filter(isAlive);
}

/** node ของลูกทุกคน รวมคนที่ตายแล้ว — ใช้หาหลานที่พ่อแม่ตายไปก่อน */
function childNodes(ctx: Ctx, node: FamilyNode | undefined): FamilyNode[] {
  return (node?.childIds ?? []).map((id) => ctx.state.familyNodes[id]).filter((n): n is FamilyNode => !!n);
}

/**
 * ญาติที่ยังมีชีวิตในตระกูลเดียวกัน เรียงจากใกล้ไปไกล: ลูก, หลาน (ลูกของลูก), พี่น้อง (ร่วมพ่อหรือแม่), หลาน (ลูกของพี่น้อง)
 * — สายของตัวเองก่อนสายพี่น้อง
 */
function kinTiers(ctx: Ctx, ch: Character): Character[][] {
  const nodes = ctx.state.familyNodes;
  const node = nodes[ch.familyNodeId];
  const sibNodes = [...new Set([node?.fatherId, node?.motherId].flatMap((p) => (p ? childNodes(ctx, nodes[p]) : [])))]
    .filter((n) => n.id !== ch.familyNodeId);
  const sameLine = (c: Character) => !!c.dynastyId && c.dynastyId === ch.dynastyId;
  return [
    livingKids(ctx, node),
    childNodes(ctx, node).flatMap((n) => livingKids(ctx, n)),
    sibNodes.map((n) => (n.characterId ? ctx.state.characters[n.characterId] : undefined)).filter(isAlive),
    sibNodes.flatMap((n) => livingKids(ctx, n)),
  ].map((tier) => [...new Set(tier)].filter(sameLine));
}

/** พี่น้องร่วมพ่อหรือร่วมแม่ที่ยังมีชีวิตและอยู่ตระกูลเดียวกัน */
export function livingSiblings(ctx: Ctx, ch: Character): Character[] {
  return kinTiers(ctx, ch)[2]!;
}

/** ผู้รับมรดก: น้ำหนักสิทธิ์ + ป้ายที่บอกผู้เล่นว่าทำไมได้เท่านี้ (null = ไม่ต้องอธิบาย) */
export interface EstateHeir {
  ch: Character;
  weight: number;
  label: string | null;
  relation: KinRelation | 'child';
}

const KIN_TH: Record<KinRelation, string> = {
  grandchild: 'หลาน',
  greatGrandchild: 'เหลน',
  fullSibling: 'พี่น้องร่วมบิดามารดา',
  paternalHalfSibling: 'พี่น้องร่วมบิดา',
  maternalHalfSibling: 'พี่น้องร่วมมารดา',
  nibling: 'หลาน ลูกของพี่น้อง',
  grandNibling: 'เหลน หลานของพี่น้อง',
  grandparent: 'ปู่ย่าตายาย',
  uncleAunt: 'ลุงป้าน้าอา',
  cousin: 'ลูกพี่ลูกน้อง',
};

/**
 * ญาติร่วมสายเลือดที่ยังมีชีวิต เมื่อผู้ตายไม่มีบุตรเหลือ — น้ำหนักตามลักษณมรดก มาตรา ๑๖–๑๗ (lore: social.inheritance_kin_shares)
 * ทุกคนแบ่งตามน้ำหนักร่วมกัน (ตัวบทให้ลูกหลาน พี่น้อง และญาติอยู่ในภาคเดียวกัน); คนที่นับได้หลายทางใช้ทางที่ได้มากที่สุด
 * ญาตินอกตระกูล (ฝ่ายแม่ ฝ่ายคู่ครองคนนอก) ได้ด้วย — สิทธิ์มาจากสายเลือด ไม่ใช่จากชื่อตระกูล
 * ยังไม่ใช้เงื่อนไข "ต้องรักษาไข้ปลงศพ" (lore/system-implications.md D4)
 */
export function kinHeirs(ctx: Ctx, dead: Character): EstateHeir[] {
  const S = ctx.state;
  const K = ctx.content.balance.inheritance.kinShares;
  const self = S.familyNodes[dead.familyNodeId];
  if (!self) return [];
  const node = (id: FamilyNode['id'] | null) => (id ? S.familyNodes[id] : undefined);
  const childrenOf = (n: FamilyNode) => n.childIds.map(node).filter((x): x is FamilyNode => !!x);
  const best = new Map<FamilyNode['id'], KinRelation>();
  const add = (n: FamilyNode, rel: KinRelation) => {
    const prev = best.get(n.id);
    if (n.id !== self.id && (!prev || K[rel] > K[prev])) best.set(n.id, rel);
  };

  for (const c of childrenOf(self)) {
    for (const gc of childrenOf(c)) {
      add(gc, 'grandchild');
      for (const ggc of childrenOf(gc)) add(ggc, 'greatGrandchild');
    }
  }
  const parents = [node(self.fatherId), node(self.motherId)].filter((x): x is FamilyNode => !!x);
  for (const sib of new Set(parents.flatMap(childrenOf))) {
    if (sib.id === self.id) continue;
    const sameFather = !!self.fatherId && sib.fatherId === self.fatherId;
    const sameMother = !!self.motherId && sib.motherId === self.motherId;
    add(sib, sameFather && sameMother ? 'fullSibling' : sameFather ? 'paternalHalfSibling' : 'maternalHalfSibling');
    for (const nb of childrenOf(sib)) {
      add(nb, 'nibling');
      for (const gnb of childrenOf(nb)) add(gnb, 'grandNibling');
    }
  }
  for (const p of parents) {
    for (const gp of [node(p.fatherId), node(p.motherId)].filter((x): x is FamilyNode => !!x)) {
      add(gp, 'grandparent');
      for (const u of childrenOf(gp)) {
        if (u.id === p.id) continue;
        add(u, 'uncleAunt');
        for (const cousin of childrenOf(u)) add(cousin, 'cousin');
      }
    }
  }

  const out: EstateHeir[] = [];
  for (const [id, rel] of best) {
    const cid = S.familyNodes[id]?.characterId;
    const ch = cid ? S.characters[cid] : undefined;
    if (isAlive(ch)) out.push({ ch, weight: K[rel], label: KIN_TH[rel], relation: rel });
  }
  return out.sort((a, b) => b.weight - a.weight || a.ch.birthDay - b.ch.birthDay);
}

/**
 * ผู้รับมรดก: บุตรที่ยังมีชีวิต (น้ำหนักตามสถานะแม่) ถ้าไม่มีจึงเป็นญาติตามลักษณมรดก (kinHeirs)
 * — บุตรของคู่ครองคนนอกได้มรดกของแม่/พ่อตัวเองแม้ไม่อยู่ตระกูลเดียวกัน
 */
export function estateHeirs(ctx: Ctx, dead: Character): EstateHeir[] {
  const B = ctx.content.balance.inheritance;
  // ไม่ได้รักษาไข้ → ไม่ได้ส่วน: ลูกในเกมอยู่แขวงเดียวกับพ่อแม่เสมอ และตัวบทให้กึ่งส่วนเฉพาะญาติต่างเมือง
  // (lore: social.nursing_cremation_condition — ลักษณมรดก ม.๒๖, ๒๙)
  const neglected = new Set(dead.neglectedBy ?? []);
  const kids = livingKids(ctx, ctx.state.familyNodes[dead.familyNodeId]).filter((ch) => !neglected.has(ch.id));
  if (!kids.length) return kinHeirs(ctx, dead);
  const parentageOf = (h: Character) => must(ctx.state.familyNodes[h.familyNodeId], 'node').parentage;
  // สิทธิ์ต่างกันเพราะสถานะแม่ → บอกสถานะ (ทุกคนสถานะเดียวกัน = แบ่งเท่ากัน ไม่ต้องอธิบาย)
  const mixed = new Set(kids.map(parentageOf)).size > 1;
  return kids.map((ch) => ({
    ch, weight: B.shareByParentage[parentageOf(ch)], label: mixed ? PARENTAGE_TH[parentageOf(ch)] : null, relation: 'child' as const,
  }));
}

/**
 * ผู้สืบต่อเป็นผู้นำตระกูล/ตัวละครผู้เล่น: ลูก หลาน พี่น้อง และลูกของพี่น้อง
 * ผู้ใหญ่มาก่อนเด็กเสมอ (มีผู้ใหญ่ก็ไม่ให้เด็กขึ้นเป็นรุ่นถัดไป); ในผู้ใหญ่หรือในเด็กด้วยกัน ญาติใกล้มาก่อน (ตาม kinTiers)
 * แล้วเรียงตามฐานะแม่ (ลักษณมรดก) และอายุ
 */
export function heirCandidates(ctx: Ctx, deceased: Character): Array<{ ch: Character; score: number }> {
  const B = ctx.content.balance.inheritance;
  const score = (ch: Character, tier: number) => {
    const n = must(ctx.state.familyNodes[ch.familyNodeId], 'heir node');
    const age = ageOf(ctx, ch);
    return (age >= 15 ? 100 : 0) + (3 - tier) * 10 + B.shareByParentage[n.parentage] + age * 0.01;
  };
  return kinTiers(ctx, deceased)
    .flatMap((tier, i) => tier.map((ch) => ({ ch, score: score(ch, i) })))
    .sort((a, b) => b.score - a.score);
}

/**
 * asPlayer=false: ใช้ตอนหัวหน้าตระกูลที่เป็น NPC ตาย (เช่น บิดาผู้เล่น) — แบ่งมรดก/ตกผลึกข้อห้ามเหมือนกัน
 * แต่ไม่สลับตัวละครผู้เล่น
 */
/** คำบรรยายการบิดเบือนใน log — ผู้เล่นไม่ควรเห็นชื่อ op ภายใน */
const DRIFT_LABEL: Record<DriftOp, string> = {
  glorify: 'เสริมให้ดูยิ่งใหญ่ขึ้น',
  magnify: 'เพิ่มจำนวนศัตรู',
  anchor: 'ผูกเข้ากับศึกสงคราม',
  supernatural: 'เติมเรื่องอภินิหาร',
  forget: 'ลืมรายละเอียดบางส่วน',
  conflate: 'ปนกับเรื่องของบรรพบุรุษที่มีชื่อเสียงกว่า',
};

export function performHandover(
  ctx: Ctx, deceasedId: Character['id'], chosenHeirId?: Character['id'], opts: { asPlayer?: boolean } = {},
): HandoverReport {
  const B = ctx.content.balance.inheritance;
  const dead = must(ctx.state.characters[deceasedId], deceasedId);
  if (dead.deathDay === null) markDead(ctx, dead, 'situation:old_age');
  const node = must(ctx.state.familyNodes[dead.familyNodeId], 'node');
  const dyn = must(dead.dynastyId ? ctx.state.dynasties[dead.dynastyId] : undefined, 'dynasty');
  const log: string[] = [];

  // [1] snapshot ทำแล้วใน markDead

  // [2] legends
  for (const lid of seedLegendsFromLife(ctx, dead, node, dyn)) log.push(`ตำนานใหม่: ${renderLegend(ctx, must(ctx.state.legends[lid], lid), 'current')}`);

  // [3] heir
  const candidates = heirCandidates(ctx, dead);
  const heir = chosenHeirId ? must(ctx.state.characters[chosenHeirId], 'heir') : must(candidates[0], 'no heir — game over / adopt').ch;
  const heirNode = must(ctx.state.familyNodes[heir.familyNodeId], 'heir node');

  // [4] funeral
  log.push(holdFuneral(ctx, dead));

  // [5] estate
  // ทรัพย์ไปตามกฎหมายแก่ลูก (ไม่มีลูกจึงญาติ) แม้ผู้สืบต่อเป็นพี่น้อง — ผู้สืบต่อได้ตำแหน่ง ไม่ใช่ทรัพย์ทั้งหมด
  const heirs = estateHeirs(ctx, dead);
  const estate = distributeEstate(ctx, dead, heirs, heirs.some((h) => h.ch.id === heir.id) ? heir : undefined);
  log.push(...estate.lines);

  // [6] social
  dyn.prestige *= 1 - B.prestigeDecay * (dyn.legacies?.kin && dyn.legacies.kin >= 4 ? 0.5 : 1);
  // ผู้เล่นตายขณะที่ผู้นำตระกูล (เช่น บิดา) ยังอยู่ → ตำแหน่งผู้นำไม่เปลี่ยนมือ
  const headNode = ctx.state.familyNodes[dyn.headNodeId];
  const headAlive = isAlive(headNode?.characterId ? ctx.state.characters[headNode.characterId] : undefined);
  if ((dyn.headNodeId === dead.familyNodeId || !headAlive) && dyn.headNodeId !== heirNode.id) {
    dyn.headNodeId = heirNode.id;
    (dyn.headHistory ??= []).push({ nodeId: heirNode.id, name: heir.name, fromYear: yearOf(ctx, ctx.state.meta.day) });
  }
  log.push(...carryRelations(ctx, dead, heir));
  if (dead.social.title) log.push(`บรรดาศักดิ์ "${dead.social.title}" ไม่ตกทอด — ${heir.name}ต้องถวายตัวรับราชการเอง`);

  // [7] taboos
  const newGeneration = heirNode.generation > (dyn.agedGeneration ?? -Infinity);
  log.push(...crystallizeTaboos(ctx, dead, heir, heirNode, dyn, newGeneration));

  // [8] retell
  if (newGeneration) dyn.agedGeneration = heirNode.generation;
  for (const lid of newGeneration ? dyn.legendIds : []) {
    const legend = ctx.state.legends[lid];
    if (!legend) continue;
    const ops = [...new Set(retellLegend(ctx, legend, heir))].map((op) => DRIFT_LABEL[op]);
    if ((heir.skills['literacy'] ?? 0) >= 30 && !legend.writtenRecord) {
      legend.writtenRecord = true; // จดลงสมุดข่อย → บิดเบือนช้าลงนับจากนี้
      ops.push('จดลงสมุดข่อย');
    }
    const about = ctx.state.familyNodes[legend.truth.subjectNodeId]?.name;
    if (ops.length) {
      log.push(`ตำนาน${about ? `เรื่อง${about}` : ''}ถูกเล่าต่อโดย ${heir.name}: ${ops.join(', ')} (คลาดจากความจริง ${Math.round(legend.divergence * 100)}%)`);
    }
  }

  // household: กฎส่วนตัวของผู้ตายหายไป เหลือเฉพาะที่ตกผลึกเป็นข้อห้ามตระกูลแล้ว (ปฏิบัติต่อในเรือนทายาท)
  leaveHousehold(ctx, dead, [estate.houseHeir, heir]);
  const heirHh = heir.householdId ? ctx.state.households[heir.householdId] : undefined;
  if (heirHh) {
    heirHh.rules = heirHh.rules.filter((r) => r.originTraitId || dyn.taboos.some((t) => t.target === r.target));
    for (const t of dyn.taboos) {
      if (heirHh.rules.some((r) => r.target === t.target)) continue;
      heirHh.rules.push({
        id: `rule_${heirHh.id}_${t.target}`, kind: t.kind, target: t.target, sinceDay: ctx.state.meta.day,
        imposedBy: heir.id, originTraitId: null, statedReason: 'inauspicious', // "บรรพบุรุษห้ามไว้"
      });
    }
  }

  if (opts.asPlayer !== false) ctx.state.meta.playerCharacterId = heir.id;
  const prune = pruneState(ctx);
  const drifted = driftLine(prune);
  if (drifted) log.push(drifted);
  return {
    deceased: dead.name,
    heir: heir.name,
    candidates: candidates.map((c) => ({ name: c.ch.name, score: c.score })),
    log,
    prune,
  };
}

/** บอกผู้เล่นว่าญาติห่างๆ แยกไปอยู่ที่อื่น (prune: driftKinDistance) — ไม่บอก ผู้เล่นจะเห็นญาติหายไปจากผังเฉยๆ */
export function driftLine(r: PruneReport): string | null {
  const n = r.driftedNames.length;
  if (!n) return null;
  const names = r.driftedNames.slice(0, 3).join(', ') + (n > 3 ? ` และอีก ${n - 3} คน` : '');
  return `ขาดการติดต่อกับญาติห่างๆ ${n} คน (${names}) — แยกไปตั้งบ้านเรือนที่อื่น`;
}

/**
 * ผู้ตายที่ไม่ใช่ผู้นำตระกูล (ลูกหลานสายรอง คู่ครองคนนอก) — งานศพ + แบ่งมรดกให้ลูก (ไม่มีลูก → ญาติ) + ออกจากเรือน
 * ไม่แตะตำแหน่งผู้นำ ตำนาน หรือข้อห้ามตระกูล; ต้องเรียกก่อน prune ไม่งั้นทรัพย์ค้างอยู่กับตัวละครที่ถูกลบ
 */
export function settleDeath(ctx: Ctx, dead: Character): { lines: string[]; heirIds: Array<Character['id']> } {
  const heirs = estateHeirs(ctx, dead);
  const lines = [holdFuneral(ctx, dead)];
  const estate = distributeEstate(ctx, dead, heirs, undefined);
  lines.push(...estate.lines);
  leaveHousehold(ctx, dead, [estate.houseHeir]);
  return { lines, heirIds: heirs.map((h) => h.ch.id) };
}

/**
 * งานศพแปลงทรัพย์เป็นบารมีตระกูล/บุญ ← anti-snowball
 * คิดจากทรัพย์ทั้งหมด ไม่ใช่เงินสดอย่างเดียว; เงินสดไม่พอ → ขายทอง แล้วขายที่ดินแปลงเล็กก่อน
 * ปลงศพก่อนแบ่งมรดก (lore: ritual.funeral_cremation, social.cremation_before_division) — เรือนและของตกทอดไม่ขาย
 */
function holdFuneral(ctx: Ctx, dead: Character): string {
  const B = ctx.content.balance.inheritance;
  const owned = Object.values(ctx.state.items).filter((i) => i.ownerCharacterId === dead.id);
  const estateValue = dead.social.wealth + owned.reduce((a, i) => a + i.value, 0);
  const wanted = Math.max(0, estateValue * B.funeralCostRate[dead.social.estate]);
  const saleOrder = owned
    .filter((i) => i.kind === 'gold' || i.kind === 'land')
    .sort((a, b) => Number(a.kind === 'land') - Number(b.kind === 'land') || a.value - b.value);
  const sold = { gold: 0, land: 0 };
  for (const it of saleOrder) {
    if (dead.social.wealth >= wanted) break;
    dead.social.wealth += it.value;
    delete ctx.state.items[it.id];
    sold[it.kind as 'gold' | 'land']++;
  }
  const soldText = [sold.gold ? `ทอง ${sold.gold} ชิ้น` : '', sold.land ? `ที่ดิน ${sold.land} แปลง` : ''].filter(Boolean).join(' และ');
  const funeral = Math.max(0, Math.min(wanted, dead.social.wealth));
  dead.social.wealth -= funeral;
  const dyn = dead.dynastyId ? ctx.state.dynasties[dead.dynastyId] : undefined;
  if (dyn) dyn.prestige += funeral * B.funeralPrestigePerTamlueng;
  dead.merit += funeral * 0.01;
  const node = ctx.state.familyNodes[dead.familyNodeId];
  if (node?.summary) node.summary.merit = dead.merit; // snapshot ทำไปแล้วตอน markDead — บุญจากงานศพต้องตามไปด้วย
  return `งานศพ${dead.name} ใช้ ${funeral.toFixed(0)} ตำลึง` +
    (soldText ? ` (ขาย${soldText} เพื่อจัดงาน)` : '') +
    ` → บารมีตระกูล +${(dyn ? funeral * B.funeralPrestigePerTamlueng : 0).toFixed(1)}`;
}

/**
 * เอาผู้ตายออกจากเรือน: กฎที่ผู้ตายตั้งไว้หายไปด้วย (กฎของสมาชิกคนอื่นยังอยู่)
 * ถ้าผู้ตายเป็นหัวเรือน → หัวเรือนคนต่อไป: คู่ครองที่ยังอยู่ → preferred (ลูกที่ได้เรือน, ทายาทหลัก) → คนแก่สุดในเรือน
 */
function leaveHousehold(ctx: Ctx, dead: Character, preferred: Array<Character | undefined>): void {
  const hh = dead.householdId ? ctx.state.households[dead.householdId] : undefined;
  if (!hh) return;
  hh.memberIds = hh.memberIds.filter((id) => id !== dead.id);
  hh.rules = hh.rules.filter((r) => r.imposedBy !== dead.id);
  if (hh.headId !== dead.id) return;
  const inHouse = (c: Character | undefined): c is Character => !!c && hh.memberIds.includes(c.id);
  const nextHead = [livingSpouse(ctx, dead), ...preferred].find(inHouse)
    ?? hh.memberIds.map((id) => ctx.state.characters[id]).filter(isAlive).sort((a, b) => a.birthDay - b.birthDay)[0];
  if (nextHead) hh.headId = nextHead.id;
  else delete ctx.state.households[hh.id];
}

/**
 * แบ่งมรดกแบบ partible: น้ำหนักตามสถานะแม่ (บุตร) หรือตามความใกล้ชิด (ญาติ) + โบนัสทายาทหลัก
 * - เรือน → ลูกที่อยู่เรือนเดียวกันและดูแลพ่อแม่ (ลูกสาวคนสุดท้องก่อน) (lore: kinship.youngest_daughter_house)
 *   เป็นของลูกที่ดูแล ไม่นับในส่วนแบ่ง — ทรัพย์อื่นแบ่งตามสิทธิ์
 *   ถ้าไม่มีลูกอยู่ในเรือน (หรือผู้รับเป็นญาติ) → ทายาทหลัก และนับมูลค่าเรือนรวมในส่วนแบ่งของคนที่ได้
 * - ที่ดิน/ทอง → greedy ให้คนที่ยังได้น้อยกว่าสิทธิ์มากที่สุด
 * - เงินสดและหนี้ แบ่งตามสัดส่วนเดียวกัน (ลูกอาจตกเป็นหนี้จนต้องขายตัวเป็นทาส)
 * - ของประจำตระกูล (ownerDynastyId) ไม่ถูกแบ่ง — ผู้นำตระกูลถือครองแทน
 * - ไม่มีทั้งบุตรและญาติ → ของหลวง (lore: social.estate_without_heirs)
 */
function distributeEstate(
  ctx: Ctx, dead: Character, estateHeirs: EstateHeir[], main: Character | undefined,
): { lines: string[]; houseHeir: Character | undefined } {
  const B = ctx.content.balance.inheritance;
  if (!estateHeirs.length) {
    for (const it of Object.values(ctx.state.items)) if (it.ownerCharacterId === dead.id) delete ctx.state.items[it.id];
    dead.social.wealth = 0;
    dead.social.debt = 0;
    return { lines: ['ไม่มีบุตรและญาติ — ทรัพย์ตกเป็นของหลวง'], houseHeir: undefined };
  }
  const heirs = estateHeirs.map((h) => h.ch);
  const byKin = estateHeirs[0]!.relation !== 'child';
  const weight = new Map(estateHeirs.map((h) => [h.ch.id, h.weight + (h.ch.id === main?.id ? B.mainHeirBonus : 0)] as const));
  const labelOf = new Map(estateHeirs.map((h) => [h.ch.id, h.label] as const));
  const totalW = [...weight.values()].reduce((a, b) => a + b, 0);
  const share = (h: Character) => (weight.get(h.id) ?? 0) / totalW;

  const items = Object.values(ctx.state.items).filter((i) => i.ownerCharacterId === dead.id);
  const caregiver = byKin ? undefined : pickCaregiverChild(heirs.filter((h) => dead.householdId && h.householdId === dead.householdId));
  const houseHeir = caregiver ?? main ?? heirs[0]!;
  const houses = items.filter((i) => i.kind === 'house');
  const counted = (i: Item) => i.kind !== 'house' || !caregiver;
  const totalValue = items.filter(counted).reduce((a, i) => a + i.value, 0) + dead.social.wealth;
  const received = new Map<Character['id'], number>(heirs.map((h) => [h.id, 0]));
  const give = (item: Item, to: Character) => {
    item.ownerCharacterId = to.id;
    if (counted(item)) received.set(to.id, (received.get(to.id) ?? 0) + item.value);
  };
  for (const it of houses) give(it, houseHeir);
  for (const it of items.filter((i) => i.kind !== 'house').sort((a, b) => b.value - a.value)) {
    const best = heirs.reduce((a, b) =>
      share(b) * totalValue - (received.get(b.id) ?? 0) > share(a) * totalValue - (received.get(a.id) ?? 0) ? b : a,
    );
    give(it, best);
  }
  // เงินสดชดเชยคนที่ได้ของชิ้นใหญ่ต่ำกว่าสิทธิ์ก่อน (เรือน/ที่ดินแบ่งครึ่งไม่ได้) — เงินติดลบแบ่งตามสิทธิ์ตรงๆ
  const cash = dead.social.wealth;
  const gap = (h: Character) => Math.max(0, share(h) * totalValue - (received.get(h.id) ?? 0));
  const totalGap = heirs.reduce((a, h) => a + gap(h), 0);
  const cashFor = new Map(heirs.map((h) => [h.id, cash > 0 && totalGap > 0 ? cash * gap(h) / totalGap : cash * share(h)]));
  for (const h of heirs) {
    h.social.wealth += cashFor.get(h.id) ?? 0;
    h.social.debt += dead.social.debt * share(h);
  }
  const lines = heirs.map((h) => {
    const got = (received.get(h.id) ?? 0) + (cashFor.get(h.id) ?? 0);
    const actual = totalValue > 0 ? ` = ${Math.round((got / totalValue) * 100)}%` : '';
    const label = labelOf.get(h.id);
    return `${h.name}${label ? ` (${label})` : ''} ได้ ${got.toFixed(0)} ตำลึง (สิทธิ์ ${Math.round(share(h) * 100)}%${actual})` +
      (dead.social.debt ? `, รับหนี้ ${(dead.social.debt * share(h)).toFixed(0)}` : '');
  });
  if (houses.length) {
    lines.unshift(caregiver
      ? `เรือนตกแก่${houseHeir.name} ลูกที่อยู่ดูแลพ่อแม่ — ไม่นับรวมในส่วนแบ่ง`
      : `เรือนตกแก่${houseHeir.name} (${byKin ? 'ไม่มีบุตร' : 'ไม่มีลูกอยู่ในเรือน'} — นับรวมในส่วนแบ่ง)`);
  }
  if (byKin) lines.unshift('ไม่มีบุตร — มรดกตกแก่ญาติตามลักษณมรดก');
  dead.social.wealth = 0;
  dead.social.debt = 0;
  return { lines, houseHeir };
}

/** ความแค้นตกทอดแรงกว่าบุญคุณ — asymmetry นี้ทำให้ศัตรูเก่าตามหลอกหลอนรุ่นลูก */
function carryRelations(ctx: Ctx, dead: Character, heir: Character): string[] {
  const carry = ctx.content.balance.inheritance.relationCarry;
  const out: string[] = [];
  for (const r of Object.values(ctx.state.relations)) {
    if (r.from !== dead.id && r.to !== dead.id) continue;
    const factor = carry[r.kind];
    const other = r.from === dead.id ? r.to : r.from;
    if (!factor || other === heir.id || !isAlive(ctx.state.characters[other])) continue;
    const inherited: Relation = {
      id: `${r.from === dead.id ? heir.id : other}|${r.to === dead.id ? heir.id : other}|${r.kind}`,
      from: r.from === dead.id ? heir.id : other,
      to: r.to === dead.id ? heir.id : other,
      kind: r.kind,
      strength: r.strength * factor,
      sinceDay: ctx.state.meta.day,
    };
    // ทายาทมีความสัมพันธ์แบบเดียวกันกับคนนี้อยู่แล้วและแรงกว่า → ไม่เขียนทับ
    if ((ctx.state.relations[inherited.id]?.strength ?? -Infinity) >= inherited.strength) continue;
    ctx.state.relations[inherited.id] = inherited;
    out.push(`${heir.name}รับ${RELATION_TH[r.kind]}กับ${ctx.state.characters[other]?.name ?? '?'} ต่อจากผู้ตาย (${Math.round(inherited.strength * 100)}%)`);
  }
  return out;
}

function crystallizeTaboos(
  ctx: Ctx, dead: Character, heir: Character, heirNode: FamilyNode, dyn: Dynasty, newGeneration: boolean,
): string[] {
  const B = ctx.content.balance.inheritance;
  const out: string[] = [];
  const created = new Set<string>();

  // (a) เสื่อม / ลืมต้นเหตุ / กลายพันธุ์ (รุ่นละครั้ง) / ถูกฝ่าฝืน (ทายาทแต่ละคน) — ข้อห้ามเก่า
  for (const t of [...dyn.taboos]) {
    if (newGeneration) t.strength *= B.tabooDecay;
    if (heirNode.generation - t.sinceGeneration >= 2) t.originKnown = false;
    if (newGeneration && ctx.rng.chance(B.tabooMutateChance)) {
      const ups = ctx.tags.parents(t.target).filter((p) => !ctx.tags.def(p)?.generalizeStop);
      const up = ctx.rng.pick(ups);
      if (up && ctx.rng.chance(0.5)) {
        out.push(`ข้อห้ามกลายพันธุ์: ${ctx.tags.label(t.target)} → ${ctx.tags.label(up)}`);
        // กลายไปซ้ำกับข้อห้ามที่มีอยู่แล้ว → รวมเป็นข้อเดียว เก็บความแรงที่มากกว่า
        const dup = dyn.taboos.find((x) => x !== t && x.target === up && x.kind === t.kind);
        if (dup) {
          dup.strength = Math.max(dup.strength, t.strength);
          dyn.taboos = dyn.taboos.filter((x) => x !== t);
          continue;
        }
        t.target = up;
      } else if (t.kind === 'ban') {
        t.kind = 'ritual';
        out.push(`ข้อห้าม${ctx.tags.label(t.target)} กลายเป็นพิธีกรรมประจำตระกูล`);
      }
    }
    const P = heir.personality;
    const rebel = P.boldness * P.imagination * (1 - t.strength) * (t.originKnown ? 0.5 : 1);
    if (ctx.rng.chance(rebel) || t.strength < B.tabooForgetBelow) {
      dyn.taboos = dyn.taboos.filter((x) => x !== t);
      out.push(t.strength < B.tabooForgetBelow
        ? `ข้อห้าม${ctx.tags.label(t.target)} ถูกลืมไปตามกาลเวลา`
        // "ผิดผี" เป็นคำของอีสาน — ตระกูลภาคกลางนับถือผีปู่ย่าตายาย (lore: belief.phit_phi_regional)
        : `${heir.name}ฝ่าฝืนข้อห้าม${ctx.tags.label(t.target)} (ล่วงเกินผีปู่ย่าตายาย)`);
    }
  }

  // (b) กฎในเรือนของผู้ตายที่อยู่นานพอ → ข้อห้ามตระกูล
  const hh = dead.householdId ? ctx.state.households[dead.householdId] : undefined;
  for (const rule of hh?.rules ?? []) {
    const years = (ctx.state.meta.day - rule.sinceDay) / DAYS_PER_YEAR;
    if (years < B.tabooMinYears) continue;
    const existing = dyn.taboos.find((t) => t.target === rule.target || ctx.tags.isA(rule.target, t.target));
    if (existing) {
      // กฎที่มาจากปมจริงของคนเป็น เสริมแรงมาก; กฎที่ทำตามประเพณีอย่างเดียว เสริมแรงน้อย → ค่อยๆ จางหาย
      existing.strength = clamp01(existing.strength + (rule.originTraitId ? 0.15 : 0.03));
      continue;
    }
    const imposer = ctx.state.characters[rule.imposedBy];
    // id เดิมอาจยังถูกข้อห้ามที่กลายพันธุ์ไปแล้วใช้อยู่ (trait origin อ้าง tabooId)
    const baseId = `taboo_${dyn.id}_${rule.target}`;
    const taboo: FamilyTaboo = {
      id: dyn.taboos.some((x) => x.id === baseId) ? newId(ctx, baseId) : baseId,
      kind: rule.kind,
      target: rule.target,
      strength: clamp01(0.5 + 0.04 * Math.min(years, 12)),
      originNodeId: imposer?.familyNodeId ?? heirNode.id,
      originKnown: rule.statedReason === 'true_cause',
      sinceGeneration: heirNode.generation,
    };
    dyn.taboos.push(taboo);
    created.add(taboo.id);
    out.push(`ข้อห้ามตระกูลใหม่: ${taboo.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(taboo.target)} (แรง ${Math.round(taboo.strength * 100)}%, ${taboo.originKnown ? 'ยังรู้ต้นเหตุ' : 'ไม่มีใครรู้ต้นเหตุจริง'})`);
  }

  // (c) ข้อห้ามฝังเข้าตัวทายาทเป็น superstition (ถ้ายังไม่มีปมนี้)
  for (const t of dyn.taboos) {
    addOrReinforceTrait(ctx, heir, {
      kind: 'superstition',
      target: t.target,
      intensity: t.strength * 0.5,
      latent: false,
      awareness: t.originKnown ? 'knows_cause' : 'unknown',
      origin: { type: 'taboo', dynastyId: dyn.id, tabooId: t.id },
    });
  }
  return out;
}

// ============================================================================
// Anti-snowball: เหตุการณ์ประวัติศาสตร์ "ล้างไพ่" — เรียกเมื่อเวลาในเกมผ่านปีนั้น
// ============================================================================

export const historyHeadline = (ctx: Ctx, ev: HistoricalEvent) => `== ${ctx.tags.label(ev.tag)} (${ev.year}) ==`;

export function applyHistoricalShocks(ctx: Ctx, year: number): string[] {
  const out: string[] = [];
  for (const ev of ctx.content.history.filter((h) => h.year === year)) {
    out.push(historyHeadline(ctx, ev));
    for (const dyn of Object.values(ctx.state.dynasties)) {
      const members = Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c));
      const purged = !!dyn.faction && (ev.shock.purgeFactions ?? []).includes(dyn.faction) && ctx.rng.chance(ev.shock.purgeChance ?? 1);
      for (const m of members) {
        const loss = ctx.rng.range(ev.shock.wealthLoss[0], ev.shock.wealthLoss[1]);
        // กรุงแตก: คนที่หนีออกไปพกเงินสดไปด้วย ถูกริบน้อยกว่าคนในกรุง (war.ts)
        const cashLoss = ev.tag === 'history:fall_of_ayutthaya' ? loss * WAR_CASH_LOSS_MULT[warWhere(ctx, m.id)] : loss;
        m.social.wealth *= 1 - (purged ? Math.max(loss, 0.8) : cashLoss);
        m.stress = Math.min(1, m.stress + ctx.content.balance.life.historyStress[ev.kind] * (0.5 + m.personality.neuroticism));
        if (purged && m.social.title) {
          out.push(`${m.name}ถูกริบราชบาตร ถอดจาก${m.social.title}`);
          m.social.title = null;
        }
        if (m.office && (purged || ev.shock.endsOffices)) {
          if (!purged) {
            out.push(`${m.name}หมดตำแหน่ง${m.social.title ? ` ${m.social.title}` : ''} — ราชสำนักไม่มีอยู่อีกแล้ว`);
            m.formerOffice = { postId: m.office.postId, ...(m.office.deptId ? { deptId: m.office.deptId } : {}), ...(m.office.name ? { name: m.office.name } : {}), title: m.social.title };
          }
          applyCareer(ctx, m, 'dismiss');
        }
      }
      // ฝักฝ่ายที่ถูกกวาดล้างแล้ว หมดความหมายในแผ่นดินใหม่
      if (purged) dyn.faction = null;
      // ทรัพย์ที่ไม่ได้ซ่อน (เรือน ที่ดินในกรุง ตำรา) เสียหาย — ทองที่ฝังดินรอด
      for (const it of Object.values(ctx.state.items)) {
        const owner = it.ownerCharacterId ? ctx.state.characters[it.ownerCharacterId] : undefined;
        if (it.hidden || (owner?.dynastyId !== dyn.id && it.ownerDynastyId !== dyn.id)) continue;
        const loss = ctx.rng.range(ev.shock.wealthLoss[0], ev.shock.wealthLoss[1]);
        it.value *= 1 - loss;
        it.condition = clamp01(it.condition - loss);
      }
      if (purged) dyn.prestige *= 0.5;
    }
    // คนตาย: คนในตระกูล หรือทุกคนในฉากเมื่อเป็นโรคระบาด/ข้าวยาก (lore: event.cholera_*, event.famine_2310_2313)
    // ศึกหลังเสียกรุงเสี่ยงเฉพาะคนวัยถูกเกณฑ์ (ages) — ตัวเลขของเกม พงศาวดารไม่มียอดตายฝ่ายไทย
    const how = ev.kind === 'plague' ? 'ด้วย' : 'ใน';
    for (const c of Object.values(ctx.state.characters)) {
      if (!isAlive(c) || isGraced(ctx, c) || (!ev.shock.everyone && !c.dynastyId)) continue;
      if (ev.shock.ages && (ageOf(ctx, c) < ev.shock.ages[0] || ageOf(ctx, c) > ev.shock.ages[1])) continue;
      const whereMult = ev.tag === 'history:fall_of_ayutthaya' ? warDeathMult(ctx, c.id) : 1;
      if (!ctx.rng.chance((ev.shock.deathRiskBySex?.[c.sex] ?? ev.shock.deathRisk) * whereMult)) continue;
      markDead(ctx, c, ev.tag);
      out.push(`${c.name}เสียชีวิต${how}${ctx.tags.label(ev.tag)}`);
    }
    // กรุงแตก: ผู้รอดตายอาจถูกกวาดต้อนไปพม่า — หายจากเกม (ไม่มีข้อมูลรายคน ตัวเลขของเกม)
    if (ev.shock.captureRisk) {
      for (const c of Object.values(ctx.state.characters)) {
        if (!isAlive(c) || isGraced(ctx, c) || !c.dynastyId) continue;
        if (ev.shock.ages && (ageOf(ctx, c) < ev.shock.ages[0] || ageOf(ctx, c) > ev.shock.ages[1])) continue;
        if (!ctx.rng.chance(ev.shock.captureRisk * warCaptureMult(ctx, c.id))) continue;
        markDead(ctx, c, CAPTIVE_TAG);
        out.push(`${c.name}ถูกกวาดต้อนไปพม่า — ไม่มีใครรู้ว่าจะได้กลับมาหรือไม่`);
      }
    }
    // กรุงแตกแล้ว — ไหทองที่ผู้เล่นฝังไว้ตอนเตรียมรับศึกขุดคืนเป็นเงินสด (ที่ซ่อนรอดจากการปล้นข้างบน)
    if (ev.tag === 'history:fall_of_ayutthaya') out.push(...fallLeaverLines(ctx), ...unearthBuried(ctx));
  }
  return out;
}
