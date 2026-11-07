import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, dayOfYear, isAlive, lunarOf, must, yearOf, yearsBetween, type Ctx } from '../core/ctx';
import type { Character, GameEventDef, TagId } from '../core/types';
import { tickWounds, type WoundOutcome } from './body';
import { chooseOption, prepareEvent, prepareFollowUp, requirementsMet, type EventReport, type PreparedEvent } from './events';
import { familiarity, findCourtier, forgetLocal, knownLocals, meetPeople, newCourtier, setRelation, spawnLocal } from './acquaintance';
import {
  createHousehold, inLawNames, joinHousehold, livingChildren, livingParents, livingSpouse, marriesThisYear, namesInUse, newbornAvoid,
  pickCaregiverChild, pickName, spawnCharacter, spouseAgeFor, wed,
} from './factory';
import { fictionEventsOfYear } from './fiction';
import { appointLivingHead, applyHistoricalShocks, historyHeadline, historyOn, driftLine, heirCandidates, isGraced, markDead, performHandover, settleDeath } from './handover';
import { careerYearTick, deptOf, officeRank } from './career';
import { campaignResolutionsToday, historyEventsToday } from './historyEvents';
import { pruneState } from './prune';
import { legendTruthEvent, renderLegend } from './legend';
import { divorceEvent, jealousyEvent, livingWives, minorWifeEvent } from './wives';
import { householdMonthTick, servantsYearTick } from './servants';
import { skillsMonthTick, skillsYearTick } from './skills';
import { drowningEvent, elderPreceptsEvent, parentIllnessEvent, topknotEvent, kinYearTick } from './lifeEvents';
import { tickChores, tickOutings } from './chores';
import { habitOption, tickFestivals } from './festivals';
import { arrangedMatchEvent, awayLabor, tickIntents } from './intent';
import { settleNpcSinsot, tickMarriage } from './marriage';
import { householdYearTick } from './socialLearning';
import { frailty, hardToRaiseEvent, inoculationEvent, mortalityYearTick, unattendedChildIllness } from './mortality';
import { kinDeathEvent } from './mourning';
import { feudEvent } from './feud';

// ============================================================================
// World tick — 1 call = 1 วัน. Pure function ของ (state, content, rng) → deterministic
// ไม่รู้จัก DOM / Worker / IndexedDB เลย → รันได้ทั้งใน Worker, Node (test/demo) และ server ถ้าจำเป็น
// ============================================================================

/** หมวดของบรรทัดใน log — UI ใช้กรอง ('choice' มาจากฝั่ง UI/worker ตอนผู้เล่นเลือกหรือสั่งเอง) */
export type LogKind = 'family' | 'death' | 'inherit' | 'body' | 'household' | 'daily' | 'people' | 'career' | 'history' | 'choice';

export type WorldSignal =
  /** art: tag เลือกภาพจิตรกรรมให้บรรทัดนี้ (หัวเหตุการณ์ประวัติศาสตร์) */
  | { type: 'log'; kind: LogKind; line: string; art?: string[] }
  | { type: 'event'; prepared: PreparedEvent }
  /** งานบุญที่ทำตามนิสัย — เลือกให้แล้ว (report) ไม่ต้องถามผู้เล่น */
  | { type: 'habit'; prepared: PreparedEvent; report: EventReport }
  | { type: 'playerDied' };

const WOUND_RESULT_TH: Record<WoundOutcome['result'], string> = {
  healed_clean: 'หายสนิท',
  scarred: 'หายแล้ว',
  impaired: 'หายแต่ใช้การได้ไม่เต็มที่',
  lost_part: 'ลุกลามจนเสียอวัยวะ',
  fatal: 'ลุกลามจนถึงแก่ชีวิต',
};

