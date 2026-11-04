import { ageOf, dayOfYear, must, newId, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type {
  AnatomyTemplate, BodyPart, BodyPartId, CapabilityId, Character, EventInstanceId, MemoryId,
  Modifier, PartDefId, PartSelector, Scar, TagId, Visibility, Wound, WoundKind,
} from '../core/types';

// ============================================================================
// Anatomical System
// ร่างกาย = tree ใน content + state แบบ sparse; ความสามารถคำนวณสด (derived) ไม่เก็บลงเซฟ
// ============================================================================

export const bodyPartKey = (c: Character['id'], p: PartDefId): BodyPartId => `${c}/${p}` as BodyPartId;

export const anatomyOf = (ctx: Ctx, ch: Character): AnatomyTemplate =>
  must(ctx.content.anatomies[ch.anatomyId], `anatomy ${ch.anatomyId}`);

export function getPart(ctx: Ctx, ch: Character, partDefId: PartDefId): BodyPart | undefined {
  return ctx.state.bodyParts[bodyPartKey(ch.id, partDefId)];
}

function ensurePart(ctx: Ctx, ch: Character, partDefId: PartDefId): BodyPart {
  const id = bodyPartKey(ch.id, partDefId);
  let p = ctx.state.bodyParts[id];
  if (!p) {
    p = { id, characterId: ch.id, partDefId, integrity: 1, status: 'intact', scars: [] };
    ctx.state.bodyParts[id] = p;
    ch.bodyPartIds.push(id);
  }
  return p;
}

/** integrity จริง = ของตัวเอง × ของทุก ancestor (มือขาด → นิ้วใช้ไม่ได้ทั้งหมด) */
export function effectiveIntegrity(ctx: Ctx, ch: Character, partDefId: PartDefId): number {
  const anatomy = anatomyOf(ctx, ch);
  let eff = 1;
  let cur: PartDefId | null = partDefId;
  while (cur) {
    const p = getPart(ctx, ch, cur);
    if (p) eff *= p.status === 'missing' ? 0 : p.integrity;
    cur = anatomy.parts[cur]?.parent ?? null;
  }
  return eff;
}

export function capability(ctx: Ctx, ch: Character, cap: CapabilityId): number {
  if (ch.bodyPartIds.length === 0) return 1; // fast path: ร่างกายปกติ
  let sum = 0;
  let total = 0;
  for (const def of Object.values(anatomyOf(ctx, ch).parts)) {
    const w = def.capabilities[cap];
    if (!w) continue;
    total += w;
    sum += w * effectiveIntegrity(ctx, ch, def.id);
  }
  return total ? sum / total : 1;
}

/** รวม modifier จากแผลเป็นทั้งหมด ที่ active ใน context นี้ */
export function scarModifiers(ctx: Ctx, ch: Character, context: Set<string>): Modifier[] {
  const out: Modifier[] = [];
  for (const pid of ch.bodyPartIds) {
    for (const scar of ctx.state.bodyParts[pid]?.scars ?? []) {
      for (const m of scar.modifiers) if (!m.when || m.when.every((t) => context.has(t))) out.push(m);
    }
  }
  return out;
}

/** อวัยวะนี้หรือ ancestor ตัวใดตัวหนึ่งขาดไปแล้ว (มือขาด → นิ้วบนมือนั้นไม่มีอยู่ให้บาดอีก) */
export function isSevered(ctx: Ctx, ch: Character, partDefId: PartDefId): boolean {
  const anatomy = anatomyOf(ctx, ch);
  let cur: PartDefId | null = partDefId;
  while (cur) {
    if (getPart(ctx, ch, cur)?.status === 'missing') return true;
    cur = anatomy.parts[cur]?.parent ?? null;
  }
  return false;
}

/** สุ่มอวัยวะตาม selector — "นิ้วของมือที่ไม่ถนัด" (มือที่จับผักขณะหั่น) */
export function selectPart(ctx: Ctx, ch: Character, sel: PartSelector): PartDefId | null {
  const anatomy = anatomyOf(ctx, ch);
  const off = ch.handedness === 'l' ? 'r' : 'l';
  const side = sel.side === 'dominant' ? ch.handedness : sel.side === 'nondominant' ? off : null;
  const candidates = Object.values(anatomy.parts).filter(
    (d) =>
      d.tags.some((t) => ctx.tags.isA(t, sel.tag)) &&
      (!side || d.side === side) &&
      !isSevered(ctx, ch, d.id),
  );
  return ctx.rng.weighted(candidates, (d) => d.hitWeight)?.id ?? null;
}

export function inflictWound(
  ctx: Ctx, ch: Character, partDefId: PartDefId, kind: WoundKind, severity: number,
  treatment: Wound['treatment'], sourceEventId: EventInstanceId | null,
): Wound {
  const day = ctx.state.meta.day;
  const w: Wound = {
    id: newId(ctx, 'wnd'),
    characterId: ch.id,
    partDefId,
    kind,
    severity: clamp01(severity),
    stage: 'bleeding',
    inflictedDay: day,
    stageSinceDay: day,
    treatment,
    complications: [],
    sourceEventId,
    memoryId: null,
  };
  ctx.state.wounds[w.id] = w;
  ch.woundIds.push(w.id);
  return w;
}

// ----------------------------------------------------------------------------
// Wound lifecycle:  bleeding → open → (infected → (festering)) → healing → [finalize]
// แต่ละ transition ทอยครั้งเดียว ไม่ทอยทุกวัน → ผลลัพธ์ไม่ขึ้นกับขนาด tick
// ----------------------------------------------------------------------------

const STAGE_DAYS = { bleeding: 1, open: 3, infected: 7, festering: 10 } as const;

export interface WoundOutcome {
  woundId: Wound['id'];
  partDefId: PartDefId;
  result: 'healed_clean' | 'scarred' | 'impaired' | 'lost_part' | 'fatal';
  scar: Scar | null;
  integrityAfter: number;
}

export function tickWounds(ctx: Ctx, ch: Character): WoundOutcome[] {
  const B = ctx.content.balance.wound;
  const day = ctx.state.meta.day;
  const doy = dayOfYear(ctx, day);
  const rainy = doy >= B.rainySeason[0] && doy <= B.rainySeason[1] ? 1.5 : 1; // หน้าฝนแผลติดเชื้อง่าย
  const outcomes: WoundOutcome[] = [];

  for (const wid of [...ch.woundIds]) {
    const w = ctx.state.wounds[wid];
    if (!w) continue;
    const q = w.treatment?.quality ?? 0;
    let guard = 0;
    // วนจนกว่าแผลจะหยุดเปลี่ยน stage ในวันนี้ (รองรับ tick ที่กระโดดหลายวัน)
    while (guard++ < 8) {
      const elapsed = day - w.stageSinceDay;
      const advance = (stage: Wound['stage'], after: number) => {
        w.stage = stage;
        w.stageSinceDay += after;
      };
      if (w.stage === 'bleeding' && elapsed >= STAGE_DAYS.bleeding) advance('open', STAGE_DAYS.bleeding);
      else if (w.stage === 'open' && elapsed >= STAGE_DAYS.open) {
        const pInf = clamp01(B.infection[w.kind] * (0.5 + w.severity) * (1 - 0.8 * q) * rainy);
        if (ctx.rng.chance(pInf)) {
          w.complications.push('infected');
          advance('infected', STAGE_DAYS.open);
        } else advance('healing', STAGE_DAYS.open);
      } else if (w.stage === 'infected' && elapsed >= STAGE_DAYS.infected) {
        if (ctx.rng.chance(clamp01(w.severity * (1 - q) * 0.6))) {
          w.complications.push('festered');
          advance('festering', STAGE_DAYS.infected);
        } else advance('healing', STAGE_DAYS.infected);
      } else if (w.stage === 'festering' && elapsed >= STAGE_DAYS.festering) {
        // เฉพาะผู้เล่น: แผลเน่าไม่ได้รักษาถึงตายได้ (ผู้เรียก tickWounds ตั้ง markDead เมื่อเห็น result 'fatal')
        if (ch.id === ctx.state.meta.playerCharacterId && ctx.rng.chance(clamp01(B.festerDeathChance * (0.5 + w.severity) * (1 - B.festerDeathTreatCut * q)))) {
          delete ctx.state.wounds[w.id];
          ch.woundIds = ch.woundIds.filter((id) => id !== w.id);
          outcomes.push({ woundId: w.id, partDefId: w.partDefId, result: 'fatal', scar: null, integrityAfter: 0 });
          break;
        }
        if (ch.id === ctx.state.meta.playerCharacterId) ch.closeCalls = (ch.closeCalls ?? 0) + 1; // แผลเน่าผ่านมาได้โดยไม่ตาย
        if (ctx.rng.chance(B.festerLossChance)) {
          outcomes.push(finalizeWound(ctx, ch, w, true));
          break;
        }
        advance('healing', STAGE_DAYS.festering);
      } else if (w.stage === 'healing' && elapsed >= B.healDaysBase + B.healDaysPerSeverity * w.severity) {
        outcomes.push(finalizeWound(ctx, ch, w, false));
        break;
      } else break;
    }
  }
  return outcomes;
}

/** แผลปิด → ทิ้งร่องรอยถาวร แล้วลบ Wound entity ทิ้ง (เซฟไม่บวม) */
function finalizeWound(ctx: Ctx, ch: Character, w: Wound, lost: boolean): WoundOutcome {
  const B = ctx.content.balance.wound;
  const def = must(anatomyOf(ctx, ch).parts[w.partDefId], w.partDefId);
  const part = ensurePart(ctx, ch, w.partDefId);
  const age = ageOf(ctx, ch);
  let result: WoundOutcome['result'];
  let scar: Scar | null = null;

  if (lost) {
    part.status = 'missing';
    part.integrity = 0;
    scar = makeScar(ctx, 'stump', 1, def.visibility, def.tags, w.memoryId, age);
    result = 'lost_part';
  } else {
    const infected = w.complications.length > 0;
    // เส้นเอ็น/ข้อเสียหาย: แผลลึก หรือเคยติดเชื้อ → integrity ลดถาวร
    const loss = w.severity * w.severity * 0.6 + (infected ? 0.2 : 0);
    part.integrity = clamp01(part.integrity - loss);
    if (ctx.rng.chance(clamp01(B.scarChance[w.kind] * w.severity + (infected ? 0.3 : 0)))) {
      scar = makeScar(ctx, w.kind, w.severity, def.visibility, def.tags, w.memoryId, age);
    }
    if (part.integrity < 0.95) part.status = 'impaired';
    result = part.integrity < 0.95 ? 'impaired' : scar ? 'scarred' : 'healed_clean';
  }
  if (scar) part.scars.push(scar);

  // แผลหายสนิทโดยไม่ทิ้งอะไร → ลบ sparse record ทิ้ง
  if (part.status === 'intact' && part.scars.length === 0 && part.integrity >= 1) {
    delete ctx.state.bodyParts[part.id];
    ch.bodyPartIds = ch.bodyPartIds.filter((id) => id !== part.id);
  }
  delete ctx.state.wounds[w.id];
  ch.woundIds = ch.woundIds.filter((id) => id !== w.id);
  return { woundId: w.id, partDefId: w.partDefId, result, scar, integrityAfter: part.integrity };
}

/** แผลเป็นที่ไม่ได้มาจากบาดแผล เช่น รอยไข้ทรพิษ (ฝีดาษ) บนหน้า */
export function addScar(ctx: Ctx, ch: Character, partDefId: PartDefId, kind: Scar['kind'], severity: number): void {
  const def = must(anatomyOf(ctx, ch).parts[partDefId], partDefId);
  ensurePart(ctx, ch, partDefId).scars.push(makeScar(ctx, kind, severity, def.visibility, def.tags, null, ageOf(ctx, ch)));
}

function makeScar(
  ctx: Ctx, kind: Scar['kind'], severity: number, visibility: Visibility, partTags: TagId[], originMemoryId: MemoryId | null,
  age: number,
): Scar {
  const modifiers: Modifier[] = [];
  for (const rule of ctx.content.scarRules) {
    const m = rule.match;
    if (m.kind && !m.kind.includes(kind)) continue;
    if (m.visibility && !m.visibility.includes(visibility)) continue;
    if (m.minSeverity !== undefined && severity < m.minSeverity) continue;
    const partTag = m.partTag;
    if (partTag && !partTags.some((t) => ctx.tags.isA(t, partTag))) continue;
    // สเกล modifier ตามความรุนแรงของแผล
    for (const mod of rule.modifiers) modifiers.push({ ...mod, value: mod.op === 'add' ? mod.value * severity : mod.value });
  }
  return { kind, severity, acquiredDay: ctx.state.meta.day, ageAtTime: age, originMemoryId, modifiers };
}
