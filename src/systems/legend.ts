import { must, newId, yearOf, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type {
  Character, Claim, ClaimSlot, Dynasty, FamilyNode, Legend, LegendId, Memory, PartDefId, PerceptRole, Scar, TagId,
} from '../core/types';

// ============================================================================
// Unreliable Family History
//
// Legend เก็บ 2 ชุด: truth (แช่แข็งตอนตาย) กับ current (ถูกเล่าต่อทุกรุ่น)
// ทั้งคู่เป็น slot-based Claim → การบิดเบือนเป็น "การแทน tag ใน ontology" ไม่ใช่การสุ่มข้อความ
//   glorify      : tag → narrativeUpgrades ที่ prestige สูงกว่า (มีดทำครัว → ดาบ, ครัว → สนามรบ)
//                  แล้วเติม slot ที่ "ต้องมี" ตาม narrativeImplies (ดาบ → ต้องมีคู่ต่อสู้)
//   magnify      : ขยายจำนวน (ข้าศึก 1 → 7 คน)
//   anchor       : ผูกกับเหตุการณ์ประวัติศาสตร์ที่เกิดช่วงชีวิตจริง (ศึกเสียกรุง 2310)
//   supernatural : เติมของขลัง/นิมิต (คนเล่าศรัทธาสูง)
//   forget       : รายละเอียดที่ไม่น่าภูมิใจหายไป (ฟักทองหายจากเรื่อง)
//   conflate     : ย้ายเครดิตไปให้บรรพบุรุษที่ดังกว่า
// physicalEvidence (แผลเป็นจริงที่นิ้ว) ไม่เปลี่ยน → เกมใช้ divergence สร้างอีเวนต์ "ความลับแตก"
// ============================================================================

const ROLE_TO_SLOT: Partial<Record<PerceptRole, ClaimSlot>> = {
  instrument: 'instrument',
  target: 'target',
  place: 'place',
  agent: 'adversary',
};

/**
 * ตอนตาย: แผลเป็นที่มองเห็นได้ + ความทรงจำต้นเหตุ → Legend
 * เหตุการณ์เดียวที่ทิ้งแผลหลายแห่งเป็นเรื่องเล่าเรื่องเดียว — รวมตาม originMemoryId ใช้แผลที่หนักที่สุดเป็นหลักฐาน
 */
export function seedLegendsFromLife(ctx: Ctx, ch: Character, node: FamilyNode, dynasty: Dynasty): LegendId[] {
  const anatomy = must(ctx.content.anatomies[ch.anatomyId], ch.anatomyId);
  const stories = new Map<string, { partDefId: PartDefId; scar: Scar }>();
  for (const pid of ch.bodyPartIds) {
    const part = ctx.state.bodyParts[pid];
    const def = part && anatomy.parts[part.partDefId];
    if (!part || !def || def.visibility === 'internal' || def.visibility === 'covered') continue;
    for (const scar of part.scars) {
      if (scar.severity < 0.3) continue;
      const key = scar.originMemoryId ?? `${part.partDefId}|${scar.kind}|${scar.acquiredDay}`;
      const prev = stories.get(key);
      if (!prev || scar.severity > prev.scar.severity) stories.set(key, { partDefId: part.partDefId, scar });
    }
  }
  const out: LegendId[] = [];
  for (const { partDefId, scar } of stories.values()) {
    const mem: Memory | undefined = scar.originMemoryId ? ctx.state.memories[scar.originMemoryId] : undefined;
    const slots: Claim['slots'] = {};
    for (const p of mem?.percepts ?? []) {
      const slot = ROLE_TO_SLOT[p.role];
      if (slot && !slots[slot]) slots[slot] = p.tag;
    }
    const truth: Claim = {
      template: 'acquired_scar',
      subjectNodeId: node.id,
      slots,
      magnitude: 1,
      heroism: 0,
      supernatural: [],
      year: yearOf(ctx, scar.acquiredDay),
    };
    const legend: Legend = {
      id: newId(ctx, 'lgd'),
      dynastyId: dynasty.id,
      truth,
      current: structuredClone(truth),
      generationsRetold: 0,
      divergence: 0,
      writtenRecord: false,
      physicalEvidence: { partDefId, kind: scar.kind },
    };
    ctx.state.legends[legend.id] = legend;
    dynasty.legendIds.push(legend.id);
    node.legendIds.push(legend.id);
    out.push(legend.id);
  }
  return out;
}

/**
 * ความลับตำนานแตก: ตำนานที่คลาดจากความจริงมาก และยังมีคนที่ทันเห็นเรื่องจริง (อายุ ≥ 10 ปีตอนเกิดเรื่อง) ยังมีชีวิต
 * → ปีละ chance ผู้ใหญ่คนนั้นเล่าเรื่องจริงให้ผู้เล่นฟัง (กลไกของเกม — ยังไม่มี lore)
 */
export function legendTruthEvent(ctx: Ctx): { legend: Legend; witness: Character } | null {
  const S = ctx.state;
  const B = ctx.content.balance.legend;
  const player = S.characters[S.meta.playerCharacterId];
  if (!player || player.deathDay !== null || !ctx.rng.chance(B.truthChance)) return null;
  const dyn = S.dynasties[S.meta.playerDynastyId];
  if (!dyn) return null;
  for (const id of dyn.legendIds) {
    const legend = S.legends[id];
    if (!legend || legend.truthToldYear !== undefined || legend.divergence < B.truthMinDivergence) continue;
    // คนที่ทันเห็น: ญาติ คู่ครองที่แต่งเข้ามา หรือผู้ใหญ่ข้างบ้าน — ใครก็ได้ที่ยังมีชีวิตและอายุ ≥ 10 ปีตอนเกิดเรื่อง
    const witness = Object.values(S.characters)
      .filter((c) => c.deathDay === null && c.id !== player.id
        && (S.familyNodes[c.familyNodeId]?.birthYear ?? Infinity) <= legend.truth.year - 10)
      .sort((a, b) => a.birthDay - b.birthDay)[0];
    if (witness) return { legend, witness };
  }
  return null;
}

export type DriftOp = 'glorify' | 'magnify' | 'anchor' | 'supernatural' | 'forget' | 'conflate';

/** เล่าต่อ 1 รุ่น — teller คือคนที่ถ่ายทอดเรื่องให้รุ่นถัดไป (ปกติคือทายาท) */
export function retellLegend(ctx: Ctx, legend: Legend, teller: Character | null): DriftOp[] {
  const B = ctx.content.balance.legend;
  const pride = teller?.personality.pride ?? 0.5;
  const piety = teller?.personality.piety ?? 0.5;
  const c = legend.current;
  const subject = must(ctx.state.familyNodes[c.subjectNodeId], 'legend subject');

  const pressure = B.baseDrift * (legend.writtenRecord ? B.writtenRecordDamp : 1) * (0.5 + pride);
  const nOps = Math.min(B.maxOpsPerGeneration, Math.floor(pressure * B.maxOpsPerGeneration + ctx.rng.next()));
  const applied: DriftOp[] = [];

  for (let i = 0; i < nOps; i++) {
    const upgradable = (Object.entries(c.slots) as Array<[ClaimSlot, TagId]>).filter(
      ([, t]) => (ctx.tags.def(t)?.narrativeUpgrades?.length ?? 0) > 0,
    );
    const war = c.slots.era_event ? undefined : findWar(ctx, subject);
    const fame = moreFamousAncestor(ctx, subject);
    const weights: Record<DriftOp, number> = {
      glorify: upgradable.length ? 1 + pride : 0,
      magnify: c.slots.adversary ? 0.6 * pride + 0.2 : 0,
      anchor: war ? 0.9 : 0,
      supernatural: c.supernatural.length < 2 ? 0.5 * piety : 0,
      forget: Object.keys(c.slots).length > 2 ? 0.35 : 0,
      conflate: fame ? 0.15 : 0,
    };
    const op = ctx.rng.weighted(Object.keys(weights) as DriftOp[], (k) => weights[k]);
    if (!op) break;

    switch (op) {
      case 'glorify': {
        const [slot, tag] = must(ctx.rng.pick(upgradable), 'slot');
        const ups = must(ctx.tags.def(tag)?.narrativeUpgrades, 'upgrades');
        const next = must(ctx.rng.weighted(ups, (t) => 1 + ctx.tags.prestige(t)), 'upgrade');
        c.slots[slot] = next;
        for (const [s, t] of Object.entries(ctx.tags.def(next)?.narrativeImplies ?? {}) as Array<[ClaimSlot, TagId]>) {
          if (!c.slots[s]) c.slots[s] = t;
        }
        c.heroism = Math.min(1, c.heroism + 0.25);
        break;
      }
      case 'magnify':
        c.magnitude = Math.max(2, Math.round(c.magnitude * ctx.rng.range(1.5, 3)));
        break;
      case 'anchor':
        if (war) c.slots.era_event = war;
        break;
      case 'supernatural': {
        const pool: TagId[] = ['supernatural:guardian_spirit', 'supernatural:omen'];
        const s = ctx.rng.pick(pool.filter((t) => !c.supernatural.includes(t)));
        if (s) c.supernatural.push(s);
        break;
      }
      case 'forget': {
        // ลืมรายละเอียดที่ "น่าอาย" ที่สุดก่อน
        const forgettable = (Object.entries(c.slots) as Array<[ClaimSlot, TagId]>).filter(([s]) => s !== 'era_event');
        forgettable.sort((a, b) => ctx.tags.prestige(a[1]) - ctx.tags.prestige(b[1]));
        const first = forgettable[0];
        if (first) delete c.slots[first[0]];
        break;
      }
      case 'conflate':
        if (fame) c.subjectNodeId = fame.id;
        break;
    }
    applied.push(op);
  }
  legend.generationsRetold++;
  legend.divergence = divergence(legend.truth, c);
  return applied;
}

function findWar(ctx: Ctx, subject: FamilyNode): TagId | undefined {
  const end = subject.deathYear ?? subject.birthYear + 60;
  return ctx.content.history.find((h) => h.kind === 'war' && h.year >= subject.birthYear + 12 && h.year <= end)?.tag;
}

/** บรรพบุรุษสายตรงที่มีบรรดาศักดิ์ — เป้าของการ "โอนวีรกรรม" */
function moreFamousAncestor(ctx: Ctx, subject: FamilyNode): FamilyNode | undefined {
  let cur = subject.fatherId ? ctx.state.familyNodes[subject.fatherId] : undefined;
  while (cur) {
    if (cur.summary?.title && !subject.summary?.title) return cur;
    cur = cur.fatherId ? ctx.state.familyNodes[cur.fatherId] : undefined;
  }
  return undefined;
}

export function divergence(truth: Claim, cur: Claim): number {
  const keys = new Set([...Object.keys(truth.slots), ...Object.keys(cur.slots)]) as Set<ClaimSlot>;
  let diff = 0;
  for (const k of keys) if (truth.slots[k] !== cur.slots[k]) diff++;
  const score =
    diff + 0.5 * Math.abs(Math.log2(cur.magnitude)) + 0.5 * cur.supernatural.length +
    (truth.subjectNodeId !== cur.subjectNodeId ? 1.5 : 0);
  return clamp01(score / (keys.size + 2));
}

export function renderLegend(ctx: Ctx, legend: Legend, which: 'truth' | 'current'): string {
  const claim = legend[which];
  const tpl = must(ctx.content.claimTemplates[claim.template], claim.template);
  const subject = ctx.state.familyNodes[claim.subjectNodeId]?.name ?? '(ไม่ทราบนาม)';
  const anatomy = Object.values(ctx.content.anatomies)[0];
  const part = legend.physicalEvidence ? anatomy?.parts[legend.physicalEvidence.partDefId]?.label.th ?? '' : '';
  let text = tpl.base.replace('{subject}', subject).replace('{part}', part);
  const said = new Set<TagId>();
  for (const key of tpl.order) {
    const frag = tpl.fragments[key];
    if (!frag) continue;
    if (key === 'supernatural') {
      if (claim.supernatural.length) text += ' ' + frag.replace('{v}', claim.supernatural.map((t) => ctx.tags.label(t)).join('และ'));
      continue;
    }
    const tag = claim.slots[key];
    if (!tag || said.has(tag)) continue;
    said.add(tag);
    let piece = frag.replace('{v}', ctx.tags.label(tag));
    const mag = tpl.fragments.magnitude;
    piece = piece.replace('{magnitude}', claim.magnitude > 1 && mag ? mag.replace('{n}', String(claim.magnitude)) : '');
    text += ' ' + piece;
  }
  return text;
}