export function advanceDay(ctx: Ctx): WorldSignal[] {
  const S = ctx.state;
  const B = ctx.content.balance;
  const out: WorldSignal[] = [];
  const player = S.characters[S.meta.playerCharacterId];

  S.meta.day++;
  const year = yearOf(ctx, S.meta.day);

  // รายวัน: แผล
  const wounded = new Set(Object.values(S.wounds).map((w) => w.characterId));
  for (const cid of wounded) {
    const ch = S.characters[cid];
    if (!ch) continue;
    for (const o of tickWounds(ctx, ch)) {
      if (o.result === 'fatal') markDead(ctx, ch, 'situation:wound_fever');
      if (ch.id === player?.id) out.push({ type: 'log', kind: 'body', line: `แผลของ${ch.name}${WOUND_RESULT_TH[o.result]}${o.scar ? ' (กลายเป็นแผลเป็น)' : ''}` });
    }
  }

  // แผลของผู้เล่นเริ่มอักเสบ → ถามว่าจะรักษาอย่างไร (ครั้งเดียวต่อแผล) — ทางเลือกนี้กำหนดโอกาสรอดของแผลหนองเน่า
  if (player && isAlive(player)) {
    const w = Object.values(S.wounds).find((x) => x.characterId === player.id && x.stage === 'infected' && !x.consulted);
    if (w) {
      w.consulted = true;
      out.push({ type: 'event', prepared: prepareEvent(ctx, 'body.wound_infected', { actor: player.id }) });
    }
  }

  // รายเดือน (ขึ้น 1 ค่ำ): ความตั้งใจของผู้เล่น (เกี้ยว ผูกมิตร) เดินหน้า กินแรงงานที่บ้าน และอาจมี event แทรก
  if (lunarOf(ctx).day === 1) {
    const r = tickIntents(ctx);
    for (const line of r.lines) out.push({ type: 'log', kind: 'people', line });
    for (const prepared of r.events) out.push({ type: 'event', prepared });
    // งานบ้านของเด็ก: ถูกเรียกไปช่วย หัดขั้นใหม่ หรือนิสัยตัดสินเอง
    const chores = player ? tickChores(ctx, awayLabor(ctx, player)) : { lines: [], events: [] };
    for (const line of chores.lines) out.push({ type: 'log', kind: 'daily', line });
    for (const req of chores.events) out.push({ type: 'event', prepared: prepareEvent(ctx, req.event, req.bindings, req.vars) });
    for (const req of player ? tickOutings(ctx, awayLabor(ctx, player)) : []) out.push({ type: 'event', prepared: prepareEvent(ctx, req.event, req.bindings, req.vars) });
    // หมั้นถึงวันนัด / ถูกทวงค่าน้ำนม / ช่วยงานบ้านพ่อตาแม่ยาย
    const m = tickMarriage(ctx);
    for (const line of m.lines) out.push({ type: 'log', kind: 'family', line });
    for (const req of m.events) out.push({ type: 'event', prepared: prepareEvent(ctx, req.event, req.bindings) });
  }

  // เด็กเกิด: ผู้เล่นตั้งชื่อลูกเอง (namingEvent)
  const onBirth = (kid: Character, parent: Character, spouse: Character) => {
    const naming = namingEvent(ctx, kid, parent, spouse);
    if (naming) out.push({ type: 'event', prepared: naming });
    return !!naming;
  };
  for (const line of deliverBirths(ctx, onBirth)) out.push({ type: 'log', kind: 'family', line });
  // ค่ากินอยู่ งานของทาส และการฝึกวิชาประจำเดือน — เดือนละครั้ง (ทุก 30 วัน)
  if (S.meta.day % 30 === 0) {
    for (const hh of Object.values(S.households)) householdMonthTick(ctx, hh.id);
    for (const line of skillsMonthTick(ctx)) out.push({ type: 'log', kind: 'daily', line });
  }

  /** NPC ที่ตายวันนี้ → งานศพ มรดก ผู้สืบ และยุบคนตาย — ทำทุกวันที่มีคนตายจาก shock (1 ม.ค. หรือกลางปี) */
  const settleDeathsToday = () => {
    // NPC ที่ตายวันนี้ (แก่ / ศึกสงคราม) — ผู้เล่นจัดการผ่าน playerDied
    const diedToday = Object.values(S.characters).filter((ch) => ch.deathDay === S.meta.day && ch.id !== player?.id);
    const isHeadWithHeir = (ch: Character) =>
      !!ch.dynastyId && S.dynasties[ch.dynastyId]?.headNodeId === ch.familyNodeId && heirCandidates(ctx, ch).length > 0;
    // คนทั่วไป → งานศพ แบ่งมรดก ออกจากเรือน; ทำก่อน handover เพราะ handover prune ตัวละครที่ตายแล้วทิ้ง
    for (const ch of diedToday.filter((c) => !isHeadWithHeir(c))) {
      const r = settleDeath(ctx, ch);
      if (player && r.heirIds.includes(player.id)) for (const line of r.lines) out.push({ type: 'log', kind: 'inherit', line });
      appointLivingHead(ctx, ch); // หัวหน้าตระกูลที่ไม่มีผู้สืบตามสายเลือด แต่ตระกูลยังมีคนอยู่
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
      out.push({ type: 'log', kind: 'inherit', line: `มรดกของ${r.deceased} ตกถึง${r.heir} ผู้นำตระกูลคนใหม่` });
      for (const line of r.log) out.push({ type: 'log', kind: 'inherit', line });
    }
    // ยุบคนตายทุกปี ไม่รอ handover ครั้งหน้า (ซึ่งอาจห่างหลายสิบปี) — หลังแบ่งมรดกและสร้าง event งานศพแล้ว
    // คนที่ event ยังรอคำตอบอ้างถึง (งานศพ) และผู้เล่นที่เพิ่งตาย (worker ทำ handover ต่อ) ยุบรอบหน้า
    const drifted = driftLine(pruneState(ctx));
    if (drifted) out.push({ type: 'log', kind: 'family', line: drifted });
  };

  // เหตุการณ์ประวัติศาสตร์ที่ลงกลางปี (HistoricalEvent.day) — ของ 1 ม.ค. อยู่ในรอบรายปีด้านล่าง
  const doy = dayOfYear(ctx, S.meta.day);
  if (doy !== 0 && historyOn(ctx, year, doy).length) {
    const events = historyOn(ctx, year, doy);
    for (const line of applyHistoricalShocks(ctx, year, doy)) {
      const ev = events.find((e) => line === historyHeadline(ctx, e));
      out.push({ type: 'log', kind: 'history', line, ...(ev ? { art: [ev.tag, `historykind:${ev.kind}`] } : {}) });
    }
    settleDeathsToday();
  }

  // รายปี (1 ม.ค. — ปีเดียวกับ พ.ศ. ที่ใช้ระบุเหตุการณ์ประวัติศาสตร์)
  if (doy === 0) {
    const shocks = applyHistoricalShocks(ctx, year);
    const events = [...historyOn(ctx, year, 0), ...fictionEventsOfYear(ctx, year)];
    for (const line of shocks) {
      const ev = events.find((e) => line === historyHeadline(ctx, e));
      out.push({ type: 'log', kind: 'history', line, ...(ev ? { art: [ev.tag, `historykind:${ev.kind}`] } : {}) });
    }
    // ตายในปีที่ผ่านมา (เด็ก ไข้ทรพิษ ป่วย ชรา) — ก่อนการเกิด/แต่งงาน/พบคนใหม่ของปีนี้ ไม่ให้ event ผูกกับคนที่จะตาย
    for (const line of mortalityYearTick(ctx)) out.push({ type: 'log', kind: 'death', line });
    kinYearTick(ctx);
    for (const line of skillsYearTick(ctx)) out.push({ type: 'log', kind: 'household', line });
    const frail = hardToRaiseEvent(ctx);
    if (frail) out.push({ type: 'event', prepared: frail });
    const inoc = inoculationEvent(ctx);
    if (inoc) out.push({ type: 'event', prepared: inoc });
    const feud = feudEvent(ctx);
    if (feud) out.push({ type: 'event', prepared: feud });
    if (S.meta.childIllness) {
      const kid = S.characters[S.meta.childIllness];
      delete S.meta.childIllness;
      if (kid && isAlive(kid)) {
        if (player && isAlive(player)) out.push({ type: 'event', prepared: prepareEvent(ctx, 'family.child_grave_illness', { actor: player.id, child: kid.id }) });
        else {
          // ผู้เล่นตายรอบทอยเดียวกัน → ไม่มีใครเลือกรักษา ทอยด้วยค่าเฉลี่ยของตัวเลือกแทน (งานศพ/มรดกจัดใน settleDeathsToday ด้านล่าง)
          const line = unattendedChildIllness(ctx, kid);
          if (line) out.push({ type: 'log', kind: 'death', line });
        }
      }
    }
    if (S.meta.graveIllness) {
      delete S.meta.graveIllness;
      if (player && isAlive(player)) out.push({ type: 'event', prepared: prepareEvent(ctx, 'body.grave_illness', { actor: player.id }) });
    }
    for (const hh of Object.values(S.households)) {
      const logs = [...householdYearTick(ctx, hh.id), ...servantsYearTick(ctx, hh.id)];
      if (player && hh.memberIds.includes(player.id)) for (const line of logs) out.push({ type: 'log', kind: 'household', line });
    }
    for (const line of lifeMilestones(ctx, (child, spouse) => {
      // ลูกออกเรือน: ผู้เล่นได้เห็นหน้าลูกเขย/สะใภ้และตัดสินใจ (หนึ่งคนต่อปี คนอื่นแต่งตามปกติ)
      if (!player || !isAlive(player) || out.some((o) => o.type === 'event' && o.prepared.def.id === 'family.child_wedding')) return false;
      out.push({ type: 'event', prepared: prepareEvent(ctx, 'family.child_wedding', { actor: player.id, child: child.id, spouse: spouse.id }) });
      return true;
    })) out.push({ type: 'log', kind: 'family', line });
    const inEvents = out.flatMap((o) => (o.type === 'event' ? Object.values(o.prepared.instance.bindings) : []));
    for (const line of meetPeople(ctx, inEvents)) out.push({ type: 'log', kind: 'people', line });
    // บวชก่อนแต่ง (การบวชยุติการสมรส lore: kinship.marriage_law_three_seals) — ถามก่อนผู้ใหญ่ทาบทามคู่
    const ordination = ordinationEvent(ctx);
    if (ordination) out.push({ type: 'event', prepared: ordination });
    const minorWife = minorWifeEvent(ctx);
    if (minorWife) out.push({ type: 'event', prepared: minorWife });
    // วัยผู้ใหญ่และวัยชรา: โกนจุกลูก พ่อแม่ป่วยหนัก ถือศีลวันพระ
    for (const life of [topknotEvent(ctx), parentIllnessEvent(ctx), elderPreceptsEvent(ctx), drowningEvent(ctx)]) {
      if (life) out.push({ type: 'event', prepared: life });
    }
    const jealous = jealousyEvent(ctx);
    if (jealous) out.push({ type: 'event', prepared: jealous });
    const split = divorceEvent(ctx);
    if (split) out.push({ type: 'event', prepared: split });
    // ความลับตำนานแตก: ญาติที่ทันเห็นเรื่องจริงเล่าให้ฟัง — ส่งข้อความตำนานทั้งสองแบบเป็นตัวแปรของ event
    const truth = player && isAlive(player) ? legendTruthEvent(ctx) : null;
    if (truth) {
      out.push({
        type: 'event',
        prepared: prepareEvent(ctx, 'family.legend_truth', { actor: player!.id, elder: truth.witness.id }, {
          legend: truth.legend.id, told: renderLegend(ctx, truth.legend, 'current'), truth: renderLegend(ctx, truth.legend, 'truth'),
        } as Record<string, TagId>),
      });
    }
    const match = arrangedMatchEvent(ctx);
    if (match) out.push({ type: 'event', prepared: match });
    // ราชการ: ถวายตัว รายได้ตามตำแหน่ง เลื่อนยศ/ถูกลงโทษ
    const career = careerYearTick(ctx);
    for (const line of career.lines) out.push({ type: 'log', kind: 'career', line });
    for (const req of career.events) out.push({ type: 'event', prepared: prepareEvent(ctx, req.event, req.bindings) });
    // ญาติใกล้ชิดของผู้เล่นตายปีนี้ → งานศพ (คนที่ใกล้ที่สุด)
    const mourning = kinDeathEvent(ctx);
    if (mourning) out.push({ type: 'event', prepared: mourning });
    settleDeathsToday();
  }

  // event ตามปฏิทินประวัติศาสตร์ (ศึกพม่า 2308–2310 ฯลฯ — rules.json historyEvents)
  for (const line of campaignResolutionsToday(ctx)) out.push({ type: 'log', kind: 'history', line });
  for (const prepared of historyEventsToday(ctx)) out.push({ type: 'event', prepared });
  // งานบุญ/งานประจำปี: วันพระ งานวัด ลอยโคม รดน้ำพ่อแม่ — ที่ทำจนเป็นนิสัยแล้วเลือกให้เอง
  for (const req of player ? tickFestivals(ctx, awayLabor(ctx, player)) : []) {
    const prepared = prepareEvent(ctx, req.event, req.bindings, req.vars);
    const habit = habitOption(ctx, player!, prepared);
    if (!habit) {
      out.push({ type: 'event', prepared });
      continue;
    }
    const report = chooseOption(ctx, prepared, habit);
    out.push({ type: 'habit', prepared, report });
    const next = prepareFollowUp(ctx, prepared, report);
    if (next) out.push({ type: 'event', prepared: next });
  }

  // เหตุการณ์ของผู้เล่น
  if (isAlive(player) && ctx.rng.chance(B.world.eventsPerYear / DAYS_PER_YEAR)) {
    const prepared = pickEvent(ctx, player);
    if (prepared) out.push({ type: 'event', prepared });
  }
  if (player && !isAlive(player)) out.push({ type: 'playerDied' });
  return out;
}

