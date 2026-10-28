import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, GameEventDef } from '../core/types';
import { tickWounds } from './body';
import { prepareEvent, type PreparedEvent } from './events';
import {
  createHousehold, joinHousehold, livingChildren, livingSpouse, marry, pickCaregiverChild, pickName, relativeNames,
  spawnCharacter,
} from './factory';
import { applyHistoricalShocks, heirCandidates, markDead, performHandover } from './handover';
import { householdYearTick } from './socialLearning';

// ============================================================================
// World tick — 1 call = 1 วัน. Pure function ของ (state, content, rng) → deterministic
// ไม่รู้จัก DOM / Worker / IndexedDB เลย → รันได้ทั้งใน Worker, Node (test/demo) และ server ถ้าจำเป็น
// ============================================================================

export type WorldSignal =
  | { type: 'log'; line: string }
  | { type: 'event'; prepared: PreparedEvent }
  | { type: 'playerDied' };

export function advanceDay(ctx: Ctx): WorldSignal[] {
  const S = ctx.state;
  const B = ctx.content.balance;
  const out: WorldSignal[] = [];
  const player = S.characters[S.meta.playerCharacterId];

  S.meta.day++;
  const year = B.epochYear + Math.floor(S.meta.day / B.daysPerYear);

  // รายวัน: แผล
  const wounded = new Set(Object.values(S.wounds).map((w) => w.characterId));
  for (const cid of wounded) {
    const ch = S.characters[cid];
    if (!ch) continue;
    for (const o of tickWounds(ctx, ch)) {
      if (ch.id === player?.id) out.push({ type: 'log', line: `แผลของ${ch.name}: ${o.result}${o.scar ? ' (กลายเป็นแผลเป็น)' : ''}` });
    }
  }

  // รายปี (วันแรกของปี)
  if (S.meta.day % B.daysPerYear === 0) {
    for (const line of applyHistoricalShocks(ctx, year)) out.push({ type: 'log', line });
    for (const hh of Object.values(S.households)) {
      const logs = householdYearTick(ctx, hh.id);
      if (player && hh.memberIds.includes(player.id)) for (const line of logs) out.push({ type: 'log', line });
    }
    for (const line of lifeMilestones(ctx)) out.push({ type: 'log', line });
    for (const ch of Object.values(S.characters)) {
      if (!isAlive(ch)) continue;
      const over = ageOf(ctx, ch) - B.world.oldAgeStart;
      if (over > 0 && ctx.rng.chance(over * B.world.oldAgeYearlyRisk)) {
        markDead(ctx, ch, 'situation:old_age');
        if (ch.id !== player?.id) out.push({ type: 'log', line: `${ch.name} ถึงแก่กรรม` });
      }
    }
    // หัวหน้าตระกูลที่เป็น NPC ตาย (แก่ / ศึกสงคราม) → แบ่งมรดกทันที ผู้เล่นได้ส่วนถ้าเป็นทายาท
    for (const ch of Object.values(S.characters)) {
      if (!S.characters[ch.id] || ch.deathDay !== S.meta.day || ch.id === player?.id || !ch.dynastyId) continue;
      if (S.dynasties[ch.dynastyId]?.headNodeId !== ch.familyNodeId) continue;
      const cands = heirCandidates(ctx, ch);
      if (!cands.length) continue;
      const heirId = cands.some((c) => c.ch.id === player?.id) ? player!.id : undefined;
      const r = performHandover(ctx, ch.id, heirId, { asPlayer: false });
      out.push({ type: 'log', line: `มรดกของ${r.deceased} ตกถึง${r.heir} ผู้นำตระกูลคนใหม่` });
      for (const line of r.log) out.push({ type: 'log', line });
    }
  }

  // เหตุการณ์ของผู้เล่น
  if (isAlive(player) && ctx.rng.chance(B.world.eventsPerYear / B.daysPerYear)) {
    const prepared = pickEvent(ctx, player);
    if (prepared) out.push({ type: 'event', prepared });
  }
  if (player && !isAlive(player)) out.push({ type: 'playerDied' });
  return out;
}

