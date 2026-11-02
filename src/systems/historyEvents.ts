import { ageOf, dayOfYear, isAlive, yearOf, type Ctx } from '../core/ctx';
import type { Character } from '../core/types';
import { spawnLocal } from './acquaintance';
import { prepareEvent, requirementsMet, type PreparedEvent } from './events';

// ============================================================================
// event ตามปฏิทินประวัติศาสตร์ — ต่างจาก applyHistoricalShocks (ผลต่อทุกคนในตระกูล) ตรงที่ส่ง event ให้ผู้เล่นตัดสินใจ
//  ตารางอยู่ใน rules.json "historyEvents": [{ year, day (นับจาก 1 ม.ค. = 0), event, minAge }]
//  ใช้กับศึกพม่า 2308–2310 (docs/design-war-2308.md) — role "refugee" สร้างคนรู้จักจากต่างเมืองขึ้นมาให้
//  ผู้เล่นตายแล้ว/อายุไม่ถึง minAge → ข้าม (ไม่เลื่อน event ไปให้ผู้สืบ)
// ============================================================================

export function historyEventsToday(ctx: Ctx): PreparedEvent[] {
  const S = ctx.state;
  const player = S.characters[S.meta.playerCharacterId];
  if (!isAlive(player)) return [];
  const year = yearOf(ctx, S.meta.day);
  const day = dayOfYear(ctx, S.meta.day);
  const out: PreparedEvent[] = [];
  for (const s of ctx.content.historyEvents) {
    if (s.year !== year || s.day !== day || ageOf(ctx, player) < (s.minAge ?? 0)) continue;
    const def = ctx.content.events[s.event];
    if (!def) continue;
    const bindings: Record<string, Character['id']> = { actor: player.id };
    const age = ageOf(ctx, player);
    if (def.trigger.ageRange && (age < def.trigger.ageRange[0] || age > def.trigger.ageRange[1])) continue;
    if (!requirementsMet(ctx, def, player, bindings)) continue;
    if ('refugee' in def.roles) {
      bindings.refugee = spawnLocal(ctx, player, {
        sex: ctx.rng.chance(0.5) ? 'm' : 'f', age: Math.round(ctx.rng.range(22, 50)), distance: 'far',
      }).id;
    }
    out.push(prepareEvent(ctx, s.event, bindings));
  }
  return out;
}