/**
 * ผู้เล่นชายที่ยังไม่แต่งงานและยังไม่บวช ในช่วงอายุบวช → ผู้ใหญ่เอ่ยเรื่องบวช (lore: ritual.ordination)
 * ปีสุดท้ายของช่วงถามแน่ — ปฏิเสธได้ แต่พ่อแม่ผิดหวัง
 */
function ordinationEvent(ctx: Ctx): PreparedEvent | null {
  const O = ctx.content.balance.ordination;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || player.sex !== 'm' || player.ordainedYear !== undefined) return null;
  if (livingSpouse(ctx, player) || player.betrothal || player.eloped) return null;
  const age = ageOf(ctx, player);
  if (age < O.age[0] || age > O.age[1] || (age < O.age[1] && !ctx.rng.chance(O.playerChance))) return null;
  const parents = livingParents(ctx, player);
  const elder = parents.find((p) => p.householdId === player.householdId) ?? parents[0];
  return prepareEvent(ctx, 'ritual.ordination', { actor: player.id, ...(elder ? { elder: elder.id } : {}) });
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
  // คนในราชการที่ยังไม่เคยพบ → สร้างหลังสุ่มได้ event นั้นแล้ว (ไม่สร้างคนทิ้งไว้ทุกครั้งที่ไล่หา)
  const bound: Array<{ def: GameEventDef; bindings: Record<string, Character['id']>; meet: Array<[string, 'rival' | 'patron']> }> = [];
  for (const def of Object.values(ctx.content.events)) {
    const t = def.trigger;
    if (t.ageRange && (age < t.ageRange[0] || age > t.ageRange[1])) continue;
    if (t.estates && !t.estates.includes(actor.social.estate)) continue;
    if (t.office) {
      const rank = officeRank(ctx, actor);
      if (rank === undefined || rank < (t.office.minRank ?? 0) || rank > (t.office.maxRank ?? Infinity)) continue;
      if (t.office.dept && deptOf(ctx, actor).id !== t.office.dept) continue;
    }
    if (t.cooldownDays) {
      const recent = Object.values(ctx.state.eventLog).some(
        (e) => e.defId === def.id && e.bindings.actor === actor.id && day - e.day < t.cooldownDays!,
      );
      if (recent) continue;
    }
    const bindings: Record<string, Character['id']> = { actor: actor.id };
    const meet: Array<[string, 'rival' | 'patron']> = [];
    const ageOk = (ch: Character, range: [number, number] | undefined) =>
      !range || (ageOf(ctx, ch) >= range[0] && ageOf(ctx, ch) <= range[1]);
    let ok = ageOk(actor, def.roles.actor?.ageRange);
    for (const [role, f] of Object.entries(def.roles)) {
      if (!ok) break;
      if (role === 'actor') continue;
      const who = resolveRole(ctx, actor, f.relationToActor);
      if (!who && (f.relationToActor === 'rival' || f.relationToActor === 'patron')) {
        meet.push([role, f.relationToActor]);
        continue;
      }
      if (!who || !ageOk(who, f.ageRange)) {
        ok = false;
        break;
      }
      bindings[role] = who.id;
    }
    if (ok && requirementsMet(ctx, def, actor, bindings)) bound.push({ def, bindings, meet });
  }
  // เรื่องที่เพิ่งเกิดกับคนนี้ (ในบันทึก ~10 ปี) มีโอกาสน้อยลงทีละครั้ง
  const recent = new Map<string, number>();
  for (const e of Object.values(ctx.state.eventLog)) {
    if (e.bindings.actor === actor.id) recent.set(e.defId, (recent.get(e.defId) ?? 0) + 1);
  }
  // สุ่มตามน้ำหนักเดิม แล้วเรื่องที่เคยเกิดมีโอกาสถูกข้าม (ไม่มีเรื่องอื่นให้ขึ้นแทน = ปีนั้นเงียบไป ดีกว่าเรื่องเดิมซ้ำ)
  const pick = ctx.rng.weighted(bound, (b) => b.def.trigger.weight);
  if (!pick || !ctx.rng.chance(ctx.content.balance.world.repeatDamp ** (recent.get(pick.def.id) ?? 0))) return null;
  for (const [role, kind] of pick.meet) pick.bindings[role] = newCourtier(ctx, actor, kind).id;
  return prepareEvent(ctx, pick.def.id, pick.bindings);
}