/** สุ่ม event ที่ trigger ผ่าน + ผูก role ได้ครบ + พ้น cooldown */
function pickEvent(ctx: Ctx, actor: Character): PreparedEvent | null {
  const age = ageOf(ctx, actor);
  const day = ctx.state.meta.day;
  const bound: Array<{ def: GameEventDef; bindings: Record<string, Character['id']> }> = [];
  for (const def of Object.values(ctx.content.events)) {
    const t = def.trigger;
    if (t.ageRange && (age < t.ageRange[0] || age > t.ageRange[1])) continue;
    if (t.estates && !t.estates.includes(actor.social.estate)) continue;
    if (t.cooldownDays) {
      const recent = Object.values(ctx.state.eventLog).some(
        (e) => e.defId === def.id && e.bindings.actor === actor.id && day - e.day < t.cooldownDays!,
      );
      if (recent) continue;
    }
    const bindings: Record<string, Character['id']> = { actor: actor.id };
    let ok = true;
    for (const [role, f] of Object.entries(def.roles)) {
      if (role === 'actor') continue;
      const who = resolveRole(ctx, actor, f.relationToActor);
      if (!who) {
        ok = false;
        break;
      }
      bindings[role] = who.id;
    }
    if (ok) bound.push({ def, bindings });
  }
  const pick = ctx.rng.weighted(bound, (b) => b.def.trigger.weight);
  return pick ? prepareEvent(ctx, pick.def.id, pick.bindings) : null;
}

function resolveRole(ctx: Ctx, actor: Character, rel: string | undefined): Character | undefined {
  if (rel === 'caregiver') return actor.caregiverIds.map((id) => ctx.state.characters[id]).find(isAlive);
  if (rel === 'parent') {
    const node = ctx.state.familyNodes[actor.familyNodeId];
    return [node?.fatherId, node?.motherId]
      .map((n) => (n ? ctx.state.familyNodes[n]?.characterId : null))
      .map((id) => (id ? ctx.state.characters[id] : undefined))
      .find(isAlive);
  }
  return undefined;
}

/**
 * Placeholder จนกว่าจะมี event สู่ขอ/แต่งงาน/คลอดใน content — รันปีละครั้ง
 *
 * ที่อยู่หลังแต่งงาน (lore: kinship.uxorilocal_then_neolocal_1680s, kinship.marriage_law_three_seals,
 * kinship.residence_mixed_census, kinship.youngest_daughter_house):
 *  - ลูกสาวในตระกูลแต่งงาน → เขยคนนอกย้ายมาอยู่เรือนพ่อแม่ฝ่ายหญิง
 *  - ลูกชายในตระกูลแต่งงาน → ส่วนใหญ่ไปอยู่กับครอบครัวภรรยา (นอกฉาก = ตั้งเรือนใหม่), บางส่วนพาภรรยามาอยู่บ้านพ่อแม่
 *  - ครบ stayYears คู่ที่อยู่บ้านพ่อแม่แยกเรือนออกไป ยกเว้นลูกที่อยู่ดูแลพ่อแม่ (ลูกสาวคนสุดท้อง)
 */
