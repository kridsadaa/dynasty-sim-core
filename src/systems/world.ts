import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, GameEventDef } from '../core/types';
import { tickWounds } from './body';
import { prepareEvent, type PreparedEvent } from './events';
import { createHousehold, marry, pickName, spawnCharacter } from './factory';
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
 * Placeholder จนกว่าจะมี event แต่งงาน/คลอดใน content:
 * ผู้ชายในตระกูลแต่งงานตาม marriageAge และมีบุตรตาม childAtAges
 */
function lifeMilestones(ctx: Ctx): string[] {
  const W = ctx.content.balance.world;
  const year = ctx.content.balance.epochYear + Math.floor(ctx.state.meta.day / ctx.content.balance.daysPerYear);
  const out: string[] = [];
  for (const man of Object.values(ctx.state.characters)) {
    if (!isAlive(man) || man.sex !== 'm' || !man.dynastyId) continue;
    const age = ageOf(ctx, man);
    const node = ctx.state.familyNodes[man.familyNodeId];
    if (!node) continue;
    // เป็นเณรเรียนหนังสือที่วัด (lore: ritual.novice_schooling_1680s) → อ่านออกเขียนได้ จดตำนานลงสมุดข่อยได้ตอนสืบทอด
    if (age === W.noviceAge && ctx.rng.chance(W.noviceChance)) {
      man.skills['literacy'] = Math.max(man.skills['literacy'] ?? 0, 40);
      out.push(`${man.name} ไปเป็นเณรเรียนหนังสือที่วัด`);
    }
    if (age === W.marriageAge && node.spouseIds.length === 0) {
      let home = man.householdId ? ctx.state.households[man.householdId] : undefined;
      if (home && home.headId !== man.id) home.memberIds = home.memberIds.filter((id) => id !== man.id);
      if (!home || home.headId !== man.id) home = createHousehold(ctx, man);
      const wife = spawnCharacter(ctx, {
        name: `ภรรยาของ${man.name}`, sex: 'f', birthYear: year - 17, estate: man.social.estate, householdId: home.id,
      });
      marry(ctx, man, wife);
      out.push(`${man.name} แต่งงาน ตั้งเรือนของตนเอง`);
    }
    if (W.childAtAges.includes(age)) {
      const wife = node.spouseIds
        .map((n) => ctx.state.familyNodes[n]?.characterId)
        .map((id) => (id ? ctx.state.characters[id] : undefined))
        .find(isAlive);
      if (!wife) continue;
      const sex = ctx.rng.chance(0.5) ? 'm' : 'f';
      const family = new Set([man.name, wife.name, ...node.childIds.map((id) => ctx.state.familyNodes[id]?.name ?? '')]);
      const kid = spawnCharacter(ctx, {
        name: pickName(ctx, sex, man.social.estate, family),
        sex, birthYear: year, estate: man.social.estate, father: man, mother: wife,
      });
      out.push(`${man.name} มีบุตร: ${kid.name}`);
    }
  }
  return out;
}