function resolveRole(ctx: Ctx, actor: Character, rel: string | undefined): Character | undefined {
  // ย้ายไปอยู่ใกล้บ้านคนที่หมายปอง → เรื่องในเรือนกับพ่อแม่/คนเลี้ยงไม่เกิด
  if ((rel === 'caregiver' || rel === 'parent') && awayLabor(ctx, actor) >= 1) return undefined;
  if (rel === 'caregiver') return actor.caregiverIds.map((id) => ctx.state.characters[id]).find(isAlive);
  if (rel === 'rival' || rel === 'patron') return findCourtier(ctx, actor, rel);
  if (rel === 'elder_acquaintance') {
    const elders = knownLocals(ctx, actor).filter((c) => ageOf(ctx, c) >= 50 && familiarity(ctx, actor.id, c.id) >= 0.3);
    return ctx.rng.pick(elders);
  }
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
  /** ลูกของผู้เล่นถึงคราวออกเรือน — คืน true ถ้าจะให้ผู้เล่นตัดสินใจเอง (event จัดการแต่งให้) */
  onChildWedding?: (child: Character, spouse: Character) => boolean,
): string[] {
  const W = ctx.content.balance.world;
  const day = ctx.state.meta.day;
  const year = yearOf(ctx, day);
  const out: string[] = [];
  for (const ch of Object.values(ctx.state.characters)) {
    // คนในตระกูลเท่านั้น — คู่ครองคนนอกตามคู่ของตัวเอง
    if (!isAlive(ch) || !ch.dynastyId) continue;
    const age = ageOf(ctx, ch);
    const spouse = livingSpouse(ctx, ch);

    // เป็นเณรเรียนหนังสือที่วัด (lore: ritual.novice_schooling_1680s) → อ่านออกเขียนได้ จดตำนานลงสมุดข่อยได้ตอนสืบทอด
    if (ch.sex === 'm' && age === W.noviceAge && ctx.rng.chance(W.noviceChance)) {
      ch.skills['literacy'] = Math.max(ch.skills['literacy'] ?? 0, 40);
      out.push(`${ch.name}ไปเป็นเณรเรียนหนังสือที่วัด`);
    }
    // บวชเรียนหนึ่งพรรษา (lore: ritual.ordination) — พ่อแม่ได้บุญ; ผู้เล่นตัดสินใจเองผ่าน ordinationEvent
    const O = ctx.content.balance.ordination;
    if (ch.sex === 'm' && !spouse && ch.ordainedYear === undefined && age === O.age[0] + 1
      && ch.id !== ctx.state.meta.playerCharacterId && ctx.rng.chance(O.npcChance)) {
      ch.ordainedYear = year;
      ch.skills['literacy'] = Math.max(ch.skills['literacy'] ?? 0, O.literacy);
      ch.merit += 2;
      for (const p of livingParents(ctx, ch)) p.merit += 2;
      out.push(`${ch.name}บวชเรียนหนึ่งพรรษา`);
    }

    const neverMarried = (ctx.state.familyNodes[ch.familyNodeId]?.spouseIds.length ?? 0) === 0;
    // ผู้เล่นไม่ถูกจับแต่ง — เกี้ยวเอง หรือรับ/ปฏิเสธคู่ที่ผู้ใหญ่ทาบทาม (arrangedMatchEvent)
    if (neverMarried && ch.id !== ctx.state.meta.playerCharacterId && marriesThisYear(ctx, ch.sex, age)) {
      const line = marryOut(ctx, ch, year, onChildWedding);
      if (line) out.push(line);
    }

    // แยกเรือนเมื่อครบกำหนด — ลูกที่อยู่ดูแลพ่อแม่ไม่ย้าย
    if (ch.moveOutDay !== undefined && day >= ch.moveOutDay) {
      ch.moveOutDay = undefined;
      const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
      const head = hh ? ctx.state.characters[hh.headId] : undefined;
      if (hh && head && livingChildren(ctx, head).some((c) => c.id === ch.id)) {
        const siblingsAtHome = livingChildren(ctx, head).filter((c) => c.householdId === hh.id);
        if (pickCaregiverChild(siblingsAtHome)?.id === ch.id) {
          out.push(`${ch.name}อยู่ดูแล${head.name}ต่อที่เรือนเดิม`);
        } else {
          const home = createHousehold(ctx, ch);
          for (const m of [spouse, ...livingChildren(ctx, ch)]) if (m && m.householdId === hh.id) joinHousehold(ctx, m, home);
          out.push(`${ch.name}แยกเรือนออกจากบ้าน${head.name}`);
        }
      }
    }

    // มีบุตร — นับจากฝั่งคนในตระกูลเพื่อไม่ให้นับซ้ำ; ผู้ชายที่มีเมียน้อยมีลูกกับเมียแต่ละคน
    const mothers = ch.sex === 'f' ? (spouse ? [ch] : []) : livingWives(ctx, ch);
    // ตั้งครรภ์ปีนี้ → คลอดเมื่อครบกำหนด (deliverBirths ทุกวัน) — ระหว่างนั้นภาพตัวละครเป็นหญิงมีครรภ์
    for (const mother of mothers) {
      if (ch.marriedDay === undefined || mother.pregnancy || !conceives(ctx, ch, mother, year)) continue;
      const partner = ch.sex === 'f' ? spouse! : mother;
      const dueDay = day + Math.round(ctx.rng.range(W.births.dueDays[0], W.births.dueDays[1]));
      mother.pregnancy = { memberId: ch.id, partnerId: partner.id, dueDay };
      mother.pregnantUntilDay = dueDay;
      out.push(`${mother.name}ตั้งครรภ์`);
    }
  }
  return out;
}