export function lifeMilestones(ctx: Ctx): string[] {
  const W = ctx.content.balance.world;
  const dpy = ctx.content.balance.daysPerYear;
  const day = ctx.state.meta.day;
  const year = ctx.content.balance.epochYear + Math.floor(day / dpy);
  const out: string[] = [];
  for (const ch of Object.values(ctx.state.characters)) {
    // คนในตระกูลเท่านั้น — คู่ครองคนนอกตามคู่ของตัวเอง
    if (!isAlive(ch) || !ch.dynastyId) continue;
    const age = ageOf(ctx, ch);
    const spouse = livingSpouse(ctx, ch);

    // เป็นเณรเรียนหนังสือที่วัด (lore: ritual.novice_schooling_1680s) → อ่านออกเขียนได้ จดตำนานลงสมุดข่อยได้ตอนสืบทอด
    if (ch.sex === 'm' && age === W.noviceAge && ctx.rng.chance(W.noviceChance)) {
      ch.skills['literacy'] = Math.max(ch.skills['literacy'] ?? 0, 40);
      out.push(`${ch.name} ไปเป็นเณรเรียนหนังสือที่วัด`);
    }

    const marriageAge = ch.sex === 'm' ? W.marriageAge : W.marriageAgeFemale;
    const neverMarried = (ctx.state.familyNodes[ch.familyNodeId]?.spouseIds.length ?? 0) === 0;
    if (age === marriageAge && neverMarried) out.push(marryOut(ctx, ch, year));

    // แยกเรือนเมื่อครบกำหนด — ลูกที่อยู่ดูแลพ่อแม่ไม่ย้าย
    if (ch.moveOutDay !== undefined && day >= ch.moveOutDay) {
      ch.moveOutDay = undefined;
      const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
      const head = hh ? ctx.state.characters[hh.headId] : undefined;
      if (hh && head && livingChildren(ctx, head).some((c) => c.id === ch.id)) {
        const siblingsAtHome = livingChildren(ctx, head).filter((c) => c.householdId === hh.id);
        if (pickCaregiverChild(siblingsAtHome)?.id === ch.id) {
          out.push(`${ch.name} อยู่ดูแล${head.name}ต่อที่เรือนเดิม`);
        } else {
          const home = createHousehold(ctx, ch);
          for (const m of [spouse, ...livingChildren(ctx, ch)]) if (m && m.householdId === hh.id) joinHousehold(ctx, m, home);
          out.push(`${ch.name} แยกเรือนออกจากบ้าน${head.name}`);
        }
      }
    }

    // มีบุตรตามปีหลังแต่งงาน — นับจากฝั่งคนในตระกูลเพื่อไม่ให้นับซ้ำ
    if (spouse && ch.marriedDay !== undefined && W.childAfterMarriageYears.includes(Math.floor((day - ch.marriedDay) / dpy))) {
      const mother = ch.sex === 'f' ? ch : spouse;
      const father = ch.sex === 'm' ? ch : spouse;
      const sex = ctx.rng.chance(0.5) ? 'm' : 'f';
      const kid = spawnCharacter(ctx, {
        name: pickName(ctx, sex, ch.social.estate, relativeNames(ctx, ch, spouse)),
        sex, birthYear: year, estate: ch.social.estate, father, mother,
      });
      out.push(`${ch.name} มีบุตร: ${kid.name}`);
    }
  }
  return out;
}

function marryOut(ctx: Ctx, ch: Character, year: number): string {
  const W = ctx.content.balance.world;
  const day = ctx.state.meta.day;
  const spouseSex = ch.sex === 'm' ? 'f' : 'm';
  const spouseAge = spouseSex === 'm' ? W.marriageAge : W.marriageAgeFemale;
  const spouse = spawnCharacter(ctx, {
    name: pickName(ctx, spouseSex, ch.social.estate, new Set([ch.name])),
    sex: spouseSex, birthYear: year - spouseAge, estate: ch.social.estate, dynastyId: null, householdId: null,
  });
  marry(ctx, ch, spouse);
  ch.marriedDay = day;
  const stay = Math.round(ctx.rng.range(W.stayYears[0], W.stayYears[1])) * ctx.content.balance.daysPerYear;

  const parentsHome = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  if (ch.sex === 'f') {
    // เขยเข้าเรือนพ่อแม่ฝ่ายหญิง (ลักษณผัวเมีย ม.61 รองรับชายที่ไปอยู่บ้านฝ่ายหญิง)
    joinHousehold(ctx, spouse, parentsHome ?? createHousehold(ctx, ch));
    ch.moveOutDay = day + stay;
    return `${ch.name} แต่งงานกับ${spouse.name} เขยเข้ามาอยู่เรือนพ่อแม่ฝ่ายหญิง`;
  }
  if (parentsHome && ctx.rng.chance(W.patrilocalChance)) {
    joinHousehold(ctx, spouse, parentsHome);
    ch.moveOutDay = day + stay;
    return `${ch.name} แต่งงานกับ${spouse.name} พาภรรยามาอยู่เรือนพ่อแม่`;
  }
  // ไปอยู่กับครอบครัวภรรยา — ครอบครัวฝ่ายหญิงไม่ได้จำลอง จึงนับเป็นเรือนใหม่ของคู่นี้
  const home = createHousehold(ctx, ch);
  joinHousehold(ctx, spouse, home);
  return `${ch.name} แต่งงานกับ${spouse.name} ไปอยู่กับครอบครัวภรรยา`;
}
