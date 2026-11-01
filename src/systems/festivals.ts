import { yearsToDays } from '../core/calendar';
import { ageOf, isAlive, lunarOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId } from '../core/types';
import { setRelation, singlePeer, spawnLocal } from './acquaintance';
import type { ChoreEventRequest } from './chores';
import { requirementsMet, type PreparedEvent } from './events';
import { livingChildren, livingParents, livingSpouse } from './factory';

// ============================================================================
// Festivals — งานบุญและงานประจำปีของผู้เล่น (ทุกวัยตั้งแต่ minAge)
//
//  ตามปฏิทินจันทรคติ (core/calendar.ts): เพ็ญ = ขึ้น 15 ค่ำ, ดับ = วันสุดท้ายของเดือน (แรม 14/15 ค่ำ) — วันละไม่เกินหนึ่งงาน
//   ├─ เพ็ญเดือน 12: ลอยโคมเมื่อน้ำเริ่มลด                       (ritual.floating_lanterns_1680s)
//   ├─ เพ็ญเดือน 5: รดน้ำพ่อแม่                                (ritual.fifth_month_bathing_1680s)
//   ├─ วันพระ (เพ็ญ/ดับ): ไปวัดฟังเทศน์ ถือศีล หรือแอบไปหาปลา    (ritual.holy_days_1680s)
//   └─ หน้าแล้ง: งานวัดใกล้บ้าน ละคร มวย ปล่อยนกปล่อยปลา       (ritual.temple_festival_1680s)
//
//  วัยหนุ่มสาวที่ยังไม่มีคู่: งานวัดอาจมีคนต่างเพศให้แอบมอง (คนใหม่ได้) ลอยโคมชวนคนที่รู้จักอยู่แล้วไปด้วยได้
// ============================================================================

/** วันละครั้ง (ผู้เล่นเท่านั้น) — away ≥ 1 = ไปอยู่บ้านคนอื่น ไม่ได้รดน้ำพ่อแม่ที่เรือน */
export function tickFestivals(ctx: Ctx, away: number): ChoreEventRequest[] {
  const S = ctx.state;
  const F = ctx.content.balance.festivals;
  const ch = S.characters[S.meta.playerCharacterId];
  if (!isAlive(ch) || ageOf(ctx, ch) < F.minAge) return [];
  const l = lunarOf(ctx);
  const month = l.month;
  const full = l.waxing && l.phaseDay === 15;
  const req = (event: string, bindings: Record<string, CharacterId>, vars = {}) => [{ event, bindings: { actor: ch.id, ...bindings }, vars }];

  const withWho = companions(ctx, ch);
  if (full && month === F.lanternMonth && ctx.rng.chance(F.lanternChance)) {
    const peer = canCourt(ctx, ch) && !withWho.beloved ? singlePeer(ctx, ch, false) : undefined;
    return req('festival.lanterns', { ...withWho, ...(peer ? { stranger: peer.id } : {}) });
  }
  if (full && month === F.bathingMonth && away < 1 && ctx.rng.chance(F.bathingChance)) {
    const parents = livingParents(ctx, ch);
    const parent = parents.find((p) => p.householdId === ch.householdId) ?? parents[0];
    if (parent) return req('festival.bathing', { parent: parent.id });
  }
  // วันพระราวปีละ 25 วัน (เพ็ญและดับ 12–13 เดือน)
  if ((full || l.lastDay) && ctx.rng.chance(F.holyDaysPerYear / 25)) {
    const greet = templeElder(ctx, ch);
    if (greet) return greet;
    return req('festival.holy_day', withWho.child ? { child: withWho.child } : {}, { moon: full ? 'moon:full' : l.phaseDay === 14 ? 'moon:dark14' : 'moon:dark' });
  }
  const fairDays = (F.fairMonths[1] - F.fairMonths[0] + 1) * 29.5;
  if (month >= F.fairMonths[0] && month <= F.fairMonths[1] && ctx.rng.chance(F.templeFairsPerYear / fairDays)) {
    const peer = canCourt(ctx, ch) && !withWho.beloved ? singlePeer(ctx, ch, true) : undefined;
    return req('festival.temple_fair', { ...withWho, ...(peer ? { stranger: peer.id } : {}) });
  }
  return [];
}

/**
 * สายเรื่องวัด: เด็กที่ตามผู้ใหญ่ไปวัดมาหลายวันพระ วันหนึ่งคนเลี้ยงพาไปไหว้ผู้ใหญ่ที่ศาลา (ครั้งเดียว —
 * เงื่อนไขอยู่ใน trigger.requires ของ temple.elder) แล้วผู้ใหญ่คนนั้นเป็นคนรู้จัก ต่อไปอาจแวะมาถามข่าว (temple.elder_visit)
 * lore: ritual.temple_elder_greeting (ของแต่ง อิง vocab.pronouns_1680s)
 */
function templeElder(ctx: Ctx, ch: Character): ChoreEventRequest[] | null {
  const def = ctx.content.events['temple.elder'];
  const age = ageOf(ctx, ch);
  if (!def || (def.trigger.ageRange && (age < def.trigger.ageRange[0] || age > def.trigger.ageRange[1]))) return null;
  const caregiver = ch.caregiverIds.map((id) => ctx.state.characters[id]).find((c) => isAlive(c) && c.householdId === ch.householdId);
  if (!caregiver || !requirementsMet(ctx, def, ch, { actor: ch.id, caregiver: caregiver.id })) return null;
  if (!ctx.rng.chance(ctx.content.balance.festivals.elderGreetChance)) return null;
  const elder = spawnLocal(ctx, ch, {
    sex: ctx.rng.chance(0.5) ? 'm' : 'f', age: Math.round(ctx.rng.range(55, 75)), distance: 'near',
  });
  setRelation(ctx, ch.id, elder.id, 'acquaintance', 0.05);
  return [{ event: 'temple.elder', bindings: { actor: ch.id, caregiver: caregiver.id, elder: elder.id }, vars: {} }];
}