/** คลอดลูกที่ครบกำหนดวันนี้ — แม่ตายก่อนกำหนด ลูกก็ไม่ได้เกิด */
export function deliverBirths(
  ctx: Ctx, onBirth?: (kid: Character, parent: Character, spouse: Character) => boolean,
): string[] {
  const W = ctx.content.balance.world;
  const day = ctx.state.meta.day;
  const year = yearOf(ctx, day);
  const out: string[] = [];
  for (const mother of Object.values(ctx.state.characters)) {
    const pg = mother.pregnancy;
    if (!pg || day < pg.dueDay) continue;
    delete mother.pregnancy;
    delete mother.pregnantUntilDay;
    const ch = ctx.state.characters[pg.memberId];
    const partner = ctx.state.characters[pg.partnerId];
    if (!isAlive(mother) || !ch || !partner) continue;
    const father = mother === ch ? partner : ch;
    const sex = ctx.rng.chance(0.5) ? 'm' : 'f';
    // ชื่อผู้เล่นห้ามซ้ำเสมอ — เรื่องทั้งเกมเล่าผ่านคนนี้
    const kid = spawnCharacter(ctx, {
      name: pickName(ctx, sex, ch.social.estate, newbornAvoid(ctx, ch, partner), namesInUse(ctx, ch.dynastyId, year)),
      sex, birthYear: year, estate: ch.social.estate, father, mother,
      ...(mother.wifeRank === 'minor' ? { parentage: (mother.social.estate === 'that' ? 'slave_wife' : 'minor_wife') as 'slave_wife' | 'minor_wife' } : {}),
    });
    kid.birthDay = day;
    // ทาสหญิงที่มีบุตรกับนาย พ้นจากความเป็นทาส (lore: social.slavery_as_strategy)
    if (mother.social.estate === 'that' && father.social.estate !== 'that') {
      mother.social.estate = 'phrai_som';
      out.push(`${mother.name}พ้นจากความเป็นทาส เพราะมีบุตรกับนาย`);
    }
    // แม่ตายตอนคลอด (lore: health.childbirth_deaths) — ก่อน event ตั้งชื่อ จะได้ไม่ให้แม่ที่ตายแล้วตั้งชื่อ
    const motherDied = !isGraced(ctx, mother) && ctx.rng.chance(Math.min(1, W.childbirthDeathRisk * frailty(ctx, mother)));
    if (motherDied) markDead(ctx, mother, 'situation:childbirth');
    // ผู้เล่นจะตั้งชื่อเอง → ยังไม่บอกชื่อชั่วคราวใน log (พ่อ/แม่ฝั่งตระกูลตายไปก่อนคลอด → ไม่ถาม)
    const naming = isAlive(ch) ? onBirth?.(kid, ch, partner) ?? false : false;
    out.push(naming ? `${ch.name}มีบุตร${sex === 'm' ? 'ชาย' : 'หญิง'}` : `${ch.name}มีบุตร: ${kid.name}`);
    if (motherDied && mother.id !== ctx.state.meta.playerCharacterId) {
      out.push(`${mother.name}ตายตอนคลอด`);
      // ตายกลางปี — แบ่งมรดกและออกจากเรือนเลย (คนที่ตายวันขึ้นปีใหม่ รอบประจำปีจัดการให้)
      if (dayOfYear(ctx, day) !== 0) {
        const r = settleDeath(ctx, mother);
        if (r.heirIds.includes(ctx.state.meta.playerCharacterId)) out.push(...r.lines);
      }
    }
  }
  return out;
}

