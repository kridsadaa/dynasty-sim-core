import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { CapabilityId } from '../core/types';
import { capability } from '../systems/body';
import type { PreparedEvent } from '../systems/events';
import { renderLegend } from '../systems/legend';
import { describeTrait } from '../systems/traits';
import type { CharacterView, DynastyView, EventView } from './protocol';

// แปลง state → view model (plain data) ก่อนส่งข้ามเธรด

export type TextTable = Record<string, string>;

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

const CAPS: CapabilityId[] = ['manipulation.fine', 'manipulation.gross', 'mobility', 'sight'];

/** ข้อความจากตาราง text.th — ไม่มีคีย์ให้คืนค่าดิบ (เห็นชัดว่าลืมใส่คำแปล) */
const t = (text: TextTable, prefix: string, id: string) => text[`${prefix}.${id}`] ?? id;

/** UI ไม่ควรเห็นคีย์ภายใน ("noble", "finger.index.l", "manipulation.fine") — แปลงเป็นคำไทยที่นี่ */
export function playerView(ctx: Ctx, text: TextTable = {}): CharacterView {
  const ch = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  const anatomy = ctx.content.anatomies[ch.anatomyId];
  const partLabel = (partDefId: string) => anatomy?.parts[partDefId]?.label.th ?? partDefId;
  const estateTag = `estate:${ch.social.estate}` as const;
  return {
    name: ch.name,
    age: ageOf(ctx, ch),
    year: yearOf(ctx, ctx.state.meta.day),
    estate: ctx.tags.def(estateTag) ? ctx.tags.label(estateTag) : ch.social.estate,
    title: ch.social.title,
    wealth: Math.round(ch.social.wealth),
    traits: ch.traitIds.map((id) => ctx.state.traits[id]).filter((t) => !!t && !t.latent).map((t) => describeTrait(ctx, t!)),
    scars: ch.bodyPartIds.flatMap((pid) => {
      const p = ctx.state.bodyParts[pid];
      if (!p) return [];
      const label = partLabel(p.partDefId);
      // แผลชนิดเดียวกันที่อวัยวะเดียวกันรวมเป็นบรรทัดเดียว "×N"
      const counts = new Map<string, number>();
      for (const s of p.scars) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
      const lines = [...counts].map(([kind, n]) => `แผลเป็น(${t(text, 'scar.kind', kind)})ที่${label}${n > 1 ? ` ×${n}` : ''}`);
      return p.status === 'missing' ? [...lines, `สูญเสีย${label}`] : lines;
    }),
    wounds: ch.woundIds.map((id) => ctx.state.wounds[id]).filter((w) => !!w).map((w) => `${partLabel(w!.partDefId)}: ${t(text, 'wound.stage', w!.stage)}`),
    // คีย์เป็นคำไทยเพราะ UI แสดงคีย์ตรงๆ
    capabilities: Object.fromEntries(CAPS.map((c) => [t(text, 'capability', c), Math.round(capability(ctx, ch, c) * 100) / 100])),
  };
}

export function dynastyView(ctx: Ctx): DynastyView {
  const dyn = must(ctx.state.dynasties[ctx.state.meta.playerDynastyId], 'dynasty');
  return {
    name: dyn.name,
    prestige: Math.round(dyn.prestige * 10) / 10,
    taboos: dyn.taboos.map((t) => `${t.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(t.target)} (${Math.round(t.strength * 100)}%)`),
    legends: dyn.legendIds.map((id) => ctx.state.legends[id]).filter((l) => !!l).map((l) => renderLegend(ctx, l!, 'current')),
    livingMembers: Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c)).length,
    familyNodes: Object.keys(ctx.state.familyNodes).length,
  };
}

export function eventView(ctx: Ctx, p: PreparedEvent, text: TextTable): EventView {
  const vars: Record<string, string> = { actor: p.actor.name };
  for (const [k, v] of Object.entries(p.instance.vars)) vars[k] = ctx.tags.label(v);
  return {
    instanceId: p.instance.id,
    title: text[`${p.def.textKey}.title`] ?? p.def.id,
    text: fill(text[p.def.textKey] ?? p.def.textKey, vars),
    options: p.options.map((o) => ({
      id: o.id,
      text: fill(text[o.textKey] ?? o.textKey, { ...vars, ...o.params }),
      locked: p.locked.has(o.id),
      injected: !!o.injectedBy,
    })),
    triggered: [...new Set(p.hits.map((h) => describeTrait(ctx, h.trait)))],
  };
}
