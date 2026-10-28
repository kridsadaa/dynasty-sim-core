import { must, newId, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, TagId, Trait, TraitId, TraitKindId, TraitOrigin } from '../core/types';

export interface TraitDraft {
  kind: TraitKindId;
  target: TagId | null;
  intensity: number;
  latent: boolean;
  awareness: Trait['awareness'];
  origin: TraitOrigin;
}

/**
 * เพิ่มปมใหม่ หรือเสริมปมเดิมที่ "เกี่ยวกัน" ใน ontology
 * - ปมเดิม phobia(tool:kitchen_knife) + ปมใหม่ phobia(property:bladed) → ปมเดิมขยายเป้าเป็น property:bladed
 * - intensity รวมแบบ diminishing: 1 - (1-a)(1-0.7b) → ไม่ทะลุ 1 และไม่โตเป็นเส้นตรง
 */
export function addOrReinforceTrait(ctx: Ctx, owner: Character, d: TraitDraft): { id: TraitId; reinforced: boolean } {
  for (const tid of owner.traitIds) {
    const t = ctx.state.traits[tid];
    if (!t || t.kind !== d.kind) continue;
    const related =
      t.target === d.target ||
      (t.target && d.target && (ctx.tags.isA(t.target, d.target) || ctx.tags.isA(d.target, t.target)));
    if (!related) continue;
    t.intensity = clamp01(1 - (1 - t.intensity) * (1 - 0.7 * d.intensity));
    if (t.target && d.target && t.target !== d.target && ctx.tags.isA(t.target, d.target)) t.target = d.target;
    if (!d.latent) t.latent = false;
    return { id: t.id, reinforced: true };
  }
  const t: Trait = {
    id: newId(ctx, 'trt'),
    ownerId: owner.id,
    kind: d.kind,
    target: d.target,
    intensity: clamp01(d.intensity),
    latent: d.latent,
    awareness: d.awareness,
    origin: d.origin,
    acquiredDay: ctx.state.meta.day,
    lastTriggeredDay: null,
    triggerCount: 0,
  };
  ctx.state.traits[t.id] = t;
  owner.traitIds.push(t.id);
  return { id: t.id, reinforced: false };
}

export function describeTrait(ctx: Ctx, t: Trait): string {
  const kind = must(ctx.content.traitKinds[t.kind], t.kind).label.th;
  return `${kind}${t.target ? ctx.tags.label(t.target) : ''} (${Math.round(t.intensity * 100)}%${t.latent ? ', แฝง' : ''})`;
}
