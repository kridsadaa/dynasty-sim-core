import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, GameEventDef } from '../core/types';
import { tickWounds, type WoundOutcome } from './body';
import { prepareEvent, type PreparedEvent } from './events';
import { meetPeople } from './acquaintance';
import {
  createHousehold, inLawNames, joinHousehold, livingChildren, livingSpouse, namesInUse, newbornAvoid, pickCaregiverChild,
  pickName, spawnCharacter, wed,
} from './factory';
import { applyHistoricalShocks, heirCandidates, markDead, performHandover, settleDeath } from './handover';
import { arrangedMatchEvent, awayLabor, tickIntents } from './intent';
import { householdYearTick } from './socialLearning';

// ============================================================================
// World tick — 1 call = 1 วัน. Pure function ของ (state, content, rng) → deterministic
// ไม่รู้จัก DOM / Worker / IndexedDB เลย → รันได้ทั้งใน Worker, Node (test/demo) และ server ถ้าจำเป็น
// ============================================================================

export type WorldSignal =
  | { type: 'log'; line: string }
  | { type: 'event'; prepared: PreparedEvent }
  | { type: 'playerDied' };

const WOUND_RESULT_TH: Record<WoundOutcome['result'], string> = {
  healed_clean: 'หายสนิท',
  scarred: 'หายแล้ว',
  impaired: 'หายแต่ใช้การได้ไม่เต็มที่',
  lost_part: 'ลุกลามจนเสียอวัยวะ',
};

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
      if (ch.id === player?.id) out.push({ type: 'log', line: `แผลของ${ch.name}${WOUND_RESULT_TH[o.result]}${o.scar ? ' (กลายเป็นแผลเป็น)' : ''}` });
    }
  }

  // รายเดือน: ความตั้งใจของผู้เล่น (เกี้ยว ผูกมิตร) เดินหน้า กินแรงงานที่บ้าน และอาจมี event แทรก
  if (S.meta.day % 30 === 0) {
    const r = tickIntents(ctx);
    for (const line of r.lines) out.push({ type: 'log', line });
    for (const prepared of r.events) out.push({ type: 'event', prepared });
  }

  // รายปี (วันแรกของปี)
  if (S.meta.day % B.daysPerYear === 0) {
    for (const line of applyHistoricalShocks(ctx, year)) out.push({ type: 'log', line });
    for (const hh of Object.values(S.households)) {
      const logs = householdYearTick(ctx, hh.id);
      if (player && hh.memberIds.includes(player.id)) for (const line of logs) out.push({ type: 'log', line });
    }
    for (const line of lifeMilestones(ctx, (kid, parent, spouse) => {
      const naming = namingEvent(ctx, kid, parent, spouse);
      if (naming) out.push({ type: 'event', prepared: naming });
      return !!naming;
    })) out.push({ type: 'log', line });
    for (const line of meetPeople(ctx)) out.push({ type: 'log', line });
    const match = arrangedMatchEvent(ctx);
    if (match) out.push({ type: 'event', prepared: match });
    for (const ch of Object.values(S.characters)) {
      if (!isAlive(ch)) continue;
      const over = ageOf(ctx, ch) - B.world.oldAgeStart;
      if (over > 0 && ctx.rng.chance(over * B.world.oldAgeYearlyRisk)) {
        markDead(ctx, ch, 'situation:old_age');
        if (ch.id !== player?.id) out.push({ type: 'log', line: `${ch.name} ถึงแก่กรรม` });
      }
    }
    // NPC ที่ตายวันนี้ (แก่ / ศึกสงคราม) — ผู้เล่นจัดการผ่าน playerDied
    const diedToday = Object.values(S.characters).filter((ch) => ch.deathDay === S.meta.day && ch.id !== player?.id);
    const isHeadWithHeir = (ch: Character) =>
      !!ch.dynastyId && S.dynasties[ch.dynastyId]?.headNodeId === ch.familyNodeId && heirCandidates(ctx, ch).length > 0;
    // คนทั่วไป → งานศพ แบ่งมรดก ออกจากเรือน; ทำก่อน handover เพราะ handover prune ตัวละครที่ตายแล้วทิ้ง
    for (const ch of diedToday.filter((c) => !isHeadWithHeir(c))) {
      const r = settleDeath(ctx, ch);
      if (player && r.heirIds.includes(player.id)) for (const line of r.lines) out.push({ type: 'log', line });
    }
    // หัวหน้าตระกูลที่เป็น NPC → สืบทอดตระกูลทันที ผู้เล่นได้ส่วนถ้าเป็นทายาท
    for (const ch of diedToday.filter(isHeadWithHeir)) {
      if (!S.characters[ch.id]) continue;
      const cands = heirCandidates(ctx, ch);
      if (!cands.length) {
        settleDeath(ctx, ch);
        continue;
      }
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

/**
 * เด็กเกิดในสายผู้เล่น → event ตั้งชื่อ
 *  - ลูกของผู้เล่น: ผู้เล่นเลือกว่าจะตั้งเอง ให้คู่ครอง/พระ/พ่อแม่ตั้ง
 *  - หลาน (ลูกของลูกผู้เล่น): บางครั้งลูกพาหลานมาให้ตั้งชื่อ
 */
function namingEvent(ctx: Ctx, kid: Character, parent: Character, spouse: Character): PreparedEvent | null {
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!player || !isAlive(player)) return null;
  if (parent.id === player.id || spouse.id === player.id) {
    const elder = resolveRole(ctx, player, 'parent');
    const other = parent.id === player.id ? spouse : parent;
    return prepareEvent(ctx, 'family.newborn', {
      actor: player.id, child: kid.id,
      ...(isAlive(other) ? { spouse: other.id } : {}),
      ...(elder ? { elder: elder.id } : {}),
    });
  }
  const isPlayersChild = livingChildren(ctx, player).some((c) => c.id === parent.id);
  if (isPlayersChild && ctx.rng.chance(ctx.content.balance.world.grandchildNamingChance)) {
    return prepareEvent(ctx, 'family.grandchild_naming', { actor: player.id, parent: parent.id, child: kid.id });
  }
  return null;
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
    const ageOk = (ch: Character, range: [number, number] | undefined) =>
      !range || (ageOf(ctx, ch) >= range[0] && ageOf(ctx, ch) <= range[1]);
    let ok = ageOk(actor, def.roles.actor?.ageRange);
    for (const [role, f] of Object.entries(def.roles)) {
      if (!ok) break;
      if (role === 'actor') continue;
      const who = resolveRole(ctx, actor, f.relationToActor);
      if (!who || !ageOk(who, f.ageRange)) {
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
  // ย้ายไปอยู่ใกล้บ้านคนที่หมายปอง → เรื่องในเรือนกับพ่อแม่/คนเลี้ยงไม่เกิด
  if ((rel === 'caregiver' || rel === 'parent') && awayLabor(ctx, actor) >= 1) return undefined;
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
export function lifeMilestones(
  ctx: Ctx,
  /** เรียกทุกครั้งที่มีเด็กเกิด — คืน true ถ้าจะให้ผู้เล่นตั้งชื่อ */
  onBirth?: (kid: Character, parent: Character, spouse: Character) => boolean,
): string[] {
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
    // ผู้เล่นไม่ถูกจับแต่ง — เกี้ยวเอง หรือรับ/ปฏิเสธคู่ที่ผู้ใหญ่ทาบทาม (arrangedMatchEvent)
    if (age === marriageAge && neverMarried && ch.id !== ctx.state.meta.playerCharacterId) out.push(marryOut(ctx, ch, year));

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
      // ชื่อผู้เล่นห้ามซ้ำเสมอ — เรื่องทั้งเกมเล่าผ่านคนนี้
      const kid = spawnCharacter(ctx, {
        name: pickName(ctx, sex, ch.social.estate, newbornAvoid(ctx, ch, spouse), namesInUse(ctx, ch.dynastyId, year)),
        sex, birthYear: year, estate: ch.social.estate, father, mother,
      });
      // ผู้เล่นจะตั้งชื่อเอง → ยังไม่บอกชื่อชั่วคราวใน log
      const naming = onBirth?.(kid, ch, spouse) ?? false;
      out.push(naming ? `${ch.name} มีบุตร${sex === 'm' ? 'ชาย' : 'หญิง'}` : `${ch.name} มีบุตร: ${kid.name}`);
    }
  }
  return out;
}

function marryOut(ctx: Ctx, ch: Character, year: number): string {
  const W = ctx.content.balance.world;
  const spouseSex = ch.sex === 'm' ? 'f' : 'm';
  const spouseAge = spouseSex === 'm' ? W.marriageAge : W.marriageAgeFemale;
  const spouse = spawnCharacter(ctx, {
    name: pickName(ctx, spouseSex, ch.social.estate, inLawNames(ctx, ch), namesInUse(ctx, ch.dynastyId, year)),
    sex: spouseSex, birthYear: year - spouseAge, estate: ch.social.estate, dynastyId: null, householdId: null,
  });
  return wed(ctx, ch, spouse);
}