/**
 * ปีนี้มีลูกไหม (lore: health.population_stationary): แต่งมาแล้วอย่างน้อยปีหนึ่ง แม่ยังไม่เกิน maxMotherAge
 * และลูกคนก่อนของแม่คนนี้เกินกำหนดหย่านม (minGapYears) แล้ว — เมียน้อยนับวันแต่งของตัวเอง
 */
function conceives(ctx: Ctx, ch: Character, mother: Character, year: number): boolean {
  const B = ctx.content.balance.world.births;
  const since = mother.marriedDay ?? must(ch.marriedDay, 'marriedDay');
  if (yearsBetween(ctx, since) < 1 || ageOf(ctx, mother) > B.maxMotherAge) return false;
  const nodes = ctx.state.familyNodes;
  const last = Math.max(-Infinity, ...(nodes[mother.familyNodeId]?.childIds ?? []).map((id) => nodes[id]?.birthYear ?? -Infinity));
  // ผัวมาค้างด้วยบ่อย (เมนูตัวละคร) → ปีนี้มีลูกง่ายขึ้น
  const favored = (mother.favoredUntil ?? -1) >= ctx.state.meta.day ? ctx.content.balance.interactions.favoredBirthFactor : 1;
  return year - last >= B.minGapYears && ctx.rng.chance(Math.min(0.95, B.yearlyChance * favored));
}