/**
 * คนที่ชวนไปงานด้วยได้: beloved = ผัว/เมีย คู่หมั้น คนที่หนีมาอยู่ด้วย หรือคนที่กำลังเกี้ยว
 * child = ลูกเล็ก (3–12 ปี) ที่อยู่เรือนเดียวกัน — คนเล็กสุดก่อน
 */
function companions(ctx: Ctx, ch: Character): { beloved?: CharacterId; child?: CharacterId } {
  const S = ctx.state;
  const court = Object.values(S.intents).find((i) => i.actorId === ch.id && ctx.content.intents[i.kind]?.target === 'court');
  const beloved = [livingSpouse(ctx, ch)?.id, ch.betrothal?.toId, ch.eloped?.withId, court?.targetId]
    .map((id) => (id ? S.characters[id] : undefined)).find(isAlive);
  const child = livingChildren(ctx, ch)
    .filter((k) => k.householdId && k.householdId === ch.householdId && ageOf(ctx, k) >= 3 && ageOf(ctx, k) <= 12)
    .sort((a, b) => b.birthDay - a.birthDay)[0];
  return { ...(beloved ? { beloved: beloved.id } : {}), ...(child ? { child: child.id } : {}) };
}

function canCourt(ctx: Ctx, ch: Character): boolean {
  const age = ageOf(ctx, ch);
  const [min, max] = ctx.content.balance.festivals.peerAge;
  return age >= min && age <= max && !livingSpouse(ctx, ch) && !ch.betrothal && !ch.eloped;
}

// ---------------------------------------------------------------------------
// นิสัย: งานบุญมาทุกปีทุกเดือน — คนจริงไม่ได้คิดใหม่ทุกครั้ง ทำอย่างที่เคยทำ
//  เลือกแบบเดิมติดกัน habitStreak ครั้ง → ครั้งต่อไปทำเองแล้วลงบันทึก "ตามเคย" ไปอีก habitYears ปี
//  ถามใหม่เมื่อครบปี, ข้ามช่วงวัย (เด็ก/หนุ่มสาว/ผู้ใหญ่/ชรา) หรือคนที่ตัวเลือกเกี่ยวข้องเปลี่ยน (รดน้ำแม่ → แม่ไม่อยู่แล้ว)
//  ตัวเลข habitStreak/habitYears เป็นค่าของเกม
// ---------------------------------------------------------------------------

const STAGES: Array<[number, string]> = [[13, 'child'], [20, 'youth'], [55, 'adult'], [Infinity, 'elder']];
const stageOf = (ctx: Ctx, ch: Character) => STAGES.find(([max]) => ageOf(ctx, ch) < max)![1];

/** คนที่ตัวเลือกนี้เกี่ยวข้อง (role อื่นนอกจาก actor ที่ effect อ้างถึง) — เปลี่ยนคนแล้วต้องถามใหม่ */
function involved(p: PreparedEvent, optionId: string): string {
  const opt = p.options.find((o) => o.id === optionId);
  const roles = new Set<string>();
  for (const e of opt?.effects ?? []) {
    for (const k of ['role', 'toward', 'with', 'teacher'] as const) {
      const r = (e as Record<string, unknown>)[k];
      if (typeof r === 'string' && r !== 'actor') roles.add(r);
    }
  }
  return [...roles].sort().map((r) => `${r}=${p.instance.bindings[r] ?? ''}`).join(',');
}

/** ตัวเลือกที่ทำตามนิสัย — ไม่มี = ต้องถามผู้เล่น */
export function habitOption(ctx: Ctx, ch: Character, p: PreparedEvent): string | undefined {
  const h = ch.habits?.[p.def.id];
  if (!h || h.until === undefined || ctx.state.meta.day >= h.until) return undefined;
  if (h.stage !== stageOf(ctx, ch) || h.with !== involved(p, h.optionId)) return undefined;
  return p.options.some((o) => o.id === h.optionId) && !p.locked.has(h.optionId) ? h.optionId : undefined;
}

/** จดสิ่งที่ผู้เล่นเลือกในงานบุญ (เรียกจาก chooseOption) */
export function recordHabit(ctx: Ctx, ch: Character, p: PreparedEvent, optionId: string): void {
  if (!p.def.id.startsWith('festival.')) return;
  const F = ctx.content.balance.festivals;
  const day = ctx.state.meta.day;
  const stage = stageOf(ctx, ch);
  const withWho = involved(p, optionId);
  const habits = (ch.habits ??= {});
  const h = habits[p.def.id];
  if (h && h.optionId === optionId && h.stage === stage && h.with === withWho) h.streak++;
  else habits[p.def.id] = { optionId, streak: 1, stage, with: withWho };
  const cur = habits[p.def.id]!;
  if (cur.streak >= F.habitStreak && (cur.until === undefined || day >= cur.until)) cur.until = day + yearsToDays(F.habitYears);
}