function marryOut(ctx: Ctx, ch: Character, year: number, onChildWedding?: (child: Character, spouse: Character) => boolean): string {
  const spouseSex = ch.sex === 'm' ? 'f' : 'm';
  const spouseAge = spouseAgeFor(ctx, spouseSex, ageOf(ctx, ch));
  // ลูกของผู้เล่น: ผู้ใหญ่อีกบ้านมาทาบทาม ผู้เล่นได้เห็นหน้าและตัดสินใจ (คนนอกที่ไม่ได้แต่ง ระบบคนรู้จักลบทิ้งเอง)
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (onChildWedding && isAlive(player) && livingParents(ctx, ch).some((p) => p.id === player.id)) {
    const trade = ctx.rng.weighted(ctx.content.trades.filter((t) => t.estate === ch.social.estate), (t) => t.weight);
    const match = spawnLocal(ctx, ch, { sex: spouseSex, age: spouseAge, distance: 'town', single: true, avoid: inLawNames(ctx, ch), ...(trade ? { trade } : {}) });
    // ผู้เล่นได้เห็นหน้าแล้ว — ไม่งั้นรอบคนรู้จักปีเดียวกันลบทิ้งก่อน event ขึ้น
    setRelation(ctx, player.id, match.id, 'acquaintance', 0.05);
    if (onChildWedding(ch, match)) return '';
    forgetLocal(ctx, match);
  }
  const spouse = spawnCharacter(ctx, {
    name: pickName(ctx, spouseSex, ch.social.estate, inLawNames(ctx, ch), namesInUse(ctx, ch.dynastyId, year)),
    sex: spouseSex, birthYear: year - spouseAge, estate: ch.social.estate, dynastyId: null, householdId: null,
  });
  // สินสอด: ลูกชายในตระกูลจ่ายออก (ตัวเองหรือพ่อแม่) ลูกสาวได้เข้าเรือนพ่อแม่ — อีกฝ่ายอยู่นอกฉาก
  const sinsot = settleNpcSinsot(ctx, ch, spouse);
  return `${wed(ctx, ch, spouse)}${sinsot ? ` (สินสอด ${sinsot} ตำลึง)` : ''}`;
}
