// npm run sim:check — รันโลกจริง (advanceDay) หลาย seed แล้วตรวจ invariant ของ state
// exit code ≠ 0 เมื่อมีข้อใดผิด → ใช้เป็น regression test ได้โดยไม่ต้องมี test framework
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { epochJd, formatLunar, formatPortuguese, gregorianToJd, lunarFromJd, solarDate, yearsToDays } from './core/calendar';
import { ageOf, commitRng, dayOfYear, isAlive, isNovice, lunarOf, makeCtx, yearOf, yearStart, type Ctx } from './core/ctx';
import { bargeToday, bargeYear } from './systems/barge';
import type { Character, ContentDB, GameEventDef } from './core/types';
import { inflictWound, selectPart, tickWounds } from './systems/body';
import { inoculationEvent, mortalityYearTick } from './systems/mortality';
import { feudEvent } from './systems/feud';
import { chooseOption, prepareEvent, prepareFollowUp, requirementsMet, type PreparedEvent } from './systems/events';
import { emptyState, marry, spawnCharacter } from './systems/factory';
import { applyHistoricalShocks, estateHeirs, heirCandidates, markDead, performHandover, settleDeath } from './systems/handover';
import { CAPTIVE_TAG } from './systems/war';
import { atWar, campaignBindings, resolveCampaign, SUBSTITUTE_DEATH, SUBSTITUTE_FLOOR, substituteDeathChance } from './systems/campaign';
import { knownLocals, setRelation, spawnLocal } from './systems/acquaintance';
import { applyMarriageStep, purse } from './systems/marriage';
import { activeIntent, planIntent, startIntent, targetProblem } from './systems/intent';
import { bootstrapScenario } from './systems/scenario';
import { kinYearTick, markNursing } from './systems/lifeEvents';
import { applyCareer, careerSkill, careerYearTick, officeRank, officeStatus, officeTier } from './systems/career';
import { companions, habitOption } from './systems/festivals';
import { findSlaveConcubines, performInteraction, takeSlaveConcubine } from './systems/interactions';
import { dropMatches } from './systems/matchmaking';
import { buyHouseholdLand, buyHouseholdSlave, expandHousehold, freeHouseholdSlave, houseCapacity, householdMonth } from './systems/servants';
import { hasPerk, legacyLevel, mortalityShield, setSkillFocus, SKILL_TRACKS, skillsMonthTick, skillsYearTick, unlockDynastyLegacy, unlockNextPerk } from './systems/skills';
import { jealousyEvent, livingWives, minorWifeProblem, takeMinorWife } from './systems/wives';
import { advanceDay, lifeMilestones } from './systems/world';
import { allowedAt, whereabouts } from './systems/whereabouts';
import { eraConditions, eventView, playerView } from './engine/views';
import { settlePlayerDeath } from './engine/death';
import { buryValuables, unearthBuried, warBadges, warDeathMult } from './systems/war';
import { riskChance } from './systems/will';
import { activeFiction, drawFictionEvents, isFictionYear } from './systems/fiction';
import { eraAt, institutionActive } from './systems/eras';
import { historyEventsToday } from './systems/historyEvents';
import { END_YEAR } from './systems/scenario';

const load = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'content', f), 'utf8'));
const content: ContentDB = buildContentDB({
  names: load('names.json'),
  tags: load('tags.json'),
  anatomy: load('anatomy.json'),
  traitKinds: load('traitKinds.json'),
  events: load('events.json'),
  rules: load('rules.json'),
  intents: load('intents.json'),
  offices: load('offices.json'),
  chores: load('chores.json'),
  balance: load('balance.json'),
});
const SEEDS = Number(process.argv[2] ?? 5);
const INVEST = process.argv[3] === 'invest';
/** โหมด long (npm run sim:check -- 10 long): เล่นต่อหลัง 2400 ถึง 2600 แบบกดเล่นต่อ — รายงานเงิน/สิ้นสาย/ขนาดเซฟรายศตวรรษ ไม่นับ balanceCheck */
const LONG = process.argv[3] === 'long';
const LONG_END_YEAR = 2600;
const longSamples: Record<number, { wealth: number[]; family: number[]; alive: number }> = { 2400: { wealth: [], family: [], alive: 0 }, 2500: { wealth: [], family: [], alive: 0 }, 2590: { wealth: [], family: [], alive: 0 } };
let failed = 0;

function check(label: string, problems: string[]) {
  if (!problems.length) return;
  failed++;
  console.log(`  ✗ ${label}: ${problems.length} — ${problems.slice(0, 3).join('; ')}`);
}

function invariants(ctx: Ctx, ended: boolean): void {
  const S = ctx.state;
  const alive = (id: string | null | undefined) => !!id && isAlive(S.characters[id as keyof typeof S.characters]);
  // ตระกูลสิ้นสาย = เกมจบตรงนั้น ไม่มี handover/settle ของผู้เล่นคนสุดท้าย (และไม่ถูกเซฟ) → ข้ามข้อที่เกี่ยวกับมรดก
  if (!ended) {
    check('ของที่เจ้าของตายหรือถูกลบไปแล้ว', Object.values(S.items).filter((i) => i.ownerCharacterId && !alive(i.ownerCharacterId)).map((i) => i.id));
    check('เรือนที่หัวเรือนไม่มีชีวิต', Object.values(S.households).filter((h) => !alive(h.headId)).map((h) => h.id));
    check('สมาชิกเรือนที่ตายแล้ว', Object.values(S.households).flatMap((h) => h.memberIds.filter((id) => !alive(id))));
    check('คนตายที่ยังถือเงิน', Object.values(S.characters).filter((c) => !isAlive(c) && c.social.wealth > 0.5).map((c) => c.name));
    // ผู้นำตายโดยมีญาติในตระกูล → ต้องส่งต่อ; ว่างได้เฉพาะตอนสิ้นสาย
    check('ผู้นำตระกูลที่ไม่มีชีวิต', Object.values(S.dynasties).filter((d) => !alive(S.familyNodes[d.headNodeId]?.characterId)).map((d) => d.name));
  }
  check('ความตั้งใจที่ผู้ทำ/เป้าหมายไม่อยู่แล้ว', Object.values(S.intents).filter((i) => !alive(i.actorId) || !S.characters[i.targetId]).map((i) => i.id));
  check('ขั้นตอนแต่งงานค้างอยู่กับคนที่ไม่มีแล้ว', Object.values(S.characters).flatMap((c) =>
    [c.betrothal?.toId, c.eloped?.withId, c.service?.hostId].filter((id) => id && !S.characters[id]).map(() => c.name)));
  check('ขั้นตอนแต่งงานค้างอยู่กับคนที่ไม่ใช่ผู้เล่น', Object.values(S.characters)
    .filter((c) => (c.betrothal || c.eloped || c.service) && c.id !== S.meta.playerCharacterId && isAlive(c)).map((c) => c.name));
  const locals = Object.values(S.characters).filter((c) => c.local && isAlive(c));
  check('คนนอกตระกูลล้น (รู้จักเกินเพดาน)', locals.length > content.balance.locals.maxKnown[1] + 4 ? [`${locals.length} คน`] : []);
  check('คนนอกตระกูลที่มีตระกูล/เรือน', locals.filter((c) => c.dynastyId || c.householdId).map((c) => c.name));
  check('อายุติดลบ', Object.values(S.characters).filter((c) => c.birthDay > S.meta.day).map((c) => c.name));
  check('childIds ชี้ไป node ที่ไม่มี', Object.values(S.familyNodes).flatMap((n) => n.childIds.filter((id) => !S.familyNodes[id])));
  // พี่น้อง/พ่อแม่ลูก หรือคู่ครองของพี่น้องที่ยังมีชีวิต ชื่อซ้ำกัน — อ่านเรื่องไม่รู้เรื่อง (pickName ต้องกันไว้)
  const livingNode = (id: string | null) => {
    const n = id ? S.familyNodes[id as keyof typeof S.familyNodes] : undefined;
    return n && alive(n.characterId) ? n : undefined;
  };
  check('ญาติใกล้ชิดชื่อซ้ำกัน', Object.values(S.familyNodes).flatMap((n) => {
    if (!alive(n.characterId)) return [];
    const kids = n.childIds.map(livingNode).filter((k) => !!k);
    const groups = [kids.map((k) => k!.name), kids.flatMap((k) => k!.spouseIds.map(livingNode).filter((x) => !!x).map((x) => x!.name))];
    const clash = groups.flatMap((g) => g.filter((name, i) => g.indexOf(name) !== i));
    const withParent = kids.filter((k) => k!.name === n.name).map((k) => k!.name);
    return [...clash, ...withParent];
  }));
  check('แผลบนอวัยวะที่ไม่มีแล้ว', Object.values(S.wounds).filter((w) => {
    const ch = S.characters[w.characterId];
    const parts = ch ? content.anatomies[ch.anatomyId]?.parts : undefined;
    for (let p = parts?.[w.partDefId]?.parent ?? null; p && parts; p = parts[p]?.parent ?? null) {
      if (S.bodyParts[`${w.characterId}/${p}` as keyof typeof S.bodyParts]?.status === 'missing') return true;
    }
    return false;
  }).map((w) => w.id));
}

// ---- ตารางชีพของคนในตระกูล (รวมคู่ครองและปู่ย่าตายาย ไม่นับคนนอกซึ่งสุ่มอายุตามวัยผู้เล่น) ----
// รายงานอย่างเดียว ไม่ทำให้ sim:check ล้ม — ใช้วัดว่าระบบเกิด/ตายทำให้กลุ่มอายุสมจริงแค่ไหน
const MAX_AGE = 110;
const exposure = new Array<number>(MAX_AGE + 1).fill(0); // คน-ปี: นับคนที่มีชีวิตตามอายุทุก 1 ม.ค.
const deathsAt = new Array<number>(MAX_AGE + 1).fill(0);
let extinct = 0; // seed ที่ตระกูลสิ้นสายก่อนจบ
// ร่างกายแต่กำเนิดของคนตาย แยกตามอายุที่ตาย [ผลรวม, จำนวน] — คนตายเด็กควรต่ำกว่าคนที่อยู่ถึงแก่
const constitutionAt = { young: [0, 0], old: [0, 0] };
let hardToRaise = 0;
/** event ที่ผู้เล่นเจอใน [1] (นับรวมทุก seed, รวม event ต่อเนื่อง) — ใช้หา event ที่เจอบ่อยสำหรับตัวตรวจตัวเลือกแพ้ขาด [5h3b] */
const seenEvents: Record<string, number> = {};
// ตัวชี้วัดสมดุลฝั่งผู้เล่น (balanceCheck) — เก็บจากการเล่นอัตโนมัติ "เลือกตัวเลือกแรกเสมอ" แบบเดียวกับที่ BACKLOG ใช้วัด
const bal = {
  firstDeathAges: [] as number[], // อายุที่ตัวละครแรกของผู้เล่นตาย (seed ที่ยังไม่ตายจนจบไม่นับ) — ไม่รวมตายตอนกรุงแตก
  firstWarDeaths: 0, // ตัวละครแรกตายหรือถูกกวาดต้อนตอนกรุงแตก 2310 (ผู้เล่นอัตโนมัติไม่เตรียมตัว/หนี จึงเสียหนัก)
  takeoverAges: [] as number[], // อายุของผู้สืบตอนรับช่วงเป็นผู้เล่น
  stress: [0, 0], // [ผลรวม, จำนวน] ความหนักใจของผู้เล่นที่มีชีวิตทุก 1 ม.ค.
  senior: [0, 0], // [ขั้น 2 ขึ้นไป (ขุนขึ้นไป), จำนวน] ผู้เล่นที่มีชีวิต — รายงานเฉยๆ ใช้ดูผลของโหมด invest
  office: [0, 0], // [มีตำแหน่ง, จำนวน] ผู้เล่นที่มีชีวิตทุก 1 ม.ค. ตั้งแต่ OFFICE_FROM_YEAR
  wealthPerHead: [] as number[], // เงินเฉลี่ยต่อคนของคนในตระกูลที่ยังมีชีวิตตอนจบ (seed ที่ไม่สิ้นสาย)
};
const OFFICE_FROM_YEAR = 2370;

/** คนในตระกูลที่ตายวันนี้ — คนที่ตายแล้วถูก prune ทิ้งในวันเดียวกันก็นับ (เก็บ object ไว้เอง) */
function trackDemography(ctx: Ctx, tracked: Map<string, Character>): void {
  const S = ctx.state;
  for (const [id, ch] of tracked) {
    const now = S.characters[id as keyof typeof S.characters];
    if (now && now.deathDay === null) continue;
    tracked.delete(id);
    // แยกไปอยู่ที่อื่นทั้งที่ยังมีชีวิต (prune: driftKinDistance) — หยุดนับ ไม่ใช่ตาย
    if (!now && ch.deathDay === null) continue;
    // ทอยตาย 1 ม.ค. สำหรับปีที่เพิ่งผ่านไป → นับที่อายุของปีนั้น (ให้ตรงกับคน-ปีที่นับต้นปี)
    const age = Math.max(0, Math.min(MAX_AGE, ageOf(ctx, ch, (ch.deathDay ?? S.meta.day) - 1)));
    deathsAt[age]++;
    const bucket = age < 5 ? constitutionAt.young : age >= 50 ? constitutionAt.old : undefined;
    if (bucket) { bucket[0] += ch.constitution ?? 0; bucket[1]++; }
  }
  for (const c of Object.values(S.characters)) if (isAlive(c) && !c.local) tracked.set(c.id, c);
  if (dayOfYear(ctx, S.meta.day) === 0) for (const c of tracked.values()) exposure[Math.min(MAX_AGE, ageOf(ctx, c))]++;
}

/**
 * เป้าเป็นช่วงกว้างๆ ของตารางชีพแบบจำลองสังคมก่อนยุคอุตสาหกรรม (ชีพคาดแรกเกิดราว 25–40 ปี) — ไม่ใช่ข้อมูลอยุธยา
 * ยังไม่มี lore เรื่องอัตราตายสมัยนั้น
 */
function demographyReport(): void {
  const l = [1];
  for (let a = 0; a <= MAX_AGE; a++) {
    const m = exposure[a]! ? deathsAt[a]! / exposure[a]! : 1;
    l.push(l[a]! * Math.exp(-m));
  }
  const e = (x: number) => l.slice(x, -1).reduce((s, v, i) => s + (v + l[x + i + 1]!) / 2, 0) / l[x]!;
  const people = exposure.reduce((a, b) => a + b, 0);
  const share = (lo: number, hi: number) => exposure.slice(lo, hi + 1).reduce((a, b) => a + b, 0) / people;
  let acc = 0;
  const medianAge = exposure.findIndex((n) => (acc += n) >= people / 2);
  const pct = (x: number, unit = true) => `${+(100 * x).toFixed(1)}${unit ? '%' : ''}`;
  const yrs = (x: number, unit = true) => `${+x.toFixed(1)}${unit ? ' ปี' : ''}`;
  const rows: Array<[string, number, number, number, (x: number, unit?: boolean) => string]> = [
    ['ชีพคาดเฉลี่ยแรกเกิด', e(0), 25, 40, yrs],
    ['ตายก่อน 1 ขวบ', 1 - l[1]!, 0.15, 0.3, pct],
    ['รอดถึงอายุ 15', l[15]!, 0.5, 0.7, pct],
    ['ชีพคาดที่อายุ 50', e(50), 12, 20, yrs],
    ['อายุ 50 แล้วอยู่ถึง 70', l[70]! / l[50]!, 0.25, 0.5, pct],
    ['คนที่มีชีวิต อายุ 0–14', share(0, 14), 0.33, 0.42, pct],
    ['คนที่มีชีวิต อายุ 60 ขึ้นไป', share(60, MAX_AGE), 0.04, 0.09, pct],
    ['อายุมัธยฐานของคนที่มีชีวิต', medianAge, 18, 25, yrs],
  ];
  console.log(`ประชากรในตระกูล (${people} คน-ปี · ตาย ${deathsAt.reduce((a, b) => a + b, 0)} คน · สิ้นสาย ${extinct}/${SEEDS} seed) — รายงาน ไม่นับเป็นข้อผิด:`);
  for (const [label, v, lo, hi, f] of rows) {
    console.log(`  ${v >= lo && v <= hi ? '✓' : '⚠'} ${label} ${f(v)} (เป้า ${f(lo, false)}–${f(hi)})`);
  }
  const mean = ([sum, n]: number[]) => (n ? sum! / n : 0).toFixed(2);
  console.log(`  ร่างกายแต่กำเนิดเฉลี่ย: ตายก่อน 5 ขวบ ${mean(constitutionAt.young)} · ตายอายุ 50 ขึ้นไป ${mean(constitutionAt.old)} · event เด็กเลี้ยงยาก ${hardToRaise} ครั้ง`);
}

// event ที่ส่งถึงผู้เล่นต้องเกิดในที่ที่ actor อยู่ (whereabouts.ts, trigger.at) — ตรวจหลังรันโลก ([5h4h])
const misplaced = new Map<string, number>();
const awayEvents = { army: 0, temple: 0 };
const checkWhereabouts = (ctx: Ctx, signals: ReturnType<typeof advanceDay>) => {
  for (const sig of signals) {
    if (sig.type !== 'event' && sig.type !== 'habit') continue;
    const actor = ctx.state.characters[sig.prepared.instance.bindings.actor ?? ''];
    if (!actor || !isAlive(actor)) continue;
    const where = whereabouts(ctx, actor);
    if (where !== 'home') awayEvents[where]++;
    if (!allowedAt(sig.prepared.def, where)) misplaced.set(`${sig.prepared.def.id}@${where}`, (misplaced.get(`${sig.prepared.def.id}@${where}`) ?? 0) + 1);
  }
};

// [1] รันโลก
for (let seed = 1; seed <= SEEDS; seed++) {
  const ctx = makeCtx(emptyState(seed), content);
  bootstrapScenario(ctx);
  const S = ctx.state;
  const tracked = new Map<string, Character>();
  trackDemography(ctx, tracked);
  let over = false;
  const heroId = S.meta.playerCharacterId;
  if (LONG) S.meta.endYear = LONG_END_YEAR;
  // เล่นจนถึงปีจบของเรื่อง (meta.endYear) แบบเดียวกับ worker — ถึงวันนั้นยังเดินรอบประจำปีครบ
  const endDay = yearStart(ctx, S.meta.endYear!);
  while (S.meta.day < endDay && !over) {
    // กลางปี: ผู้เล่นที่ว่างอยู่ตั้งใจทำอะไรสักอย่างกับคนที่รู้จัก (สุ่มคน/สิ่งที่ตั้งใจ/วิธี) — ทดสอบระบบ intent
    const player = S.characters[S.meta.playerCharacterId];
    if (dayOfYear(ctx, S.meta.day) === 180 && isAlive(player) && !activeIntent(ctx, player.id) && ctx.rng.chance(0.6)) {
      const options = knownLocals(ctx, player).flatMap((t) => Object.values(content.intents)
        .filter((def) => !targetProblem(ctx, def, player, t))
        .flatMap((def) => planIntent(ctx, def.id, player, t).filter((p) => !p.unavailable).map((p) => ({ def, t, p }))));
      const pick = ctx.rng.pick(options);
      if (pick) startIntent(ctx, pick.def.id, player, pick.t, pick.p.def.id);
    }
    // โหมด invest (npm run sim:check -- 30 invest): ผู้เล่นฝึกวิชาสายของกรมต่อเนื่องและปลดล็อกทุกครั้งที่แต้มครบ — ไว้วัดว่าวิชาทำให้เลื่อนยศเร็วเกินไปไหม
    if (INVEST && isAlive(player) && ageOf(ctx, player) >= 12 && dayOfYear(ctx, S.meta.day) % 30 === 0) {
      const track = careerSkill(ctx, player).track.id;
      if (player.focus !== track) setSkillFocus(ctx, player, track);
      try { unlockNextPerk(player, track); } catch { /* แต้มยังไม่ครบหรือครบทุกขั้นแล้ว */ }
    }
    if (LONG && dayOfYear(ctx, S.meta.day) === 0 && longSamples[yearOf(ctx, S.meta.day)]) {
      const sample = longSamples[yearOf(ctx, S.meta.day)]!;
      const family = Object.values(S.characters).filter((c) => c.dynastyId === S.meta.playerDynastyId && isAlive(c));
      if (family.length) {
        sample.wealth.push(family.reduce((a, c) => a + c.social.wealth, 0) / family.length);
        sample.family.push(family.length);
        sample.alive++;
      }
    }
    const signals = advanceDay(ctx);
    checkWhereabouts(ctx, signals);
    // event ที่ส่งถึงผู้เล่นต้องอ้างถึงตัวละครที่ยังอยู่ในโลก — ไม่งั้นข้อความขึ้นชื่อ role ดิบ (เช่น "แต่งกับspouse")
    for (const sig of signals) {
      if (sig.type !== 'event') continue;
      for (const [role, id] of Object.entries(sig.prepared.instance.bindings)) {
        if (!S.characters[id]) throw new Error(`seed ${seed}: event ${sig.prepared.def.id} อ้าง ${role} (${id}) ที่ถูกลบจากโลกไปแล้ว`);
      }
    }
    for (const sig of signals) {
      if (sig.type === 'event') {
        // เลือกตัวเลือกแรกที่ไม่ล็อก แล้วเล่น event ต่อเนื่อง (followUp) จนจบสาย
        if (sig.prepared.def.id === 'family.hard_to_raise') hardToRaise++;
        for (let p: PreparedEvent | null = sig.prepared; p; ) {
          const opt = p.options.find((o) => !p!.locked.has(o.id));
          if (!opt) throw new Error(`seed ${seed}: event ${p.def.id} ไม่มีตัวเลือกที่เลือกได้`);
          seenEvents[p.def.id] = (seenEvents[p.def.id] ?? 0) + 1;
          p = prepareFollowUp(ctx, p, chooseOption(ctx, p, opt.id));
        }
      } else if (sig.type === 'playerDied') {
        const dead = S.characters[S.meta.playerCharacterId]!;
        if (dead.id === heroId) {
          if (dead.deathCause === 'history:fall_of_ayutthaya' || dead.deathCause === 'history:captive_after_fall') bal.firstWarDeaths++;
          else bal.firstDeathAges.push(ageOf(ctx, dead, dead.deathDay ?? S.meta.day));
        }
        if (!heirCandidates(ctx, dead).length) {
          over = true;
          break;
        }
        performHandover(ctx, dead.id);
        bal.takeoverAges.push(ageOf(ctx, S.characters[S.meta.playerCharacterId]!));
      }
    }
    // ผู้เล่นตายจากตัวเลือก event ในวันสุดท้ายของเรื่อง — ไม่มี signal playerDied รอบหน้าเพราะเกมจบ ต้องส่งต่อตรงนี้ ไม่งั้น invariant เห็นผู้นำตายค้าง
    const last = S.characters[S.meta.playerCharacterId];
    if (!over && S.meta.day >= endDay && last && !isAlive(last)) {
      if (!heirCandidates(ctx, last).length) over = true;
      else performHandover(ctx, last.id);
    }
    trackDemography(ctx, tracked);
    const me = S.characters[S.meta.playerCharacterId];
    if (dayOfYear(ctx, S.meta.day) === 0 && isAlive(me)) {
      bal.stress[0]! += me.stress;
      bal.stress[1]!++;
      if (yearOf(ctx, S.meta.day) >= OFFICE_FROM_YEAR) {
        bal.senior[0]! += (officeRank(ctx, me) ?? 0) >= 2 ? 1 : 0;
        bal.senior[1]!++;
        bal.office[0]! += me.office ? 1 : 0;
        bal.office[1]!++;
      }
    }
  }
  if (over) extinct++;
  else {
    const family = Object.values(S.characters).filter((c) => c.dynastyId === S.meta.playerDynastyId && isAlive(c));
    if (family.length) bal.wealthPerHead.push(family.reduce((a, c) => a + c.social.wealth, 0) / family.length);
  }
  const before = failed;
  console.log(`seed ${seed}: ถึงปี ${yearOf(ctx, S.meta.day)}${over ? ' (สิ้นสาย)' : ''}`
    + ` · ตัวละคร ${Object.keys(S.characters).length} · node ${Object.keys(S.familyNodes).length}`
    + ` · เซฟ ${(JSON.stringify(S).length / 1024).toFixed(0)} KB`);
  invariants(ctx, over);
  if (!over) check('ไม่ถึงปีจบของเรื่อง', yearOf(ctx, S.meta.day) === S.meta.endYear ? [] : [`หยุดที่ ${yearOf(ctx, S.meta.day)}`]);
  if (failed === before) console.log(over ? '  ✓ invariant ครบ (ข้ามข้อมรดกเพราะเกมจบ)' : '  ✓ invariant ครบ');
}
demographyReport();

/**
 * ตัวเลขสมดุลของผู้เล่น — ช่วงกว้างพอที่ความสุ่มของ 30 seed ไม่ทำให้ล้ม แต่จับการเปลี่ยนที่เกินปกติเมื่อปรับ rules/balance.json
 * (ช่วงตั้งจากค่าที่วัดได้ ณ 2026-11-02 — ปรับช่วงได้เมื่อตั้งใจเปลี่ยนสมดุล แล้วจดเหตุผลใน BACKLOG)
 * ตัวอย่างน้อย (SEEDS < BALANCE_MIN_SEEDS) แสดงเป็นรายงานเฉยๆ ไม่นับเป็นข้อผิด
 */
const BALANCE_MIN_SEEDS = 20;
function balanceCheck(): void {
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN;
  const ratio = ([n, d]: number[]) => (d ? n! / d! : NaN);
  const rows: Array<[string, number, number, number]> = [
    // ไม่รวมตายตอนกรุงแตก (แยกวัดด้านล่าง): ศึก 2308–2310 ตั้งใจให้เสี่ยงหนักสำหรับคนไม่เตรียมตัว (design-war-2308 ข้อ 8.4)
    ['ตัวละครแรกตายก่อนอายุ 30 (ไม่นับกรุงแตก)', bal.firstDeathAges.filter((a) => a < 30).length / SEEDS, 0, 0.35],
    // ผู้เล่นอัตโนมัติเลือกตัวเลือกแรก (ปักหลัก ไม่ฝังทรัพย์) = กรณีเลวร้ายที่สุดของคนในกรุง ~57%; เพดานกันศึกโหดเกินเป้า
    ['ตัวละครแรกตายหรือถูกกวาดต้อนตอนกรุงแตก', bal.firstWarDeaths / SEEDS, 0, 0.7],
    // 30 seed แกว่ง ±8 จุด รอบค่าจริงราว 25% — เพดาน 0.3 กันล้มเพราะดวง เป้าจริง ≤ 25% อยู่ที่ประตู sim:policy n ≥ 150 (PLAN ข้อ 9, 2026-11-05)
    ['ตระกูลสิ้นสายก่อนจบเรื่อง', extinct / SEEDS, 0, 0.3],
    ['อายุมัธยฐานของผู้สืบตอนรับช่วง', median(bal.takeoverAges), 25, 60],
    ['ความหนักใจเฉลี่ยของผู้เล่น', ratio(bal.stress), 0.05, 0.35],
    [`ผู้เล่นมีตำแหน่งราชการ (ตั้งแต่ พ.ศ. ${OFFICE_FROM_YEAR})`, ratio(bal.office), 0.15, 0.6],
    ['เงินเฉลี่ยต่อคนในตระกูลตอนจบ (ตำลึง)', median(bal.wealthPerHead), 10, 150],
  ];
  const enforce = SEEDS >= BALANCE_MIN_SEEDS && !INVEST && !LONG; // โหมด invest เป็นการทดลอง ไม่นับเป็นข้อผิด
  console.log(`สมดุลของผู้เล่น (${SEEDS} seed${enforce ? '' : INVEST ? ' — โหมด invest เป็นรายงานเฉยๆ' : ` — น้อยกว่า ${BALANCE_MIN_SEEDS} จึงเป็นรายงานเฉยๆ`}):`);
  const bad: string[] = [];
  for (const [label, v, lo, hi] of rows) {
    const ok = v >= lo && v <= hi; // NaN = ไม่มีข้อมูล ถือว่าไม่ผ่าน
    console.log(`  ${ok ? '✓' : enforce ? '✗' : '⚠'} ${label} ${+v.toFixed(3)} (ช่วงที่ยอมรับ ${lo}–${hi})`);
    if (!ok) bad.push(`${label} ${+v.toFixed(3)}`);
  }
  console.log(`  · ผู้เล่นถึงขั้นขุนขึ้นไป (ตั้งแต่ พ.ศ. ${OFFICE_FROM_YEAR}) ${+ratio(bal.senior).toFixed(3)}${INVEST ? ' [โหมด invest]' : ''}`);
  // โทษขุนนาง (docs/design-official-punishment.md) — ดูว่าภาคทัณฑ์/ถูกถอดครั้งที่ห้าเกิดบ่อยแค่ไหนในการเล่นจริง
  console.log(`  · โทษขุนนางใน ${SEEDS} เกม (เลื่อนยศ ${seenEvents['career.promotion'] ?? 0} ครั้ง): ภาคทัณฑ์ ${seenEvents['career.probation'] ?? 0} · ถูกฟ้อง ${seenEvents['career.punished'] ?? 0} · มหาดเล็กต้องพระราชอาญา ${seenEvents['career.punished_page'] ?? 0} · ถูกถอดครั้งที่ห้า ${seenEvents['career.removed'] ?? 0}`);
  if (enforce) check('สมดุลของผู้เล่นหลุดช่วง', bad);
}
balanceCheck();
if (LONG) {
  console.log(`รายงานเล่นยาวถึง ${LONG_END_YEAR} (${SEEDS} seed):`);
  for (const [year, v] of Object.entries(longSamples)) {
    const med = (a: number[]) => (a.length ? +[...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!.toFixed(1) : NaN);
    console.log(`  พ.ศ. ${year}: ตระกูลยังอยู่ ${v.alive}/${SEEDS} · เงินต่อคน มัธยฐาน ${med(v.wealth)} สูงสุด ${v.wealth.length ? Math.round(Math.max(...v.wealth)) : NaN} · คนในตระกูล มัธยฐาน ${med(v.family)}`);
  }
}

// [2] ผู้เล่นตายก่อนผู้นำตระกูล (บิดา) → ผู้นำ หัวเรือน และกฎในเรือนของบิดาต้องไม่เปลี่ยน
{
  const ctx = makeCtx(emptyState(7), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(25);
  const dyn = S.dynasties[S.meta.playerDynastyId]!;
  const headNodeBefore = dyn.headNodeId;
  const head = S.characters[S.familyNodes[headNodeBefore]!.characterId!]!;
  const hh = S.households[head.householdId!]!;
  hh.rules.push({
    id: 'rule_check', kind: 'ban', target: 'food:pumpkin', sinceDay: 0, imposedBy: head.id,
    originTraitId: null, statedReason: 'inauspicious',
  });
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2290, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, hero, wife);
  spawnCharacter(ctx, { name: 'บุตร', sex: 'm', birthYear: 2310, estate: 'noble', father: hero, mother: wife });
  markDead(ctx, hero, 'situation:old_age');
  performHandover(ctx, hero.id);
  const problems: string[] = [];
  if (dyn.headNodeId !== headNodeBefore) problems.push('ผู้นำตระกูลเปลี่ยนมือ');
  if (S.households[hh.id]?.headId !== head.id) problems.push('หัวเรือนเปลี่ยน');
  if (!S.households[hh.id]?.rules.some((r) => r.id === 'rule_check')) problems.push('กฎในเรือนของผู้นำหาย');
  const before = failed;
  console.log('ผู้เล่นตายก่อนบิดา:');
  check('handover แตะตำแหน่งของคนที่ยังมีชีวิต', problems);
  if (failed === before) console.log('  ✓ ผู้นำ หัวเรือน และกฎในเรือนคงเดิม');
}

// [3] ผู้เล่นไม่มีบุตร → พี่น้องสืบตำแหน่งและได้มรดกในฐานะญาติ (ไม่ตกเป็นของหลวง)
{
  const ctx = makeCtx(emptyState(11), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(25);
  const dyn = S.dynasties[S.meta.playerDynastyId]!;
  const heroNode = S.familyNodes[hero.familyNodeId]!;
  const father = S.characters[S.familyNodes[heroNode.fatherId!]!.characterId!]!;
  const sibling = Object.values(S.characters).find((c) => c !== hero && S.familyNodes[c.familyNodeId]?.fatherId === heroNode.fatherId)!;
  markDead(ctx, father, 'situation:old_age');
  performHandover(ctx, father.id, hero.id, { asPlayer: false });
  hero.social.wealth = 100;
  markDead(ctx, hero, 'situation:old_age');
  const problems: string[] = [];
  if (heirCandidates(ctx, hero)[0]?.ch.id !== sibling.id) problems.push(`ผู้สืบคนแรกคือ ${heirCandidates(ctx, hero)[0]?.ch.name ?? 'ไม่มี'} ไม่ใช่พี่น้อง`);
  const heirs = estateHeirs(ctx, hero);
  if (heirs.find((h) => h.ch.id === sibling.id)?.relation !== 'fullSibling') problems.push('พี่น้องไม่อยู่ในผู้รับมรดกฐานะพี่น้องร่วมบิดามารดา');
  // งานศพคิดจากทรัพย์ทั้งหมด อาจกินเงินสดหมด → นับทั้งเงินและของที่ได้
  const worth = (c: Character) => c.social.wealth + Object.values(S.items).filter((i) => i.ownerCharacterId === c.id).reduce((a, i) => a + i.value, 0);
  const before = worth(sibling);
  performHandover(ctx, hero.id);
  if (S.meta.playerCharacterId !== sibling.id) problems.push('ผู้เล่นไม่ได้สลับไปเป็นพี่น้อง');
  if (dyn.headNodeId !== sibling.familyNodeId) problems.push('ผู้นำตระกูลไม่ได้ไปที่พี่น้อง');
  if (worth(sibling) <= before) problems.push('พี่น้องไม่ได้มรดก');
  const b = failed;
  console.log('ผู้เล่นไม่มีบุตร:');
  check('ญาติสืบแทน', problems);
  if (failed === b) console.log(`  ✓ ${sibling.name} สืบตำแหน่งและได้มรดกร่วมกับญาติอีก ${heirs.length - 1} คน`);
}

// [4] บุตรตายก่อน → หลานเป็นผู้สืบก่อนพี่น้อง และได้มรดกในฐานะหลาน
{
  const ctx = makeCtx(emptyState(12), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(60);
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2288, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, hero, wife);
  const son = spawnCharacter(ctx, { name: 'ลูกชาย', sex: 'm', birthYear: 2310, estate: 'noble', father: hero, mother: wife });
  const sonWife = spawnCharacter(ctx, { name: 'สะใภ้', sex: 'f', birthYear: 2312, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, son, sonWife);
  const grandson = spawnCharacter(ctx, { name: 'หลานชาย', sex: 'm', birthYear: 2328, estate: 'noble', father: son, mother: sonWife });
  markDead(ctx, son, 'situation:old_age');
  markDead(ctx, hero, 'situation:old_age');
  const problems: string[] = [];
  if (heirCandidates(ctx, hero)[0]?.ch.id !== grandson.id) problems.push('ผู้สืบคนแรกไม่ใช่หลาน');
  if (!estateHeirs(ctx, hero).some((h) => h.ch.id === grandson.id && h.relation === 'grandchild')) problems.push('หลานไม่อยู่ในผู้รับมรดก');
  const b = failed;
  console.log('บุตรตายก่อน:');
  check('หลานรับแทน', problems);
  if (failed === b) console.log('  ✓ หลานเป็นผู้สืบและได้ส่วนมรดก');
}

// [5] ลูกที่ไม่ได้รักษาไข้พ่อไม่ได้ส่วนมรดก (ม.๒๙) — ติดราชการได้รับยกเว้น (lore: social.nursing_cremation_condition)
{
  const ctx = makeCtx(emptyState(13), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(20);
  const heroNode = S.familyNodes[hero.familyNodeId]!;
  const father = S.characters[S.familyNodes[heroNode.fatherId!]!.characterId!]!;
  const sibling = Object.values(S.characters).find((c) => c !== hero && S.familyNodes[c.familyNodeId]?.fatherId === heroNode.fatherId)!;
  const weightOf = (c: Character) => estateHeirs(ctx, father).find((h) => h.ch.id === c.id)?.weight ?? 0;
  const before = weightOf(hero);
  markNursing(ctx, hero, father, true);
  const problems: string[] = [];
  if (before <= 0) problems.push('ก่อนไม่รักษาไข้ไม่มีส่วนมรดกอยู่แล้ว');
  if (weightOf(hero) !== 0) problems.push(`น้ำหนักมรดก ${before} → ${weightOf(hero)} ยังได้ส่วน`);
  if (weightOf(sibling) !== before) problems.push('พี่น้องที่รักษาไข้เสียส่วนไปด้วย');
  sibling.office = { postId: 'muen', deptId: 'patrol', sinceDay: S.meta.day, favor: 0 };
  markNursing(ctx, sibling, father, true);
  if (weightOf(sibling) !== before) problems.push('ติดราชการแต่ยังเสียส่วน');
  const b = failed;
  console.log('ไม่ได้รักษาไข้:');
  check('ไม่ได้ส่วนมรดก', problems);
  if (failed === b) console.log('  ✓ ไม่ได้รักษาไข้ไม่ได้ส่วน ติดราชการได้เต็มส่วน');
}

// [5b] ผู้เล่นเป็นฝ่ายหญิง → บ้านชายเป็นฝ่ายออกเงิน สินสอดเข้าบ้านเจ้าสาว หนีตามกันแล้วชายช่วยออกค่าน้ำนมกึ่งหนึ่ง
{
  const ctx = makeCtx(emptyState(17), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(25);
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2290, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, hero, wife);
  const year = yearOf(ctx, S.meta.day);
  const daughter = (name: string, wealth: number) => spawnCharacter(ctx, {
    name, sex: 'f', birthYear: year - 18, estate: 'noble', father: hero, mother: wife, householdId: hero.householdId, wealth,
  });
  const suitor = (name: string) => spawnCharacter(ctx, { name, sex: 'm', birthYear: year - 22, estate: 'noble', dynastyId: null, householdId: null, wealth: 0 });
  const sum = (cs: Character[]) => [...new Set(cs)].reduce((a, c) => a + c.social.wealth, 0);
  const problems: string[] = [];

  const bride = daughter('ลูกสาวหนึ่ง', 0);
  const groom = suitor('เจ้าบ่าว');
  const household = () => [bride, hero, wife, S.characters[S.households[hero.householdId!]!.headId]!];
  const before = sum(household());
  applyMarriageStep(ctx, 'betroth', bride, groom);
  const sinsot = bride.betrothal?.sinsot ?? 0;
  if (!sinsot) problems.push('หมั้นแล้วไม่มีสินสอด');
  applyMarriageStep(ctx, 'wed', bride, groom);
  if (!S.familyNodes[bride.familyNodeId]!.spouseIds.length) problems.push('แต่งแล้วไม่เป็นผัวเมีย');
  if (Math.round(sum(household()) - before) !== sinsot) problems.push(`สินสอด ${sinsot} แต่บ้านเจ้าสาวได้ ${Math.round(sum(household()) - before)}`);

  const runaway = daughter('ลูกสาวสอง', 10);
  const lover = suitor('คนรัก');
  applyMarriageStep(ctx, 'elope', runaway, lover);
  const claim = runaway.eloped?.amount ?? 0;
  const parentsBefore = hero.social.wealth;
  applyMarriageStep(ctx, 'settleElope', runaway, lover);
  const his = Math.round(claim / 2);
  const hers = Math.min(claim - his, 10);
  if (runaway.social.wealth !== 10 - hers) problems.push(`ลูกสาวออก ${10 - runaway.social.wealth} ไม่ใช่ ${hers}`);
  if (hero.social.wealth - parentsBefore !== his + hers) problems.push(`พ่อได้ ${hero.social.wealth - parentsBefore} ไม่ใช่ ${his + hers}`);
  if (lover.social.wealth !== 0) problems.push('เงินของชายถูกหักทั้งที่บ้านเขาอยู่นอกฉาก');

  for (const id of ['marriage.refused_f', 'marriage.wedding_f', 'marriage.milk_claim_f']) if (!content.events[id]) problems.push(`ไม่มี event ${id}`);
  const local = spawnLocal(ctx, bride, { sex: 'm', age: 20, distance: 'near', trade: content.trades[0]!, single: true });
  const serve = planIntent(ctx, 'court', runaway, local).find((p) => p.def.id === 'serve');
  if (serve?.unavailable !== 'sex') problems.push('หญิงยังไปช่วยงานบ้านชายเพื่อเกี้ยวได้');

  const b = failed;
  console.log('ผู้เล่นเป็นฝ่ายหญิง:');
  check('ระบบแต่งงานฝั่งเจ้าสาว', problems);
  if (failed === b) console.log('  ✓ สินสอดเข้าบ้านเจ้าสาว ค่าน้ำนมแบ่งกึ่งหนึ่ง ไม่ต้องไปช่วยงานบ้านชาย');
}

// [5c] ตัวเลือกเสี่ยง: ทุก risk มีข้อความครบ, ทอยแล้วพลาดราวโอกาสที่บอก และพลาดแล้วได้ผลชุด fail
{
  const before = failed;
  console.log('ตัวเลือกเสี่ยง:');
  const text = load('text.th.json') as Record<string, string>;
  check('ข้อความของ risk', Object.values(content.events).flatMap((d) => d.options.flatMap((o) => {
    if (!o.risk) return [];
    const keys = [o.risk.hintKey, o.risk.fail.textKey, ...(o.risk.successKey ? [o.risk.successKey] : [])];
    return keys.filter((k) => !text[k]).map((k) => `${d.id}.${o.id}: ไม่มี ${k}`);
  })));
  const ctx = makeCtx(emptyState(23), content);
  const hero = bootstrapScenario(ctx);
  ctx.state.meta.day += yearsToDays(10);
  let fails = 0;
  let expected = 0;
  const problems: string[] = [];
  const N = 400;
  for (let i = 0; i < N; i++) {
    const p = prepareEvent(ctx, 'festival.holy_day', { actor: hero.id }, { moon: 'moon:full' });
    p.locked.clear();
    const opt = p.options.find((o) => o.id === 'fish')!;
    expected += riskChance(ctx, hero, opt.risk!, () => undefined);
    const stress = hero.stress = 0.5;
    const r = chooseOption(ctx, p, 'fish');
    if (r.outcome?.failed) fails++;
    if (r.outcome?.failed !== hero.stress > stress) problems.push(`ผล ${r.outcome?.failed ? 'พลาด' : 'สำเร็จ'} แต่ความหนักใจ ${stress} → ${hero.stress}`);
  }
  if (Math.abs(fails - expected) > N * 0.08) problems.push(`พลาด ${fails}/${N} ครั้ง แต่คาดไว้ราว ${Math.round(expected)}`);
  check('ทอยตัวเลือกเสี่ยง', problems.slice(0, 3));
  if (failed === before) console.log(`  ✓ ข้อความครบ · พลาด ${fails}/${N} (คาดไว้ ${Math.round(expected)}) · ผลตรงกับที่ทอยได้`);
}

// [5d] งานบุญทำตามนิสัย และใจ/บุญของญาติขยับเองทุกปี
{
  const before = failed;
  console.log('นิสัยและญาติ:');
  const ctx = makeCtx(emptyState(29), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(8);
  const holy = () => prepareEvent(ctx, 'festival.holy_day', { actor: hero.id }, { moon: 'moon:full' });
  const problems: string[] = [];
  const first = holy();
  if (habitOption(ctx, hero, first)) problems.push('ยังไม่เคยเลือกก็ทำตามนิสัยแล้ว');
  chooseOption(ctx, first, 'temple');
  chooseOption(ctx, holy(), 'temple');
  if (habitOption(ctx, hero, holy()) !== 'temple') problems.push('เลือกไปวัดสองครั้งแล้วยังถามอีก');
  S.meta.day += yearsToDays(content.balance.festivals.habitYears) + 1;
  if (habitOption(ctx, hero, holy())) problems.push('ครบปีแล้วไม่ถามใหม่');
  const mom = S.characters[S.familyNodes[S.familyNodes[hero.familyNodeId]!.motherId!]!.characterId!]!;
  const bathing = () => prepareEvent(ctx, 'festival.bathing', { actor: hero.id, parent: mom.id });
  chooseOption(ctx, bathing(), 'bathe');
  chooseOption(ctx, bathing(), 'bathe');
  const dad = S.characters[S.familyNodes[S.familyNodes[hero.familyNodeId]!.fatherId!]!.characterId!]!;
  if (habitOption(ctx, hero, prepareEvent(ctx, 'festival.bathing', { actor: hero.id, parent: dad.id })))
    problems.push('รดน้ำคนละคนกับที่เคย แต่ไม่ถาม');
  check('นิสัยงานบุญ', problems);

  const kin: string[] = [];
  mom.personality.piety = 0.8;
  mom.stress = 0.8;
  const merit0 = mom.merit;
  kinYearTick(ctx);
  if (!(mom.merit > merit0)) kin.push('ญาติไม่ได้บุญเลยทั้งปี');
  if (!(mom.stress < 0.8)) kin.push('ความหนักใจไม่คลายลง');
  const calm = mom.stress;
  markDead(ctx, dad, 'situation:old_age');
  kinYearTick(ctx);
  if (!(mom.stress > calm)) kin.push('ผัวตายแล้วไม่หนักใจขึ้น');
  check('ญาติขยับเองรายปี', kin);
  if (failed === before) console.log('  ✓ เลือกแบบเดิมสองครั้งแล้วทำเอง ครบปีหรือเปลี่ยนคนถามใหม่ · ญาติได้บุญ หายหนักใจ และเศร้าเมื่อคนใกล้ชิดตาย');
}

// [5e] สายเรื่องวัด: ไปวัดสองวันพระ → ไหว้ผู้ใหญ่ (ครั้งเดียว) → ผู้ใหญ่แวะมาถามข่าว (ครั้งเดียวต่อคน)
{
  const before = failed;
  console.log('สายเรื่องวัด:');
  const ctx = makeCtx(emptyState(31), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(2);
  const mom = S.characters[S.familyNodes[S.familyNodes[hero.familyNodeId]!.motherId!]!.characterId!]!;
  const greet = content.events['temple.elder']!;
  const visit = content.events['temple.elder_visit']!;
  const elder = spawnLocal(ctx, hero, { sex: 'f', age: 65, distance: 'near' });
  const gb = { actor: hero.id, caregiver: mom.id, elder: elder.id };
  const problems: string[] = [];
  if (requirementsMet(ctx, greet, hero, gb)) problems.push('ยังไม่เคยไปวัดก็ไหว้ผู้ใหญ่แล้ว');
  for (let i = 0; i < 2; i++) chooseOption(ctx, prepareEvent(ctx, 'festival.holy_day', { actor: hero.id }, { moon: 'moon:full' }), 'temple');
  if (!requirementsMet(ctx, greet, hero, gb)) problems.push('ไปวัดสองครั้งแล้วยังไม่ถึงคิวไหว้ผู้ใหญ่');
  chooseOption(ctx, prepareEvent(ctx, 'temple.elder', gb), 'polite');
  if (requirementsMet(ctx, greet, hero, gb)) problems.push('ไหว้ผู้ใหญ่ซ้ำได้อีก');
  const vb = { actor: hero.id, elder: elder.id };
  if (!requirementsMet(ctx, visit, hero, vb)) problems.push('ไหว้แล้วผู้ใหญ่ไม่มีทางแวะมา');
  chooseOption(ctx, prepareEvent(ctx, 'temple.elder_visit', vb), 'host');
  if (requirementsMet(ctx, visit, hero, vb)) problems.push('ผู้ใหญ่คนเดิมแวะมาซ้ำได้');
  const other = spawnLocal(ctx, hero, { sex: 'm', age: 70, distance: 'near' });
  if (requirementsMet(ctx, visit, hero, { actor: hero.id, elder: other.id })) problems.push('ผู้ใหญ่ที่ไม่เคยไหว้ที่วัดก็แวะมาในฐานะคนที่เคยไหว้');
  check('เงื่อนไขสายเรื่อง', problems);
  if (failed === before) console.log('  ✓ ไปวัดสองครั้ง → ไหว้ผู้ใหญ่ครั้งเดียว → ผู้ใหญ่คนนั้นแวะมาครั้งเดียว');
}

// [5f] รายชื่อบ่าวในเรือนเป็นเมียน้อย, ปลูกเรือนแยกครั้งเดียวต่อคน และโหมงานตอนใจหนักมีโอกาสล้มป่วย
{
  const before = failed;
  console.log('เมียบ่าว ปลูกเรือนแยก และโหมงาน:');
  const ctx = makeCtx(emptyState(37), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(20);
  const hh = S.households[hero.householdId!]!;
  hh.headId = hero.id;
  hh.retainers = { that: 3, phrai: 2, loyalty: 0.6 };
  const wife = spawnCharacter(ctx, { name: 'เมียหลวง', sex: 'f', birthYear: yearOf(ctx, S.meta.day) - 20, estate: 'noble', dynastyId: null, householdId: hero.householdId });
  marry(ctx, hero, wife);
  const problems: string[] = [];

  const cands = findSlaveConcubines(ctx, hero);
  if (cands.length !== 3) problems.push(`มีทาส 3 คน แต่ได้รายชื่อ ${cands.length} คน`);
  const picked = cands[1]!;
  takeSlaveConcubine(ctx, hero, picked);
  dropMatches(ctx, hero, cands.map((c) => c.id), picked.id);
  if (hh.retainers.that !== 2) problems.push(`รับเมียบ่าวแล้วทาสเหลือ ${hh.retainers.that} คน`);
  if (!livingWives(ctx, hero).some((w) => w.id === picked.id && w.wifeRank === 'minor')) problems.push('คนที่เลือกไม่ได้เป็นเมียน้อย');
  if (S.characters[cands[0]!.id] || S.characters[cands[2]!.id]) problems.push('บ่าวที่ไม่ได้เลือกยังค้างอยู่ใน state');

  hero.social.wealth = 50;
  const j1 = prepareEvent(ctx, 'marriage.wife_jealousy_slave', { actor: hero.id, spouse: wife.id, other: picked.id });
  if (!j1.options.some((o) => o.id === 'separate')) problems.push('ยังไม่เคยปลูกเรือนแยกแต่ไม่มีตัวเลือก');
  chooseOption(ctx, j1, 'separate');
  const j2 = prepareEvent(ctx, 'marriage.wife_jealousy_slave', { actor: hero.id, spouse: wife.id, other: picked.id });
  if (j2.options.some((o) => o.id === 'separate')) problems.push('ปลูกเรือนแยกให้เมียน้อยคนนี้ไปแล้วแต่ยังกดซ้ำได้');
  const j3 = prepareEvent(ctx, 'marriage.wife_jealousy', { actor: hero.id, spouse: wife.id, other: picked.id });
  if (j3.options.some((o) => o.id === 'separate')) problems.push('พ้นทาสแล้วยังกดปลูกเรือนแยกซ้ำได้อีก');
  for (let i = 0; i < 20; i++) {
    if (jealousyEvent(ctx)) problems.push('เมียน้อยคนเดิมเกิดเรื่องเมียหลวงกีดกันซ้ำอีก');
  }

  hero.stress = 0.6;
  const hhEv = prepareEvent(ctx, 'adult.heavy_heart', { actor: hero.id });
  const workOpt = hhEv.options.find((o) => o.id === 'work');
  if (!workOpt?.risk) problems.push('ตัวเลือกโหมงานตอนใจหนักไม่มีความเสี่ยง');
  let workFailed = false;
  for (let i = 0; i < 30; i++) {
    hero.stress = 0.6;
    const p = prepareEvent(ctx, 'adult.heavy_heart', { actor: hero.id });
    const r = chooseOption(ctx, p, 'work');
    if (r.outcome?.failed && hero.stress > 0.6) workFailed = true;
  }
  if (!workFailed) problems.push('โหมงานตอนใจหนักไม่เคยเกิดผลเสียเลย');

  check('เมียบ่าว ปลูกเรือนแยก และโหมงาน', problems);
  if (failed === before) console.log('  ✓ เลือกเมียบ่าวจากรายชื่อได้ · ปลูกเรือนแยกขึ้นครั้งเดียวต่อคน · โหมงานตอนใจหนักมีโอกาสพลาดเสียสุขภาพและงาน');
}

// [5g] ไปค้างเรือนเมีย: ครั้งแรกมีฉาก ครั้งต่อไปขึ้นเฉพาะเมื่อนางน้อยใจหรือท้องแก่; เกี้ยวเมียน้อย; ช่วยคนตกน้ำ
{
  const before = failed;
  console.log('ไปค้างเรือนเมีย เกี้ยวเมียน้อย ช่วยคนตกน้ำ:');
  const ctx = makeCtx(emptyState(41), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(20);
  hero.social.wealth = 200;
  const mk = (name: string) => spawnCharacter(ctx, { name, sex: 'f', birthYear: yearOf(ctx, S.meta.day) - 22, estate: 'noble', dynastyId: null, householdId: hero.householdId });
  const principal = mk('เมียหลวง');
  marry(ctx, hero, principal);
  const minor = mk('เมียน้อย');
  takeMinorWife(ctx, hero, minor);
  const problems: string[] = [];
  const setAff = (w: Character, v: number) => setRelation(ctx, w.id, hero.id, 'affection', v);
  const sceneOf = (r: ReturnType<typeof performInteraction>) => ('event' in r ? r.event.def.id : null);
  const again = (w: Character) => {
    S.meta.day += 61;
    return performInteraction(ctx, hero, w, 'visit');
  };

  // ครั้งแรกของแต่ละนาง → ฉากแรก (ทั้งเมียหลวงและเมียน้อย)
  if (sceneOf(performInteraction(ctx, hero, principal, 'visit')) !== 'marriage.visit_first') problems.push('ไปเรือนเมียหลวงครั้งแรกไม่มีฉาก');
  if (sceneOf(performInteraction(ctx, hero, minor, 'visit')) !== 'marriage.visit_first') problems.push('ไปเรือนเมียน้อยครั้งแรกไม่มีฉาก');
  // ครั้งต่อไป ปกติไม่มีฉาก
  setAff(principal, 0.6);
  if (sceneOf(again(principal))) problems.push('ไปค้างครั้งที่สองตอนนางสบายดีแต่มีฉาก');
  // น้อยใจ → ฉากน้อยใจ (ตรวจสถานะก่อนเยี่ยม)
  setAff(principal, 0.1);
  if (sceneOf(again(principal)) !== 'marriage.visit_cold') problems.push('นางน้อยใจแต่ไม่มีฉากน้อยใจ');
  // ท้องแก่ → ฉากท้อง ครั้งเดียวต่อท้อง
  setAff(principal, 0.6);
  principal.pregnancy = { memberId: principal.id, partnerId: hero.id, dueDay: S.meta.day + 30 };
  if (sceneOf(again(principal)) !== 'marriage.visit_pregnant') problems.push('นางท้องแก่แต่ไม่มีฉากท้อง');
  setAff(principal, 0.6);
  if (sceneOf(again(principal))) problems.push('ท้องเดียวกันขึ้นฉากท้องซ้ำ');
  delete principal.pregnancy;

  // ทุกตัวเลือกของฉากใหม่ทำงานได้ และมีบรรทัดผลของบทพูด
  for (const id of ['marriage.visit_first', 'marriage.visit_pregnant', 'marriage.visit_cold']) {
    for (const o of content.events[id]!.options) {
      const p = prepareEvent(ctx, id, { actor: hero.id, spouse: minor.id });
      p.locked.clear();
      const r = chooseOption(ctx, p, o.id);
      if (!r.outcome?.textKey) problems.push(`${id}.${o.id}: ไม่มีบทตอบ`);
    }
  }

  // เกี้ยวเมียน้อย: event ขึ้นเฉพาะตอนมีเมียอยู่แล้ว
  const court = content.intents['court']!.midEvents.find((m) => m.event === 'intent.court.minor');
  if (!court?.married) problems.push('intent.court.minor ไม่ได้ตั้ง married');
  const target = spawnLocal(ctx, hero, { sex: 'f', age: 19, distance: 'near', single: true });
  for (const o of content.events['intent.court.minor']!.options) {
    const p = prepareEvent(ctx, 'intent.court.minor', { actor: hero.id, target: target.id });
    p.locked.clear();
    chooseOption(ctx, p, o.id);
  }

  // ช่วยคนตกน้ำ: ทุกตัวเลือกจบแบบไม่มีใครตาย
  const before2 = Object.values(S.characters).filter((c) => !isAlive(c)).length;
  for (const o of content.events['life.drowning']!.options) {
    for (let i = 0; i < 20; i++) {
      const kid = spawnLocal(ctx, hero, { sex: 'm', age: 7, distance: 'near', single: true });
      const p = prepareEvent(ctx, 'life.drowning', { actor: hero.id, victim: kid.id });
      p.locked.clear();
      const r = chooseOption(ctx, p, o.id);
      if (!r.outcome?.textKey) problems.push(`life.drowning.${o.id}: ไม่มีบรรทัดผล`);
    }
  }
  if (Object.values(S.characters).filter((c) => !isAlive(c)).length !== before2) problems.push('ฉากตกน้ำทำให้มีคนตาย');

  check('ไปค้างเรือนเมีย เกี้ยวเมียน้อย ช่วยคนตกน้ำ', problems);
  if (failed === before) console.log('  ✓ ครั้งแรกมีฉาก · ครั้งต่อไปขึ้นเฉพาะน้อยใจ/ท้องแก่ (ท้องละครั้ง) · ทุกตัวเลือกมีบทตอบ · ช่วยคนตกน้ำไม่มีใครตาย');
}

// [5h] ผู้ใหญ่ที่ยังไม่มีตำแหน่งฝากตัวเข้ากรมโดยตรง (ผู้สืบที่เลยวัยมหาดเล็ก) — ชายชั้นขุนนางเท่านั้น ได้ขั้นแรกของกรม
{
  const before = failed;
  console.log('ฝากตัวเข้ากรม:');
  const ctx = makeCtx(emptyState(43), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(25); // ผู้เล่นอายุ 32
  delete hero.office;
  const problems: string[] = [];
  const asked = (who: Character) => {
    for (let i = 0; i < 60; i++) if (careerYearTick(ctx).events.some((e) => e.event === 'career.petition' && e.bindings.actor === who.id)) return true;
    return false;
  };
  hero.sex = 'm';
  hero.social.estate = 'noble';
  if (!asked(hero)) problems.push('ชายขุนนางผู้ใหญ่ไม่มีตำแหน่งไม่เคยได้โอกาสฝากตัวใน 60 ปี');
  const p = prepareEvent(ctx, 'career.petition', { actor: hero.id });
  chooseOption(ctx, p, 'patrol');
  if (!hero.office || officeRank(ctx, hero) !== 1) problems.push(`ฝากตัวแล้วได้ขั้น ${hero.office ? officeRank(ctx, hero) : 'ไม่มี'} ไม่ใช่ขั้นแรกของกรม`);
  delete hero.office;
  hero.sex = 'f';
  if (asked(hero)) problems.push('ผู้หญิงได้โอกาสฝากตัวเข้ากรม');
  hero.sex = 'm';
  hero.social.estate = 'phrai_luang';
  if (asked(hero)) problems.push('ไพร่ได้โอกาสฝากตัวเข้ากรม');
  check('ฝากตัวเข้ากรม', problems);
  if (failed === before) console.log('  ✓ ชายขุนนางผู้ใหญ่ฝากตัวเข้ากรมได้ ได้ขั้นแรก · ผู้หญิงและไพร่ไม่ได้');
}

// [5i] ถูกถอดเพราะความผิด → ฝากตัวเข้ากรมเองไม่ได้จนกว่าจะครบปี/ผลัดแผ่นดิน (ไม่ใช่ยื่นสุ่มปีละ 15% ทันที)
{
  const before = failed;
  console.log('ถูกถอดเพราะความผิด:');
  const ctx = makeCtx(emptyState(44), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(25);
  delete hero.office;
  hero.sex = 'm';
  hero.social.estate = 'noble';
  const now = yearOf(ctx, S.meta.day);
  const problems: string[] = [];
  const asked = () => {
    for (let i = 0; i < 60; i++) if (careerYearTick(ctx).events.some((e) => e.event === 'career.petition' && e.bindings.actor === hero.id)) return true;
    return false;
  };
  hero.disgrace = { year: now };
  if (asked()) problems.push('เพิ่งถูกถอดแต่ฝากตัวเข้ากรมได้ทันที');
  if (!hero.disgrace) problems.push('ความผิดหายไปทั้งที่เพิ่งถูกถอด');
  hero.disgrace = { year: now - ctx.content.balance.career.disgraceYears };
  careerYearTick(ctx);
  if (hero.disgrace) problems.push('ครบกำหนดแล้วยังไม่พ้นความผิด');
  if (!asked()) problems.push('พ้นความผิดแล้วยังฝากตัวเข้ากรมไม่ได้');
  check('ถูกถอดเพราะความผิด', problems);
  if (failed === before) console.log('  ✓ ถูกถอดแล้วฝากตัวเองไม่ได้ · ครบกำหนดแล้วจึงยื่นได้อีก');
}

// [5i2] โทษขุนนางตามอาชญาหลวง: ผิดครั้งแรกตอนหนุ่มได้ภาคทัณฑ์ · ค่าปรับทวีคูณเมื่อผิดซ้ำ · ครั้งที่ห้าริบทรัพย์แล้วถอด · ผู้ใหญ่ที่ฝากตัวเสียด้วย
//  (docs/design-official-punishment.md)
{
  const before = failed;
  console.log('โทษขุนนาง (ภาคทัณฑ์ ทวีคูณ ครั้งที่ห้า):');
  const C = content.balance.career;
  const ctx = makeCtx(emptyState(45), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  hero.sex = 'm';
  hero.social.estate = 'noble';
  const problems: string[] = [];
  const setAge = (age: number) => { hero.birthDay = S.meta.day - yearsToDays(age) - 30; };
  const offend = () => {
    hero.office!.favor = -1;
    return careerYearTick(ctx).events.find((e) => e.bindings.actor === hero.id && e.event.startsWith('career.'))?.event;
  };
  const enter = () => {
    delete hero.office; delete hero.disgrace; hero.offences = 0;
    applyCareer(ctx, hero, 'enter_dept', 'patrol');
  };
  const patron = Object.values(S.characters).find((c) => c.id !== hero.id && isAlive(c))!;
  setRelation(ctx, hero.id, patron.id, 'patron', 0.8);
  const patronStrength = () => Object.values(S.relations).find((r) => r.from === hero.id && r.to === patron.id && r.kind === 'patron')?.strength ?? 0;

  setAge(25); enter();
  if (offend() !== 'career.probation') problems.push('ผิดครั้งแรกตอนหนุ่มไม่ได้ภาคทัณฑ์');
  if (offend() !== 'career.punished') problems.push('ผิดครั้งที่สองยังได้ภาคทัณฑ์อีก');
  setAge(45); enter();
  if (offend() !== 'career.punished') problems.push('ขุนนางอายุ 45 ผิดครั้งแรกได้ภาคทัณฑ์ (ตัวบทไม่ให้ขุนนางผู้ใหญ่)');

  // ค่าปรับไหม: ครั้งที่สองเป็นสองเท่าของครั้งแรก (ทวีคูณ) สูงสุดจัตุรคูณ
  const fineAt = (n: number) => {
    hero.offences = n; hero.social.wealth = 10000;
    const p = prepareEvent(ctx, 'career.punished', { actor: hero.id });
    p.locked.clear();
    chooseOption(ctx, p, 'gift');
    return 10000 - hero.social.wealth;
  };
  const [f1, f2, f4, f5] = [fineAt(1), fineAt(2), fineAt(4), fineAt(5)];
  if (!(f1 > 0 && Math.abs(f2 - 2 * f1) < 1e-9 && Math.abs(f4 - 4 * f1) < 1e-9 && Math.abs(f5 - f4) < 1e-9)) problems.push(`ค่าปรับไม่ทวีคูณ: ${f1}/${f2}/${f4}/${f5}`);

  // ครั้งที่ห้า: event ถูกถอด → ริบทรัพย์ ถอด ติดความผิด ผู้ใหญ่ที่ฝากตัวเสีย
  enter();
  hero.offences = C.removeAtOffence - 1;
  if (offend() !== 'career.removed') problems.push(`ผิดครั้งที่ ${C.removeAtOffence} ไม่ถูกถอด`);
  hero.social.wealth = 1000;
  const pBefore = patronStrength();
  const p = prepareEvent(ctx, 'career.removed', { actor: hero.id });
  p.locked.clear();
  chooseOption(ctx, p, 'take');
  if (hero.office || !hero.disgrace) problems.push('ถูกถอดครั้งที่ห้าแต่ยังมีตำแหน่งหรือไม่ติดความผิด');
  if (1000 - hero.social.wealth !== Math.round(1000 * C.removedWealthShare)) problems.push(`ริบทรัพย์ ${1000 - hero.social.wealth} ไม่ตรง ${Math.round(1000 * C.removedWealthShare)}`);
  if (!(patronStrength() < pBefore)) problems.push('ผู้ใหญ่ที่ฝากตัวไม่ได้รับผลเมื่อผู้เล่นถูกถอด');

  // ลดจนหลุดขั้นแรก (ยังไม่ถึงครั้งที่ห้า) ถอดและติดความผิดแต่ไม่ริบทรัพย์
  enter(); hero.offences = 2; hero.social.wealth = 1000;
  for (let i = 0; i < 5 && hero.office; i++) applyCareer(ctx, hero, 'demote');
  if (hero.office || !hero.disgrace || hero.social.wealth !== 1000) problems.push('ลดจนหลุดขั้นแรก: ควรถอดและติดความผิดโดยไม่ริบทรัพย์');
  check('โทษขุนนาง', problems);
  if (failed === before) console.log(`  ✓ หนุ่มผิดครั้งแรกภาคทัณฑ์ (อายุ 45 ไม่ได้) · ค่าปรับ ${f1}/${f2}/${f4} ตำลึง (ครั้งที่ 1/2/4+) · ครั้งที่ ${C.removeAtOffence} ริบทรัพย์แล้วถอด · ผู้ใหญ่ที่ฝากตัวเสียด้วย`);
}

// [5h2] วิชาช่วยเลื่อนยศ: ขั้นวิชาในสายของกรมเพิ่มความโปรดปรานรายปี และแผงตัวละครบอกผลให้เห็น
{
  const before = failed;
  console.log('วิชากับความก้าวหน้าในราชการ:');
  const ctx = makeCtx(emptyState(44), content);
  const hero = bootstrapScenario(ctx);
  ctx.state.meta.day += yearsToDays(25);
  hero.sex = 'm';
  hero.social.estate = 'noble';
  delete hero.office;
  const problems: string[] = [];
  applyCareer(ctx, hero, 'enter_dept', 'patrol');
  const yearFavor = (perks: string[]) => {
    hero.perks = perks;
    hero.office!.favor = 0;
    careerYearTick(ctx);
    return hero.office!.favor;
  };
  const none = yearFavor([]);
  const tier3 = yearFavor(['martial_1', 'martial_2', 'martial_3']);
  const wrongTrack = yearFavor(['learning_1', 'learning_2', 'learning_3']);
  const per = ctx.content.balance.career.skillFavorPerTier;
  if (!(tier3 > none)) problems.push(`วิชาสายต่อสู้ 3 ขั้นไม่ช่วยความโปรดปรานในกรมกองกระเวน (${none.toFixed(3)} → ${tier3.toFixed(3)})`);
  if (Math.abs(tier3 - none - 3 * per * ctx.content.balance.career.favorDecay) > 0.001) problems.push('ความโปรดปรานที่เพิ่มไม่ตรงขั้นวิชา × ค่าต่อขั้น');
  if (Math.abs(wrongTrack - none) > 0.001) problems.push('วิชาสายอื่นที่ไม่เกี่ยวกับกรมกลับช่วยเลื่อนยศ');
  hero.perks = [];
  if (!officeStatus(ctx, hero)?.includes('ฝึกวิชา')) problems.push('แผงตัวละครไม่บอกว่าฝึกวิชาช่วยเลื่อนยศ');
  hero.perks = ['martial_1', 'martial_2'];
  if (!officeStatus(ctx, hero)?.includes('ขั้น 2')) problems.push('แผงตัวละครไม่บอกผลของวิชาที่ปลดล็อก');
  check('วิชากับความก้าวหน้าในราชการ', problems);
  if (failed === before) console.log('  ✓ วิชาสายของกรมเพิ่มความโปรดปรานตามขั้น · สายอื่นไม่ช่วย · แผงตัวละครบอกผล');
}

// [5h2b] ขั้นยศเชิงภาพ (ใช้เลือกภาพตัวละคร): มหาดเล็ก = page, ขั้นบนสุดของกรม = head, ขั้นที่ 1 = low, ขั้นที่ 2 = mid, ที่เหลือ = high
{
  const before = failed;
  console.log('ขั้นยศเชิงภาพ:');
  const ctx = makeCtx(emptyState(46), content);
  const hero = bootstrapScenario(ctx);
  ctx.state.meta.day += yearsToDays(25);
  hero.sex = 'm';
  hero.social.estate = 'noble';
  delete hero.office;
  const problems: string[] = [];
  if (officeTier(ctx, hero) !== undefined) problems.push('ไม่มีตำแหน่งแต่มีขั้นยศ');
  for (const dept of content.offices.departments) {
    const top = Math.max(...dept.posts.map((p) => p.rank));
    for (const post of dept.posts.filter((p) => p.rank > 0)) {
      hero.office = { postId: post.id, deptId: dept.id, sinceDay: ctx.state.meta.day, favor: 0 };
      const want = post.rank === top ? 'head' : post.rank === 1 ? 'low' : post.rank === 2 ? 'mid' : 'high';
      if (officeTier(ctx, hero) !== want) problems.push(`${dept.id}/${post.id} ได้ ${officeTier(ctx, hero)} ควรเป็น ${want}`);
    }
    hero.office = { postId: 'page', sinceDay: ctx.state.meta.day, favor: 0 };
    if (officeTier(ctx, hero) !== 'page') problems.push('มหาดเล็กไม่ได้ขั้น page');
  }
  check('ขั้นยศเชิงภาพ', problems);
  if (failed === before) console.log('  ✓ มหาดเล็ก/หมื่น/ขุน/ขั้นสูง/เจ้ากรมของทุกกรมได้ขั้นยศถูกต้อง');
}

// [5h2c] ศึกพม่า 2308 (docs/design-war-2308.md ขั้น 1): badge ตลอด 2308–2310, event ข่าวมาตามวันที่นัดครั้งเดียวต่อปี, ตัวเลือกมีผลจริง
{
  const before = failed;
  console.log('ศึกพม่า 2308:');
  const ctx = makeCtx(emptyState(48), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  const problems: string[] = [];
  const badge = (year: number) => { S.meta.day = yearStart(ctx, year) + 10; return eraConditions(ctx).some((b) => b.label === 'ศึกพม่า'); };
  for (const [year, want] of [[2307, false], [2308, true], [2309, true], [2310, true], [2311, false]] as const) {
    if (badge(year) !== want) problems.push(`badge ศึกพม่าปี ${year} ควร${want ? 'ขึ้น' : 'ไม่ขึ้น'}`);
  }
  S.meta.day = yearStart(ctx, 2308) + 38;
  const seen: PreparedEvent[] = [];
  while (S.meta.day < yearStart(ctx, 2308) + 150 && isAlive(S.characters[S.meta.playerCharacterId])) {
    for (const sig of advanceDay(ctx)) if (sig.type === 'event' && sig.prepared.def.id.startsWith('war.')) seen.push(sig.prepared);
  }
  const ids = seen.map((p) => p.def.id);
  if (ids.join() !== 'war.news_tenasserim,war.west_falls') problems.push(`event ศึกที่ได้ใน 2308: ${ids.join() || 'ไม่มี'}`);
  const [news, west] = seen;
  if (news && west) {
    hero.social.wealth = 10;
    const prep0 = S.meta.war?.prep ?? 0;
    chooseOption(ctx, news, 'store');
    if (Math.abs(hero.social.wealth - 9) > 0.001) problems.push(`เก็บของไว้แล้วเงินไม่ลด 1 ตำลึง (${hero.social.wealth})`);
    if ((S.meta.war?.prep ?? 0) - prep0 !== 1.5) problems.push('เก็บของแล้วการเตรียมตัวไม่เพิ่ม 1.5');
    const refugee = S.characters[west.instance.bindings.refugee!];
    if (!refugee?.local || refugee.local.distance !== 'far') problems.push('คนหนีศึกไม่ใช่คนรู้จักต่างถิ่นที่สร้างใหม่');
    chooseOption(ctx, west, 'shelter');
    if (refugee && !Object.values(S.relations).some((r) => r.from === refugee.id && r.to === hero.id && r.kind === 'gratitude')) problems.push('ให้ที่พักแล้วคนหนีศึกไม่รู้สึกบุญคุณ');
  }
  // ผู้เล่นอายุไม่ถึง 12 ไม่ได้ event (ตัวละครใหม่ที่เป็นเด็กตอนนั้น)
  const kid = makeCtx(emptyState(49), content);
  const kidHero = bootstrapScenario(kid);
  kid.state.meta.day = yearStart(kid, 2308) + 38;
  kidHero.birthDay = kid.state.meta.day - yearsToDays(8);
  let kidGot = 0;
  while (kid.state.meta.day < yearStart(kid, 2308) + 150 && isAlive(kid.state.characters[kid.state.meta.playerCharacterId])) {
    for (const sig of advanceDay(kid)) if (sig.type === 'event' && sig.prepared.def.id.startsWith('war.')) kidGot++;
  }
  if (kidGot) problems.push(`ผู้เล่นอายุ 8 ได้ event ศึก ${kidGot} ครั้ง`);
  check('ศึกพม่า 2308', problems);
  if (failed === before) console.log('  ✓ badge ปี 2308–2310 · ข่าวตะนาวศรีและหัวเมืองตะวันตกแตกมาครั้งเดียวตามวัน · เก็บของ/ให้ที่พักมีผลจริง · เด็กไม่ได้');
}

// [5h2d] ศึกพม่า ขั้น 2: ฝังทรัพย์ (ไหรอดการปล้นและขุดคืนตอนกรุงแตก) และหมายเรียกพล (ตัวเลือกเสี่ยงที่ผู้เล่นตายได้)
{
  const before = failed;
  console.log('เตรียมรับศึกและหมายเรียกพล:');
  const ctx = makeCtx(emptyState(50), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day = yearStart(ctx, 2308) + 264;
  hero.sex = 'm';
  const problems: string[] = [];

  // ฝังทรัพย์: เงินที่ใช้ได้ลด 60% และได้ไหทองซ่อนมูลค่าเท่าที่ฝัง
  const purse0 = purse(ctx, hero);
  chooseOption(ctx, prepareEvent(ctx, 'war.prepare', { actor: hero.id }), 'bury_most');
  const jar = Object.values(S.items).find((i) => i.id.startsWith('itm_war'));
  if (!jar?.hidden || jar.ownerCharacterId !== hero.id) problems.push('ฝังทรัพย์แล้วไม่ได้ไหทองซ่อนของผู้เล่น');
  else if (Math.abs(jar.value - purse0 * 0.6) > 1) problems.push(`ไหทองมูลค่า ${jar.value} ไม่ตรง 60% ของ ${purse0}`);
  if (Math.abs(purse(ctx, hero) - purse0 * 0.4) > 1) problems.push(`ฝังแล้วเงินที่ใช้ได้เหลือ ${purse(ctx, hero)} ควรราว ${purse0 * 0.4}`);

  // ไหที่ซ่อนรอดการปล้นตอนกรุงแตก: ถ้าผู้เล่นยังอยู่ ขุดคืน (เจอหรือไม่เจอก็ลบไหออก) — เงินสดโดนริบ
  S.meta.day = yearStart(ctx, 2310);
  const lines = applyHistoricalShocks(ctx, 2310);
  if (isAlive(hero) && !lines.some((l) => /ขุด(หา)?ไหทอง/.test(l))) problems.push('กรุงแตกแล้วไม่มีบรรทัดขุดไหทองที่ฝังไว้');
  if (isAlive(hero) && Object.values(S.items).some((i) => i.id.startsWith('itm_war'))) problems.push('ขุดไหแล้วไหยังอยู่ในคลัง');

  // โอกาสขุดเจอ ~80% (ตัวเลขของเกม) — ฝัง 30 ไหแล้วขุด
  const ctx2 = makeCtx(emptyState(51), content);
  const h2 = bootstrapScenario(ctx2);
  h2.social.wealth = 3000;
  for (let i = 0; i < 30; i++) buryValuables(ctx2, h2, 0.02);
  const found = unearthBuried(ctx2).filter((l) => l.includes('ขุดไหทองที่ฝังไว้ขึ้นมา')).length;
  if (found < 16 || found > 29) problems.push(`ขุดไหเจอ ${found}/30 (คาด ~24)`);

  // หมายเรียกพล: ชายวัย 18–50 เท่านั้น; จ้างแทนต้องมีเงิน; ไปเองเสี่ยงตายและความสามารถรบลดความเสี่ยง
  const lev = prepareEvent(ctx2, 'war.levy', { actor: h2.id });
  const poor = spawnCharacter(ctx2, { name: 'ยาจก', sex: 'm', birthYear: 2280, estate: 'phrai_som', dynastyId: null, householdId: null, wealth: 3 });
  if (prepareEvent(ctx2, 'war.levy', { actor: poor.id }).options.some((o) => o.id === 'pay')) problems.push('คนจนเห็นตัวเลือกจ้างคนแทนทั้งที่เงินไม่ถึง');
  if (!lev.options.some((o) => o.id === 'pay')) problems.push('คนมีเงินไม่มีตัวเลือกจ้างคนแทน');
  const serve = lev.options.find((o) => o.id === 'serve')!;
  const who = (role: string) => ctx2.state.characters[lev.instance.bindings[role] ?? ('' as Character['id'])];
  h2.skills['combat'] = 0;
  const weak = riskChance(ctx2, h2, serve.risk!, who);
  h2.skills['combat'] = 80;
  const strong = riskChance(ctx2, h2, serve.risk!, who);
  if (!(strong < weak) || weak > 0.3 || strong < 0.02) problems.push(`ความเสี่ยงไปรบ: ไม่มีทักษะ ${weak.toFixed(2)} ทักษะสูง ${strong.toFixed(2)}`);

  // ตายจริงและส่งต่อผู้สืบ (settlePlayerDeath ใช้ทั้งตายตามวัยและตายเพราะผลของตัวเลือก)
  h2.skills['combat'] = 0;
  let died = false;
  for (let i = 0; i < 300 && !died; i++) {
    chooseOption(ctx2, prepareEvent(ctx2, 'war.levy', { actor: h2.id }), 'serve');
    died = !isAlive(h2);
  }
  if (!died) problems.push('ไปรบ 300 ครั้งไม่เคยตายเลย');
  else {
    if (h2.deathCause !== 'history:burmese_invasion') problems.push(`ตายด้วย ${h2.deathCause} ไม่ใช่ศึกพม่า`);
    const pushed: string[] = [];
    const outcome = settlePlayerDeath(ctx2, [], (p) => pushed.push(p.type));
    if (!pushed.includes('playerDied')) problems.push('ตายแล้วไม่แจ้งการตาย');
    if (outcome === 'handed_over' && ctx2.state.meta.playerCharacterId === h2.id) problems.push('มีผู้สืบคนเดียวแต่ผู้เล่นยังเป็นคนตาย');
    if (outcome === 'extinct') problems.push('ผู้เล่นในฉากเริ่มมีน้องแต่ตระกูลสิ้นสาย');
  }

  // ผู้หญิงไม่ถูกเรียกพล แต่เตรียมตัวได้
  const ctx3 = makeCtx(emptyState(52), content);
  const h3 = bootstrapScenario(ctx3);
  h3.sex = 'f';
  ctx3.state.meta.day = yearStart(ctx3, 2308) + 174;
  const ids3: string[] = [];
  for (let i = 0; i < 100; i++) for (const sig of advanceDay(ctx3)) if (sig.type === 'event') ids3.push(sig.prepared.def.id);
  if (ids3.includes('war.levy')) problems.push('ผู้หญิงถูกเรียกพล');
  if (!ids3.includes('war.prepare')) problems.push('ผู้หญิงไม่ได้ event เตรียมรับศึก');
  check('เตรียมรับศึกและหมายเรียกพล', problems);
  if (failed === before) console.log('  ✓ ฝังทรัพย์ได้ไหซ่อนและขุดคืน ~80% · หมายเรียกพลเฉพาะชายวัยฉกรรจ์ · ไปรบเสี่ยงตายจริงและส่งต่อผู้สืบได้ · ผู้หญิงไม่ถูกเรียก');
}

// [5h2e] ศึกพม่า ขั้น 3: ตัดสินใจอยู่หรือหนี — ตัวเลือกตามหัวเรือน, รายชื่อคนที่ไปด้วย, ที่อยู่ต่างกันตอนกรุงแตกเสี่ยงตายต่างกัน
{
  const before = failed;
  console.log('ออกจากกรุงหรืออยู่:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(53), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day = yearStart(ctx, 2308) + 319;
  hero.sex = 'm';
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2285, estate: 'noble', dynastyId: null, householdId: hero.householdId });
  marry(ctx, hero, wife);
  for (const n of ['ลูกหนึ่ง', 'ลูกสอง']) spawnCharacter(ctx, { name: n, sex: 'm', birthYear: 2305, estate: 'noble', father: hero, mother: wife, householdId: hero.householdId });
  const hh = S.households[hero.householdId!]!;
  const optionIds = () => prepareEvent(ctx, 'war.decide_leave', { actor: hero.id }).options.map((o) => o.id).join();
  if (hh.headId === hero.id) problems.push('ฉากเริ่มผู้เล่นเป็นหัวเรือนอยู่แล้ว ข้อทดสอบเงื่อนไขหัวเรือนใช้ไม่ได้');
  if (optionIds().includes('east_all')) problems.push('คนที่ไม่ใช่หัวเรือนเห็นตัวเลือกยกทั้งเรือน');
  const father = S.characters[hh.headId]!;
  const members = hh.memberIds.filter((id) => isAlive(S.characters[id])).length;
  const choose = (id: string) => chooseOption(ctx, prepareEvent(ctx, 'war.decide_leave', { actor: hero.id }), id);
  choose('east_nuclear');
  const nuclear = S.meta.war?.party ?? [];
  if (nuclear.length !== 4 || !nuclear.includes(hero.id) || !nuclear.includes(wife.id)) problems.push(`พาคนใกล้ชิด ได้ ${nuclear.length} คน ควร 4 (ตัวเอง เมีย ลูก 2)`);
  if (nuclear.includes(father.id)) problems.push('พาคนใกล้ชิดแล้วพ่อซึ่งเป็นหัวเรือนไปด้วย');
  choose('east_alone');
  if (S.meta.war?.party?.length !== 1) problems.push('ไปคนเดียวแล้วมีคนอื่นไปด้วย');
  hh.headId = hero.id;
  if (!optionIds().includes('east_all')) problems.push('หัวเรือนไม่เห็นตัวเลือกยกทั้งเรือน');
  choose('east_all');
  if (S.meta.war?.party?.length !== members || S.meta.war?.dir !== 'east') problems.push(`ยกทั้งเรือน ได้ ${S.meta.war?.party?.length} คน ควร ${members}`);
  choose('forest_nuclear');
  if (S.meta.war?.dir !== 'forest') problems.push('หนีเข้าป่าแล้วทิศไม่ใช่ป่า');
  choose('stay');
  if (S.meta.war?.stance !== 'stay' || S.meta.war?.party) problems.push('ปักหลักแล้วยังมีรายชื่อคนที่ออกไป');
  S.meta.day = yearStart(ctx, 2309) + 10;
  if (!warBadges(ctx).some((b) => b.label === 'ปักหลักอยู่ในกรุง')) problems.push('ไม่มีป้ายสถานะปักหลักในกรุง');

  // ตอนกรุงแตก: ที่อยู่ต่างกัน → ความเสี่ยงตายและเงินสดที่ถูกริบต่างกัน (ตัวคูณของเกม: ตะวันออก 0.3 · กรุง 1 · ป่า 1.3)
  const outcome = (seed: number, where: 'city' | 'east' | 'forest' | 'camp', prep = 0) => {
    const c = makeCtx(emptyState(seed), content);
    const h = bootstrapScenario(c);
    const folk = Array.from({ length: 1000 }, (_, i) => spawnCharacter(c, {
      name: `ชาวบ้าน${i}`, sex: 'm', birthYear: 2280, estate: 'noble', dynastyId: h.dynastyId, householdId: null, wealth: 100,
    }));
    c.state.meta.war = where === 'city'
      ? { prep, stance: 'stay' }
      : { prep, stance: 'leave', dir: where, party: folk.map((f) => f.id) };
    applyHistoricalShocks(c, 2310);
    const alive = folk.filter((f) => isAlive(f));
    const captured = folk.filter((f) => f.deathCause === 'history:captive_after_fall').length;
    return {
      dead: folk.length - alive.length - captured, captured, survive: alive.length / folk.length,
      cash: alive.reduce((a, f) => a + f.social.wealth, 0) / Math.max(1, alive.length),
    };
  };
  const city = outcome(60, 'city');
  const east = outcome(61, 'east');
  const forest = outcome(62, 'forest');
  // เป้าผู้ใช้ (design-war-2308 ข้อ 8.4): ผู้ปักหลักในกรุงที่เตรียมตัวบ้างรอดราว 40–60% และการเตรียมตัวต้องช่วยจริง
  const prepared = outcome(63, 'city', 3);
  const wellPrepared = outcome(64, 'city', 5);
  // ยอมแพ้: ตายน้อยมากและเก็บเงินสดได้มากกว่า แต่ถูกกวาดต้อนบ่อย — ไม่ใช่ทางที่ดีกว่าทุกด้าน
  const camp = outcome(65, 'camp');
  if (!(camp.dead < city.dead * 0.3)) problems.push(`ยอมแพ้ตาย ${camp.dead}/1000 ไม่น้อยกว่ากรุง ${city.dead}/1000 พอ`);
  if (!(camp.captured > prepared.captured)) problems.push(`ยอมแพ้ถูกกวาดต้อน ${camp.captured}/1000 ไม่มากกว่าปักหลักเตรียมตัว ${prepared.captured}/1000`);
  if (!(camp.cash > city.cash + 10)) problems.push(`ยอมแพ้เงินสดเหลือ ${camp.cash.toFixed(0)} ไม่มากกว่าอยู่ในกรุง ${city.cash.toFixed(0)}`);
  if (!(camp.survive < east.survive)) problems.push(`ยอมแพ้รอด ${(camp.survive * 100).toFixed(0)}% ไม่น้อยกว่าหนีตะวันออก ${(east.survive * 100).toFixed(0)}%`);
  if (!(prepared.survive >= 0.4 && prepared.survive <= 0.6)) problems.push(`ปักหลักเตรียมตัวบ้าง (prep 3) รอด ${(prepared.survive * 100).toFixed(0)}% ควรอยู่ในช่วง 40–60%`);
  if (!(wellPrepared.survive > city.survive + 0.1)) problems.push(`เตรียมตัวเต็มที่รอด ${(wellPrepared.survive * 100).toFixed(0)}% ไม่มากกว่าไม่เตรียม ${(city.survive * 100).toFixed(0)}% พอ`);
  if (!(east.survive > prepared.survive + 0.1)) problems.push(`หนีตะวันออกรอด ${(east.survive * 100).toFixed(0)}% ไม่มากกว่าปักหลักเตรียมตัว ${(prepared.survive * 100).toFixed(0)}% พอ — ทางหนีควรปลอดภัยกว่า`);
  if (!(east.survive < 0.97)) problems.push(`หนีตะวันออกรอด ${(east.survive * 100).toFixed(0)}% ปลอดภัยเกินไป — ควรยังไม่แน่นอน`);
  if (!(forest.survive < prepared.survive)) problems.push(`หนีเข้าป่ารอด ${(forest.survive * 100).toFixed(0)}% ไม่น้อยกว่าปักหลักเตรียมตัว ${(prepared.survive * 100).toFixed(0)}%`);
  if (!(city.captured > 0 && city.dead > 0)) problems.push('กรุงแตกแล้วไม่มีทั้งคนตายและคนถูกกวาดต้อน');
  if (!(east.cash > 70 && city.cash < 55)) problems.push(`เงินสดที่เหลือ: หนีตะวันออก ${east.cash.toFixed(0)} · อยู่ในกรุง ${city.cash.toFixed(0)} (ควร >70 และ <55)`);
  check('ออกจากกรุงหรืออยู่', problems);
  if (failed === before) console.log(`  ✓ ตัวเลือกตามหัวเรือน · รายชื่อคนที่ไปด้วยถูก · กรุงแตก: ต่อพัน (ตาย/กวาดต้อน) กรุง ${city.dead}/${city.captured} ตะวันออก ${east.dead}/${east.captured} ป่า ${forest.dead}/${forest.captured} · รอด: กรุงไม่เตรียม ${(city.survive * 100).toFixed(0)}% prep3 ${(prepared.survive * 100).toFixed(0)}% prep5 ${(wellPrepared.survive * 100).toFixed(0)}% ตะวันออก ${(east.survive * 100).toFixed(0)}% ป่า ${(forest.survive * 100).toFixed(0)}% ยอมแพ้ ${(camp.survive * 100).toFixed(0)}% (ตาย/กวาดต้อน ${camp.dead}/${camp.captured}, เงินสด ${camp.cash.toFixed(0)}) · เงินสดเหลือ กรุง ${city.cash.toFixed(0)} ตะวันออก ${east.cash.toFixed(0)}`);
}

// [5h2f] ศึกเก้าทัพ 2328–2329 (docs/design-war-2328.md ขั้น 2): ข่าวและหมายเกณฑ์มาตามวันจริง, ตัวเลือกบันทึกใน meta.campaigns, คนในเรือนที่ถูกเกณฑ์ไม่ถูกสุ่มตาย
{
  const before = failed;
  console.log('ศึกเก้าทัพ 2328:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(60), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  hero.sex = 'm';
  const yearOfShock = (tag: string) => content.history.find((h) => h.tag === tag)?.year;
  if (yearOfShock('history:nine_armies') !== 2329) problems.push('เก้าทัพต้องอยู่ปี 2329 (ลาดหญ้าแตก 17 ก.พ. 2329)');
  if (yearOfShock('history:tha_din_daeng') !== 2330) problems.push('ท่าดินแดงต้องอยู่ปี 2330');

  // ข่าวและหมายเกณฑ์มาตามวัน (ข่าวถึงกรุง 25 พ.ย. 2328 = วันที่ 328)
  S.meta.day = yearStart(ctx, 2328) + 327;
  const seen: Array<[number, string]> = [];
  for (let i = 0; i < 12; i++) for (const sig of advanceDay(ctx)) if (sig.type === 'event' && sig.prepared.def.id.startsWith('war2328')) seen.push([dayOfYear(ctx, S.meta.day), sig.prepared.def.id]);
  if (!seen.some(([d, id]) => d === 328 && id === 'war2328.news')) problems.push(`ข่าวไม่มาวันที่ 328: ${JSON.stringify(seen)}`);
  if (!seen.some(([d, id]) => d === 335 && id === 'war2328.levy')) problems.push(`หมายเกณฑ์ไม่มาวันที่ 335: ${JSON.stringify(seen)}`);

  // ตัวเลือกหมายเกณฑ์: ไปเอง → campaigns.mode self; จ่ายแทนต้องมีเงิน 12 และหักเงิน; หลบ → dodge
  hero.social.wealth = 500;
  const opts = (id = 'war2328.levy') => prepareEvent(ctx, id, { actor: hero.id });
  const p0 = purse(ctx, hero);
  chooseOption(ctx, opts(), 'pay');
  if (S.meta.campaigns?.nine_armies?.mode !== 'pay') problems.push('จ่ายแทนแล้วไม่บันทึก mode pay');
  if (Math.abs(p0 - purse(ctx, hero) - 12) > 0.6) problems.push(`จ่ายแทนควรหัก 12 ตำลึง หักไป ${(p0 - purse(ctx, hero)).toFixed(1)}`);
  chooseOption(ctx, opts(), 'serve');
  const st = S.meta.campaigns?.nine_armies;
  if (st?.mode !== 'self' || st.soldier !== hero.id) problems.push('ไปเองแล้วไม่บันทึก mode self/soldier');
  hero.social.wealth = 1;
  for (const ch of Object.values(S.characters)) if (ch.id !== hero.id) ch.social.wealth = 0;
  if (opts().options.some((o) => o.id === 'pay')) problems.push('คนจนเห็นตัวเลือกจ้างคนแทน');
  const young = spawnCharacter(ctx, { name: 'เด็กหนุ่ม', sex: 'm', birthYear: 2315, estate: 'noble', dynastyId: null, householdId: null });
  if (prepareEvent(ctx, 'war2328.levy', { actor: young.id }).options.length === 0) problems.push('หมายเกณฑ์ไม่มีตัวเลือกให้ชายหนุ่ม');

  // คนในเรือนที่ถูกเกณฑ์ไม่ถูกสุ่มตายตอน shock ปี 2329 (ตายจากตัวเลือกเท่านั้น); ถ้าเรือนนั้นไม่ได้ถูกเกณฑ์ ยังเสี่ยงตามเดิม
  const manyMen = (c: typeof ctx) => Array.from({ length: 60 }, (_, i) => spawnCharacter(c, { name: `ชาย${i}`, sex: 'm', birthYear: 2295, estate: 'noble', dynastyId: c.state.characters[c.state.meta.playerCharacterId]!.dynastyId, householdId: c.state.characters[c.state.meta.playerCharacterId]!.householdId }));
  const men = manyMen(ctx);
  applyHistoricalShocks(ctx, 2329);
  if (men.some((m) => !isAlive(m))) problems.push('คนในเรือนที่ถูกเกณฑ์ถูกสุ่มตายตอน shock');
  const ctxB = makeCtx(emptyState(61), content);
  bootstrapScenario(ctxB);
  ctxB.state.meta.day = yearStart(ctxB, 2329); // อายุคนในเรือนคำนวณจากวันปัจจุบัน
  const menB = manyMen(ctxB);
  applyHistoricalShocks(ctxB, 2329);
  if (!menB.some((m) => !isAlive(m))) problems.push('เรือนที่ไม่ได้ถูกเกณฑ์ไม่มีใครตายจาก shock เลย (ควรเสี่ยง ~8%)');
  check('ศึกเก้าทัพ 2328', problems);
  if (failed === before) console.log('  ✓ ข่าววันที่ 328 หมายเกณฑ์วันที่ 335 · จ่ายแทนหัก 12 ตำลึง · เรือนที่ถูกเกณฑ์ไม่ถูกสุ่มตายตอน shock');
}

// [5h2g] ศึกเก้าทัพ ขั้น 3: ส่งคนในเรือนไปแทน — ลูกชาย/ญาติชาย/บ่าวชาย, หัวเรือนหญิงหรือชายสูงวัยก็ได้หมายเกณฑ์
{
  const before = failed;
  console.log('ส่งคนไปทัพแทน:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(62), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day = yearStart(ctx, 2328) + 335;
  hero.sex = 'm';
  const hh = S.households[hero.householdId!]!;
  hh.headId = hero.id; // หัวเรือน = ผู้เล่น
  const ids = (id: string, actor = hero) => prepareEvent(ctx, id, { actor: actor.id, ...campaignBindings(ctx, actor, ['son', 'kin']) }).options.map((o) => o.id);
  // ยังไม่มีลูก/ญาติชาย: ไม่เห็นตัวเลือกส่งแทนคน แต่ยังจ่ายเงิน/ไปเองได้
  hero.social.wealth = 500;
  if (ids('war2328.levy').some((o) => o === 'send_son' || o === 'send_kin')) problems.push('ไม่มีลูก/ญาติชายแต่เห็นตัวเลือกส่งแทน');
  const son = spawnCharacter(ctx, { name: 'ลูกชาย', sex: 'm', birthYear: 2308, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
  const kid = spawnCharacter(ctx, { name: 'ลูกเล็ก', sex: 'm', birthYear: 2322, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
  const nephew = spawnCharacter(ctx, { name: 'หลานชาย', sex: 'm', birthYear: 2300, estate: 'noble', dynastyId: hero.dynastyId, householdId: hero.householdId });
  const bound = campaignBindings(ctx, hero, ['son', 'kin']);
  if (bound.son !== son.id) problems.push(`ลูกชายที่ส่งได้ควรเป็นลูกวัยฉกรรจ์ (ไม่ใช่เด็ก) ได้ ${bound.son}`);
  if (bound.kin !== nephew.id) problems.push(`ญาติชายที่ส่งได้ควรเป็นหลาน ได้ ${bound.kin}`);
  if (!ids('war2328.levy').includes('send_son') || !ids('war2328.levy').includes('send_kin')) problems.push('มีลูก/ญาติชายแล้วไม่เห็นตัวเลือกส่งแทน');
  // คนที่ไม่ใช่หัวเรือน (ลูกชายเอง) ส่งใครแทนไม่ได้
  if (ids('war2328.levy', son).some((o) => o.startsWith('send') || o === 'servant')) problems.push('ลูกที่ไม่ใช่หัวเรือนเห็นตัวเลือกส่งคนแทน');

  const stateNow = () => ctx.state.meta.campaigns?.nine_armies;
  const send = (opt: string) => {
    delete ctx.state.meta.campaigns;
    chooseOption(ctx, prepareEvent(ctx, 'war2328.levy', { actor: hero.id, ...campaignBindings(ctx, hero, ['son', 'kin']) }), opt);
    return stateNow();
  };
  const c1 = send('send_son');
  if (c1?.mode !== 'send' || c1.soldier !== son.id) problems.push('ส่งลูกชายแล้วไม่บันทึก soldier เป็นลูกชาย');
  const c2 = send('send_kin');
  if (c2?.mode !== 'send' || c2.soldier !== nephew.id) problems.push('ส่งญาติชายแล้วไม่บันทึก soldier เป็นหลาน');
  // บ่าว: ลดจำนวนบ่าวในเรือน 1 คน
  hh.retainers = { that: 3, phrai: 0, loyalty: 0.5 };
  if (!ids('war2328.levy').includes('servant')) problems.push('มีบ่าวแล้วไม่เห็นตัวเลือกส่งบ่าว');
  const c3 = send('servant');
  if (c3?.mode !== 'servant' || hh.retainers.that !== 2) problems.push(`ส่งบ่าวแล้วบ่าวควรเหลือ 2 เหลือ ${hh.retainers.that}`);
  hh.retainers = { that: 0, phrai: 0, loyalty: 0.5 };
  if (ids('war2328.levy').includes('servant')) problems.push('ไม่มีบ่าวแต่เห็นตัวเลือกส่งบ่าว');

  // หัวเรือนหญิง / ชายสูงวัย ได้หมายเกณฑ์แบบส่งแทน (ไม่มีตัวเลือกไปเอง) และมีทางเลือกที่ปลอดภัยเสมอ (ขอผ่อนผัน)
  hero.sex = 'f';
  const f = ids('war2328.levy_f');
  if (f.includes('serve') || !f.includes('send_son') || !f.includes('plead')) problems.push(`หมายเกณฑ์หัวเรือนหญิงตัวเลือกผิด: ${f}`);
  hero.sex = 'm';
  hero.birthDay = yearStart(ctx, 2270);
  const old = ids('war2328.levy_old');
  if (!old.includes('send_son') || old.includes('serve')) problems.push(`หมายเกณฑ์ชายสูงวัยตัวเลือกผิด: ${old}`);
  // schedule: ผู้เล่นแต่ละแบบได้เพียง event เดียวในวันนั้น
  const dayEvents = (sex: 'm' | 'f', birth: number) => {
    const c = makeCtx(emptyState(63), content);
    const h = bootstrapScenario(c);
    h.sex = sex;
    h.birthDay = yearStart(c, birth);
    c.state.households[h.householdId!]!.headId = h.id;
    c.state.meta.day = yearStart(c, 2328) + 334;
    return advanceDay(c).flatMap((s) => (s.type === 'event' && s.prepared.def.id.startsWith('war2328.levy') ? [s.prepared.def.id] : []));
  };
  const cases: Array<[string, 'm' | 'f', number, string]> = [['ชายวัยฉกรรจ์', 'm', 2290, 'war2328.levy'], ['หญิงหัวเรือน', 'f', 2290, 'war2328.levy_f'], ['ชายสูงวัยหัวเรือน', 'm', 2270, 'war2328.levy_old']];
  for (const [label, sex, birth, want] of cases) {
    const got = dayEvents(sex, birth);
    if (got.join() !== want) problems.push(`${label}ควรได้ ${want} ได้ ${got.join() || 'ไม่มี'}`);
  }
  check('ส่งคนไปทัพแทน', problems);
  if (failed === before) console.log('  ✓ ส่งลูกชาย/ญาติ/บ่าวแทนบันทึกถูก · ไม่มีคนก็ไม่เห็นตัวเลือก · ไม่ใช่หัวเรือนส่งแทนไม่ได้ · หัวเรือนหญิง/ชายสูงวัยได้หมายแบบส่งแทน มีทางขอผ่อนผัน');
}

// [5h2h] ศึกเก้าทัพ ขั้น 4: สนามรบ (เฉพาะผู้เล่นที่ไปเอง) + ข่าวชัยและผลของคนที่ส่งแทน — ตายได้เฉพาะตัวเลือกที่บอกความเสี่ยง
{
  const before = failed;
  console.log('สนามรบเก้าทัพ:');
  const problems: string[] = [];
  const mk = (seed: number) => {
    const c = makeCtx(emptyState(seed), content);
    const h = bootstrapScenario(c);
    h.sex = 'm';
    c.state.households[h.householdId!]!.headId = h.id;
    c.state.meta.day = yearStart(c, 2329) + 29;
    return { c, h };
  };
  const frontFor = (mode: 'self' | 'pay' | 'send' | 'dodge') => {
    const { c, h } = mk(70);
    c.state.meta.campaigns = { nine_armies: { mode, ...(mode === 'self' ? { soldier: h.id } : {}) } };
    return advanceDay(c).some((sig) => sig.type === 'event' && sig.prepared.def.id === 'war2328.front');
  };
  if (!frontFor('self')) problems.push('ผู้เล่นที่ไปทัพเองไม่ได้ event สนามรบวันที่ 30 ของ 2329');
  for (const m of ['pay', 'send', 'dodge'] as const) if (frontFor(m)) problems.push(`ผู้เล่นที่ ${m} ได้ event สนามรบ`);

  // ตัวเลือก: ยืนแนวหน้าและทำตามคำสั่งตายได้ (บอกความเสี่ยง) ถอยไม่ตายแต่เสียตำแหน่ง/ถูกเฆี่ยน; ทักษะ combat ช่วยลดเสี่ยง
  const { c: ctx, h: hero } = mk(71);
  ctx.state.meta.campaigns = { nine_armies: { mode: 'self', soldier: hero.id } };
  const ev = () => prepareEvent(ctx, 'war2328.front', { actor: hero.id });
  const who = (p: PreparedEvent) => (role: string) => ctx.state.characters[p.instance.bindings[role] ?? ('' as Character['id'])];
  const chance = (id: string, combat: number) => {
    hero.skills['combat'] = combat;
    const p = ev();
    return riskChance(ctx, hero, p.options.find((o) => o.id === id)!.risk!, who(p));
  };
  const f0 = chance('front', 0), f80 = chance('front', 80), o0 = chance('orders', 0), o80 = chance('orders', 80);
  if (!(f0 > o0) || !(f80 < f0) || !(o80 <= o0)) problems.push(`ความเสี่ยงไม่เรียงตามที่ออกแบบ: front ${f0.toFixed(2)}/${f80.toFixed(2)} orders ${o0.toFixed(2)}/${o80.toFixed(2)}`);
  if (Math.abs(o0 - SUBSTITUTE_DEATH) > 0.011) problems.push(`ความเสี่ยง "ทำตามคำสั่ง" ${o0.toFixed(3)} ไม่ตรง SUBSTITUTE_DEATH ${SUBSTITUTE_DEATH}`);
  hero.skills['combat'] = 80;
  if (Math.abs(chance('orders', 80) - substituteDeathChance(hero)) > 0.011) problems.push('ความเสี่ยงของคนที่ถูกส่งแทนไม่ตรงตัวเลือก "ทำตามคำสั่ง"');
  const fb = ev().options.find((o) => o.id === 'fallback')!;
  if (fb.risk!.fail.effects.some((e) => e.op === 'kill')) problems.push('ถอยแล้วตายได้ — ผู้ใช้ตัดสินว่าโทษถอยต้องไม่ถึงตาย');

  // ยืนแนวหน้า: รอดได้รางวัล (ความโปรดปราน บุญ) หรือตายจริงด้วยสาเหตุศึก
  const trial = (opt: string, n: number) => {
    let died = 0;
    let rewarded = 0;
    for (let i = 0; i < n; i++) {
      const { c, h } = mk(1000 + i);
      c.state.meta.campaigns = { nine_armies: { mode: 'self', soldier: h.id } };
      h.skills['combat'] = 0;
      const merit0 = h.merit;
      chooseOption(c, prepareEvent(c, 'war2328.front', { actor: h.id }), opt);
      if (!isAlive(h)) { died++; if (h.deathCause !== 'history:nine_armies') problems.push(`ตายด้วย ${h.deathCause} ไม่ใช่เก้าทัพ`); } else if (h.merit > merit0) rewarded++;
    }
    return { died, rewarded };
  };
  const t1 = trial('front', 200);
  if (t1.died < 20 || t1.died > 70) problems.push(`ยืนแนวหน้าตาย ${t1.died}/200 (คาด ~22% = 44)`);
  if (t1.rewarded < 100) problems.push(`รอดจากแนวหน้าแต่ไม่ได้บุญ ${t1.rewarded}`);
  const t2 = trial('orders', 200);
  if (t2.died < 5 || t2.died > 40) problems.push(`ทำตามคำสั่งตาย ${t2.died}/200 (คาด ~10% = 20)`);
  const t3 = trial('fallback', 100);
  if (t3.died !== 0) problems.push(`ถอยแล้วตาย ${t3.died}`);

  // ศึกจบวันที่ 47: ทุกคนได้ข่าวชัย แม้ผู้เล่นตายแล้ว; ผู้ที่ถูกส่งแทนสุ่มผลอัตโนมัติ ~10%; บ่าวกลับ ~80%
  const { c: rc, h: rh } = mk(72);
  rc.state.meta.day = yearStart(rc, 2329) + 46;
  const logs = advanceDay(rc).flatMap((sig) => (sig.type === 'log' ? [sig.line] : []));
  if (!logs.some((l) => l.includes('ลาดหญ้า'))) problems.push('วันที่ 47 ของ 2329 ไม่มีข่าวชัยลาดหญ้า');
  markDead(rc, rh, 'situation:old_age');
  if (!resolveCampaign(rc, 'nine_armies').some((l) => l.includes('ลาดหญ้า'))) problems.push('ผู้เล่นตายแล้วไม่มีข่าวชัย');
  const rctx = makeCtx(emptyState(73), content);
  const rhead = bootstrapScenario(rctx);
  rctx.state.households[rhead.householdId!]!.headId = rhead.id;
  rctx.state.meta.day = yearStart(rctx, 2329) + 47;
  let lost = 0;
  for (let i = 0; i < 300; i++) {
    const m = spawnCharacter(rctx, { name: `ทหาร${i}`, sex: 'm', birthYear: 2300, estate: 'phrai_som', dynastyId: null, householdId: rhead.householdId });
    m.skills['combat'] = 0;
    rctx.state.meta.campaigns = { nine_armies: { mode: 'send', soldier: m.id } };
    resolveCampaign(rctx, 'nine_armies');
    if (!isAlive(m)) lost++;
  }
  if (lost < 15 || lost > 50) problems.push(`คนที่ถูกส่งแทนตาย ${lost}/300 (คาด ~10% = 30)`);
  const hh = rctx.state.households[rhead.householdId!]!;
  hh.retainers = { that: 0, phrai: 0, loyalty: 0.5 };
  for (let i = 0; i < 300; i++) { rctx.state.meta.campaigns = { nine_armies: { mode: 'servant' } }; resolveCampaign(rctx, 'nine_armies'); }
  if (hh.retainers.that < 210 || hh.retainers.that > 270) problems.push(`บ่าวที่ส่งไปกลับ ${hh.retainers.that}/300 (คาด ~80% = 240)`);
  check('สนามรบเก้าทัพ', problems);
  if (failed === before) console.log(`  ✓ event สนามรบเฉพาะผู้ไปเอง · แนวหน้าตาย ${t1.died}/200 คำสั่ง ${t2.died}/200 ถอย 0/100 · ผู้ถูกส่งแทนตาย ${lost}/300 · ข่าวชัยวันที่ 47`);
}

// [5h2i] ศึกเก้าทัพ ขั้น 5: ข้าวแพงจากน้ำมาก (ทางบ้าน) — ได้ทุกคนวัย 16 ขึ้นไป ตัวเลือกตามเงินและตามที่ตุนไว้
{
  const before = failed;
  console.log('ข้าวแพง 2328:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(74), content);
  const hero = bootstrapScenario(ctx);
  hero.sex = 'f';
  ctx.state.meta.day = yearStart(ctx, 2328) + 344;
  const got = advanceDay(ctx).flatMap((sig) => (sig.type === 'event' ? [sig.prepared.def.id] : []));
  if (!got.includes('war2328.rice_dear')) problems.push(`ข้าวแพงไม่มาวันที่ 345 (หญิงอายุ ${ageOf(ctx, hero)}): ${got}`);
  const ids = () => prepareEvent(ctx, 'war2328.rice_dear', { actor: hero.id }).options.map((o) => o.id);
  hero.social.wealth = 1;
  for (const c of Object.values(ctx.state.characters)) if (c.id !== hero.id) c.social.wealth = 0;
  if (ids().join() !== 'wait') problems.push(`คนจนไม่ตุนข้าวควรเหลือแค่รอข้าวฉาง ได้ ${ids()}`);
  hero.social.wealth = 500;
  if (ids().includes('stock')) problems.push('ไม่ได้ตุนข้าวไว้แต่เห็นตัวเลือกเปิดยุ้ง');
  chooseOption(ctx, prepareEvent(ctx, 'war2328.news', { actor: hero.id }), 'store');
  if (!ids().includes('stock') || !ids().includes('buy') || !ids().includes('share')) problems.push(`ตุนข้าวแล้วตัวเลือกไม่ครบ: ${ids()}`);
  const w0 = purse(ctx, hero);
  chooseOption(ctx, prepareEvent(ctx, 'war2328.rice_dear', { actor: hero.id }), 'buy');
  if (Math.abs(w0 - purse(ctx, hero) - 15) > 0.6) problems.push('ซื้อข้าวแพงควรหัก 15 ตำลึง');
  check('ข้าวแพง 2328', problems);
  if (failed === before) console.log('  ✓ ข้าวแพงวันที่ 345 ได้ทุกคนวัย 16+ · คนจนเหลือรอข้าวฉาง · ตุนข้าวไว้ถึงเปิดยุ้งได้ · ซื้อหัก 15 ตำลึง');
}

// [5h2j] ศึกท่าดินแดง 2329–2330 (ขั้น 6): ใช้แม่แบบเดียวกับเก้าทัพ ศึกสั้นและชนะ ความเสี่ยงต่ำกว่า
{
  const before = failed;
  console.log('ศึกท่าดินแดง:');
  const problems: string[] = [];
  const mk = (seed: number, day: number) => {
    const c = makeCtx(emptyState(seed), content);
    const h = bootstrapScenario(c);
    h.sex = 'm';
    c.state.households[h.householdId!]!.headId = h.id;
    c.state.meta.day = day;
    return { c, h };
  };
  const eventsOn = (day: number) => {
    const { c } = mk(80, day);
    return advanceDay(c).flatMap((sig) => (sig.type === 'event' ? [sig.prepared.def.id] : []));
  };
  const yc = mk(81, 0).c;
  if (!eventsOn(yearStart(yc, 2329) + 299).includes('war2330.levy')) problems.push('หมายเกณฑ์ท่าดินแดงไม่มาวันที่ 300 ของ 2329');
  const { c: ctx, h: hero } = mk(82, yearStart(yc, 2329) + 299);
  hero.social.wealth = 500;
  const p0 = purse(ctx, hero);
  chooseOption(ctx, prepareEvent(ctx, 'war2330.levy', { actor: hero.id }), 'pay');
  if (ctx.state.meta.campaigns?.tha_din_daeng?.mode !== 'pay') problems.push('จ่ายแทนท่าดินแดงไม่บันทึกใน campaigns.tha_din_daeng');
  if (ctx.state.meta.campaigns?.nine_armies) problems.push('ท่าดินแดงไปเขียนทับ campaigns ของเก้าทัพ');
  if (Math.abs(p0 - purse(ctx, hero) - 8) > 0.6) problems.push('จ่ายแทนท่าดินแดงควรหัก 8 ตำลึง');
  chooseOption(ctx, prepareEvent(ctx, 'war2330.levy', { actor: hero.id }), 'serve');
  if (ctx.state.meta.campaigns?.tha_din_daeng?.mode !== 'self') problems.push('ไปเองท่าดินแดงไม่บันทึก mode self');
  // สนามรบ: ผู้ไปเองเท่านั้น ที่วันที่ 41 ของ 2330
  ctx.state.meta.day = yearStart(ctx, 2330) + 39;
  if (!advanceDay(ctx).some((sig) => sig.type === 'event' && sig.prepared.def.id === 'war2330.front')) problems.push('ไม่มี event สนามรบท่าดินแดง');
  // เสี่ยงต่ำกว่าเก้าทัพ
  const ev = prepareEvent(ctx, 'war2330.front', { actor: hero.id });
  const who = (role: string) => ctx.state.characters[ev.instance.bindings[role] ?? ('' as Character['id'])];
  hero.skills['combat'] = 0;
  const f = riskChance(ctx, hero, ev.options.find((o) => o.id === 'front')!.risk!, who);
  const o = riskChance(ctx, hero, ev.options.find((o) => o.id === 'orders')!.risk!, who);
  const nine = prepareEvent(ctx, 'war2328.front', { actor: hero.id });
  const nf = riskChance(ctx, hero, nine.options.find((x) => x.id === 'front')!.risk!, (role) => ctx.state.characters[nine.instance.bindings[role] ?? ('' as Character['id'])]);
  if (!(f < nf * 0.7) || f < 0.04 || o > 0.06 || o < 0.04) problems.push(`ความเสี่ยงท่าดินแดง front ${f.toFixed(2)} ควรต่ำกว่าเก้าทัพ ${nf.toFixed(2)} มาก · orders ${o.toFixed(2)} (คาด 0.05)`);
  if (Math.abs(substituteDeathChance(hero, 'tha_din_daeng') - 0.05) > 0.011) problems.push('ความเสี่ยงของคนที่ถูกส่งแทนท่าดินแดงควร ~5%');
  // ข่าวชัย วันที่ 54 ของ 2330
  ctx.state.meta.day = yearStart(ctx, 2330) + 52;
  const logs = advanceDay(ctx).flatMap((sig) => (sig.type === 'log' ? [sig.line] : []));
  if (!logs.some((l) => l.includes('ท่าดินแดง'))) problems.push('ไม่มีข่าวชัยท่าดินแดง');
  // คนในเรือนที่ถูกเกณฑ์ ไม่ถูกสุ่มตายตอน shock ปี 2330
  const { c: sc, h: sh } = mk(83, yearStart(yc, 2330));
  sc.state.meta.campaigns = { tha_din_daeng: { mode: 'pay' } };
  const men = Array.from({ length: 80 }, (_, i) => spawnCharacter(sc, { name: `ชาย${i}`, sex: 'm', birthYear: 2295, estate: 'noble', dynastyId: sh.dynastyId, householdId: sh.householdId }));
  applyHistoricalShocks(sc, 2330);
  if (men.some((m) => !isAlive(m))) problems.push('คนในเรือนที่ถูกเกณฑ์ท่าดินแดงถูกสุ่มตายตอน shock');
  check('ศึกท่าดินแดง', problems);
  if (failed === before) console.log(`  ✓ หมายเกณฑ์วันที่ 300 ของ 2329 · แยก campaigns ของเก้าทัพ · แนวหน้า ${f.toFixed(2)} (เก้าทัพ ${nf.toFixed(2)}) คำสั่ง ${o.toFixed(2)} · ข่าวชัยวันที่ 54 ของ 2330 · เรือนที่ถูกเกณฑ์ไม่ถูกสุ่มตาย`);
}

// [5h2j2] event ยุค รอบ 2 (docs/design-eras.md หัวข้อ 7): ทัพทวาย 2335–2336, ทัพญวน 2376–2377, ตั้วเหี่ย 2391, เวรในวัง 2394
{
  const before = failed;
  console.log('event ยุค รอบ 2 (ทวาย ญวน ตั้วเหี่ย เวรในวัง):');
  const problems: string[] = [];
  const mk = (seed: number, day: number, office = false) => {
    const c = makeCtx(emptyState(seed), content);
    const h = bootstrapScenario(c);
    h.sex = 'm';
    h.social.estate = 'noble';
    c.state.households[h.householdId!]!.headId = h.id;
    c.state.meta.day = day;
    h.birthDay = day - yearsToDays(30);
    if (office) applyCareer(c, h, 'enter_dept', 'patrol');
    return { c, h };
  };
  const yc = mk(84, 0).c;
  /** event ที่ขึ้นเมื่อเดินจากวันก่อนหน้าเข้าวันที่ day ของปี (นับจาก 1 ม.ค. = 0) */
  const eventsOn = (year: number, day: number, office = false, prep?: (c: Ctx, h: Character) => void) => {
    const { c, h } = mk(85, yearStart(yc, year) + day - 1, office);
    prep?.(c, h);
    return advanceDay(c).flatMap((sig) => (sig.type === 'event' ? [sig.prepared.def.id] : []));
  };
  const logsOn = (c: Ctx, year: number, day: number) => {
    c.state.meta.day = yearStart(c, year) + day - 1;
    return advanceDay(c).flatMap((sig) => (sig.type === 'log' ? [sig.line] : []));
  };

  // ทวาย: หมายปลาย 2335 → กลางป่า 2336 วันที่ 20 → ถอยทัพวันที่ 70
  if (!eventsOn(2335, 330).includes('war2336.levy')) problems.push('หมายเกณฑ์ทัพทวายไม่มาวันที่ 330 ของ 2335');
  const { c: tc, h: th } = mk(86, yearStart(yc, 2335) + 330);
  th.social.wealth = 500;
  const tp = purse(tc, th);
  chooseOption(tc, prepareEvent(tc, 'war2336.levy', { actor: th.id }), 'pay');
  if (tc.state.meta.campaigns?.tavoy?.mode !== 'pay' || tc.state.meta.campaigns?.tha_din_daeng || tc.state.meta.campaigns?.nine_armies) problems.push('จ่ายแทนทวายไม่บันทึกใน campaigns.tavoy หรือไปเขียนทับศึกอื่น');
  if (Math.abs(tp - purse(tc, th) - 8) > 0.6) problems.push('จ่ายแทนทวายควรหัก 8 ตำลึง');
  chooseOption(tc, prepareEvent(tc, 'war2336.levy', { actor: th.id }), 'serve');
  tc.state.meta.day = yearStart(tc, 2336) + 19;
  if (!advanceDay(tc).some((sig) => sig.type === 'event' && sig.prepared.def.id === 'war2336.march')) problems.push('ไปทัพทวายเองแล้วไม่มี event กลางป่า');
  if (!logsOn(tc, 2336, 70).some((l) => l.includes('ถอยกลับจากทวาย'))) problems.push('ไม่มีข่าวถอยทัพจากทวาย');
  if (Math.abs(substituteDeathChance(th, 'tavoy') - SUBSTITUTE_FLOOR) > 0.011) problems.push('คนที่ส่งไปทวายแทนควรเสี่ยงราวขอบล่าง 5%');

  // ญวน: ขุนนางได้หมายคุมพล (วันที่ 295) แล้วไม่ได้หมายไพร่ซ้ำ · คนไม่มีตำแหน่งได้หมายไพร่ (วันที่ 300)
  if (!eventsOn(2376, 295, true).includes('war2376.muster')) problems.push('ขุนนางไม่ได้หมายคุมพลไปทัพญวน');
  if (eventsOn(2376, 295, false).includes('war2376.muster')) problems.push('คนไม่มีตำแหน่งได้หมายคุมพลของขุนนาง');
  if (!eventsOn(2376, 300, false).includes('war2376.levy')) problems.push('หมายเกณฑ์ทัพญวนไม่มาวันที่ 300');
  const mustered = eventsOn(2376, 300, true, (c, h) => chooseOption(c, prepareEvent(c, 'war2376.muster', { actor: h.id }), 'steady'));
  if (mustered.includes('war2376.levy')) problems.push('ขุนนางที่คุมพลไปแล้วยังได้หมายไพร่ซ้ำ');
  const { c: ac, h: ah } = mk(87, yearStart(yc, 2376) + 300, true);
  chooseOption(ac, prepareEvent(ac, 'war2376.muster', { actor: ah.id }), 'rush');
  if (ac.state.meta.campaigns?.annam?.mode !== 'self') problems.push('เร่งคุมพลไปแล้วไม่นับว่าไปทัพเอง');
  ac.state.meta.day = yearStart(ac, 2377) + 29;
  if (!advanceDay(ac).some((sig) => sig.type === 'event' && sig.prepared.def.id === 'war2376.front')) problems.push('ไปทัพญวนเองแล้วไม่มี event สนามรบ');
  if (!logsOn(ac, 2377, 90).some((l) => l.includes('ญวน'))) problems.push('ไม่มีข่าวจบศึกญวน');
  // shock ญวนย้ายไปวันที่ 330 — เรือนที่รับหมายแล้วไม่ถูกสุ่มตาย
  const { c: sc, h: sh } = mk(88, yearStart(yc, 2376) + 330);
  sc.state.meta.campaigns = { annam: { mode: 'pay' } };
  const men = Array.from({ length: 80 }, (_, i) => spawnCharacter(sc, { name: `ชาย${i}`, sex: 'm', birthYear: 2346, estate: 'noble', dynastyId: sh.dynastyId, householdId: sh.householdId }));
  applyHistoricalShocks(sc, 2376, 330);
  if (men.some((m) => !isAlive(m))) problems.push('คนในเรือนที่รับหมายทัพญวนถูกสุ่มตายตอน shock');
  if (content.history.find((h) => h.tag === 'history:annam_war_2376')?.day !== 330) problems.push('shock ทัพญวนต้องอยู่วันที่ 330 (หลังหมายเกณฑ์)');

  // ตั้วเหี่ย 2391: ทุกคน 16+ · ตัวเลือกคุมคนไปปราบเฉพาะผู้มีตำแหน่ง
  if (!eventsOn(2391, 99).includes('riot2391.news')) problems.push('ข่าวตั้วเหี่ยไม่มาวันที่ 99 ของ 2391');
  const { c: rc, h: rh } = mk(89, yearStart(yc, 2391) + 99);
  const riot = prepareEvent(rc, 'riot2391.news', { actor: rh.id });
  if (riot.options.some((o) => o.id === 'suppress') && !riot.locked.has('suppress')) problems.push('คนไม่มีตำแหน่งเลือกคุมคนไปปราบตั้วเหี่ยได้');
  if (!((content.history.find((h) => h.tag === 'history:tua_hia_chachoengsao')?.day ?? 0) > 99)) problems.push('shock ตั้วเหี่ยต้องมาหลังข่าว (วันที่ 99)');

  // เวรในวัง 2394: เฉพาะผู้มีตำแหน่ง
  if (!eventsOn(2394, 75, true).includes('court2394.watch')) problems.push('ขุนนางไม่ได้เวรในวัง 2394');
  if (eventsOn(2394, 75, false).includes('court2394.watch')) problems.push('คนไม่มีตำแหน่งได้เวรในวัง');

  // ข้อความครบ ไม่มี {ตัวแปร} ค้าง
  const text = load('text.th.json') as Record<string, string>;
  for (const id of ['war2336.levy', 'war2336.levy_f', 'war2336.levy_old', 'war2336.march', 'war2376.muster', 'war2376.levy', 'war2376.levy_f', 'war2376.levy_old', 'war2376.front', 'riot2391.news', 'court2394.watch']) {
    const v = eventView(rc, prepareEvent(rc, id, { actor: rh.id }), text);
    if (!v.title || v.title.includes('event.') || /\{[a-z]+\}/.test(v.text) || v.options.some((o) => o.text.includes('event.') || /\{[a-z]+\}/.test(o.text))) problems.push(`ข้อความ ${id} ไม่ครบ`);
  }
  check('event ยุค รอบ 2', problems);
  if (failed === before) console.log('  ✓ ทวาย: หมาย/กลางป่า/ถอยทัพ แยก campaigns · ญวน: ขุนนางคุมพลแล้วไม่ได้หมายซ้ำ สนามรบ ข่าวจบ shock วันที่ 330 ไม่สุ่มตายเรือนที่รับหมาย · ตั้วเหี่ยวันที่ 99 ปราบได้เฉพาะขุนนาง · เวรในวังเฉพาะขุนนาง · ข้อความครบ');
}

// [5h2k] ศึกเก้าทัพ/ท่าดินแดง: ข้อความของทุก event และตัวเลือกครบ ชื่อคนในตัวเลือกส่งแทนถูกแทนที่ ไม่มี {ตัวแปร} ค้าง
{
  const before = failed;
  console.log('ข้อความศึกเก้าทัพ:');
  const problems: string[] = [];
  const text = load('text.th.json') as Record<string, string>;
  const ctx = makeCtx(emptyState(90), content);
  const hero = bootstrapScenario(ctx);
  hero.sex = 'm';
  ctx.state.households[hero.householdId!]!.headId = hero.id;
  ctx.state.meta.day = yearStart(ctx, 2328) + 335;
  hero.social.wealth = 500;
  ctx.state.households[hero.householdId!]!.retainers = { that: 2, phrai: 0, loyalty: 0.5 };
  spawnCharacter(ctx, { name: 'ลูกชายคนโต', sex: 'm', birthYear: 2308, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
  spawnCharacter(ctx, { name: 'น้องชายพ่อ', sex: 'm', birthYear: 2295, estate: 'noble', dynastyId: hero.dynastyId, householdId: hero.householdId });
  ctx.state.meta.campaigns = { nine_armies: { mode: 'self', soldier: hero.id, stocked: true }, tha_din_daeng: { mode: 'self', soldier: hero.id } };
  const ids = Object.keys(content.events).filter((id) => /^war23(28|30)./.test(id));
  if (ids.length !== 10) problems.push(`event ศึกเก้าทัพ/ท่าดินแดงควรมี 10 ตัว มี ${ids.length}`);
  let rendered = 0;
  for (const id of ids) {
    const p = prepareEvent(ctx, id, { actor: hero.id, ...campaignBindings(ctx, hero, ['son', 'kin']) });
    const v = eventView(ctx, p, text);
    if (v.title === id) problems.push(`${id}: ไม่มีชื่อ event`);
    if (!v.text || v.text === p.def.textKey || /[{}]/.test(v.text)) problems.push(`${id}: ข้อความหลักไม่ครบ/มีตัวแปรค้าง: ${v.text.slice(0, 60)}`);
    for (const o of v.options) {
      if (!o.text || o.text.startsWith('event.') || /[{}]/.test(o.text)) problems.push(`${id}.${o.id}: ข้อความตัวเลือกไม่ครบ: ${o.text}`);
    }
    if (v.options.length === 0) problems.push(`${id}: ไม่มีตัวเลือก`);
    rendered++;
    // คำเตือนความเสี่ยงต้องตรงความหมายของตัวเลือก (เคยมี regex ทำให้ "หลบ" ขึ้นคำเตือนของ "ขอผ่อนผัน")
    for (const [opt, word] of [['dodge', 'จับได้'], ['plead', 'ปฏิเสธ']] as const) {
      const o = v.options.find((x) => x.id === opt);
      if (o && !o.hint?.includes(word)) problems.push(`${id}.${opt}: คำเตือนควรมีคำว่า "${word}" ได้ "${o.hint}"`);
    }
    if (id === 'war2328.levy') {
      const send = v.options.find((o) => o.id === 'send_son');
      if (!send?.text.includes('ลูกชายคนโต')) problems.push(`ตัวเลือกส่งลูกไม่ใส่ชื่อลูก: ${send?.text}`);
      const kin = v.options.find((o) => o.id === 'send_kin');
      if (!kin?.text.includes('น้องชายพ่อ')) problems.push(`ตัวเลือกส่งญาติไม่ใส่ชื่อ: ${kin?.text}`);
    }
  }
  check('ข้อความศึกเก้าทัพ', problems);
  if (failed === before) console.log(`  ✓ ครบ ${rendered} event ชื่อ/ข้อความ/ตัวเลือกไม่มีตัวแปรค้าง · ตัวเลือกส่งแทนใส่ชื่อคนที่ส่ง`);
}

// [5h3] เล่นต่อหลัง 2400: สำรับเหตุการณ์สมมติ — ไม่จั่วก่อน 2400, ไม่ซ้ำจนกว่าสำรับหมด, ห่างกัน 8–15 ปี, deterministic, เซฟได้
{
  const before = failed;
  console.log('เล่นต่อหลัง 2400 (เรื่องสมมติ):');
  const problems: string[] = [];
  const F = content.fiction;
  if (!F) problems.push('rules.json ไม่มี fiction');
  else {
    const run = (seed: number, from: number, to: number) => {
      const c = makeCtx(emptyState(seed), content);
      bootstrapScenario(c);
      const drawn: Array<{ year: number; tag: string }> = [];
      const rngBefore = c.rng.state;
      for (let y = from; y <= to; y++) for (const d of drawFictionEvents(c, y)) drawn.push({ year: y, tag: d.ev.tag });
      return { c, drawn, rngBefore };
    };
    const early = run(70, 2300, 2399);
    if (early.drawn.length || early.c.rng.state !== early.rngBefore || early.c.state.meta.fiction) problems.push('ก่อน 2400 จั่วเหตุการณ์สมมติหรือใช้ rng');
    const a = run(71, 2400, 2800);
    const b = run(71, 2400, 2800);
    if (JSON.stringify(a.drawn) !== JSON.stringify(b.drawn)) problems.push('seed เดียวกันจั่วไม่เหมือนกัน');
    const gaps = a.drawn.slice(1).map((d, i) => d.year - a.drawn[i]!.year);
    if (a.drawn.length < 20 || gaps.some((g) => g < F.gap[0] - 1 || g > F.gap[1] + 1)) problems.push(`ช่วงห่างจั่วผิดปกติ: ${a.drawn.length} ครั้ง ห่าง ${Math.min(...gaps)}–${Math.max(...gaps)} ปี`);
    for (let i = 0; i + F.deck.length <= a.drawn.length; i += F.deck.length) {
      const round = new Set(a.drawn.slice(i, i + F.deck.length).map((d) => d.tag));
      if (round.size !== F.deck.length) { problems.push(`รอบสำรับที่ ${i / F.deck.length + 1} มีใบซ้ำ`); break; }
    }
    // ป้าย "สภาวะ" ของที่เพิ่งจั่วต้องขึ้น แล้วหมดตาม lasts
    const first = a.drawn[a.drawn.length - 1]!;
    const def = F.deck.find((d) => d.tag === first.tag)!;
    if (!activeFiction(a.c, first.year).some((e) => e.tag === first.tag)) problems.push('ป้ายเหตุการณ์สมมติไม่ขึ้นในปีที่จั่ว');
    if (activeFiction(a.c, first.year + (def.lasts ?? 1) + 7).some((e) => e.tag === first.tag && e.year === first.year)) problems.push('ป้ายเหตุการณ์สมมติไม่หมดอายุ');
    if (!isFictionYear(a.c, 2400) || isFictionYear(a.c, 2399)) problems.push('isFictionYear ผิด');
    // เซฟ/โหลด: คัดลอก state กลางทางแล้วจั่วต่อต้องได้ผลเหมือนเดิม
    const mid = run(72, 2400, 2450);
    commitRng(mid.c);
    const clone = makeCtx(JSON.parse(JSON.stringify(mid.c.state)), content);
    const rest1: string[] = [];
    const rest2: string[] = [];
    for (let y = 2451; y <= 2600; y++) {
      rest1.push(...drawFictionEvents(mid.c, y).map((d) => `${y}${d.ev.tag}`));
      rest2.push(...drawFictionEvents(clone, y).map((d) => `${y}${d.ev.tag}`));
    }
    if (JSON.stringify(rest1) !== JSON.stringify(rest2)) problems.push('เซฟแล้วโหลดกลางทาง จั่วต่อไม่เหมือนเดิม');
    // ปีดี (boon) ต้องเพิ่มทรัพย์ ส่วนปีร้ายต้องไม่เพิ่ม; ทุกใบมีป้ายชื่อและบรรทัดเล่า
    for (const d of F.deck) {
      if (!content.tags[d.tag]) problems.push(`ไม่มี tag ${d.tag}`);
      if (!d.note) problems.push(`${d.tag} ไม่มีบรรทัดเล่า`);
    }
    const shockOf = (tag: string) => {
      const c = makeCtx(emptyState(73), content);
      const h = bootstrapScenario(c);
      h.social.wealth = 100;
      c.state.meta.fiction = { next: 2401, bag: [tag], recent: [] };
      applyHistoricalShocks(c, 2401);
      return { wealth: h.social.wealth, stress: h.stress };
    };
    const good = shockOf('fiction:good_harvest');
    const flood = shockOf('fiction:great_flood');
    if (!(good.wealth > 100)) problems.push(`ปีข้าวดีแล้วทรัพย์ไม่เพิ่ม (${good.wealth.toFixed(1)})`);
    if (!(flood.wealth < 100)) problems.push(`น้ำท่วมใหญ่แล้วทรัพย์ไม่ลด (${flood.wealth.toFixed(1)})`);
    if (good.stress < 0 || good.stress > 1) problems.push('ความหนักใจหลุดช่วง 0–1 หลังปีดี');
    check('เล่นต่อหลัง 2400', problems);
    if (failed === before) console.log(`  ✓ ไม่จั่วก่อน 2400 · จั่ว ${a.drawn.length} ครั้งใน 400 ปี ห่าง ${Math.min(...gaps)}–${Math.max(...gaps)} ปี ไม่ซ้ำภายในรอบสำรับ · deterministic และเซฟกลางทางได้ · ปีข้าวดีทรัพย์ 100→${good.wealth.toFixed(0)} · น้ำท่วมใหญ่ →${flood.wealth.toFixed(0)}`);
  }
  if (!F) check('เล่นต่อหลัง 2400', problems);
}

// [5h2f] ศึกพม่า ขั้น 4: ล้อมกรุง ข้าวหมด ฝ่าวงล้อมตามพระยาตาก — เฉพาะคนที่ยังอยู่ในกรุง; เงินสดและการเตรียมตัวมีประโยชน์จริง
{
  const before = failed;
  console.log('ล้อมกรุงและพระยาตาก:');
  const problems: string[] = [];
  const warEventsBetween = (c: Ctx, fromDay: number, days: number) => {
    c.state.meta.day = fromDay;
    const ids: string[] = [];
    for (let i = 0; i < days; i++) for (const sig of advanceDay(c)) if (sig.type === 'event') ids.push(sig.prepared.def.id);
    return ids.filter((id) => id.startsWith('war.'));
  };

  // คนที่ออกไปแล้วไม่ได้ event ล้อมกรุง คนที่ยังอยู่ได้
  const stay = makeCtx(emptyState(54), content);
  const hs = bootstrapScenario(stay);
  hs.sex = 'm';
  const gone = makeCtx(emptyState(54), content);
  const hg = bootstrapScenario(gone);
  hg.sex = 'm';
  gone.state.meta.war = { prep: 0, stance: 'leave', dir: 'east', party: [hg.id] };
  if (!warEventsBetween(stay, yearStart(stay, 2309) + 38, 6).includes('war.siege_begins')) problems.push('คนที่อยู่ในกรุงไม่ได้ event เริ่มล้อมกรุง');
  if (warEventsBetween(gone, yearStart(gone, 2309) + 38, 6).includes('war.siege_begins')) problems.push('คนที่ออกจากกรุงแล้วได้ event ล้อมกรุง');

  // ข้าวหมด: แบ่งข้าวต้องเตรียมตัวไว้ก่อน, ซื้อข้าวต้องมีเงินสด (ไหที่ฝังไว้ใช้ไม่ได้), ไม่มีทั้งสองอย่างเหลือแค่ลอบออกหรืออดทน
  const ctx = makeCtx(emptyState(55), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day = yearStart(ctx, 2309) + 300;
  hero.sex = 'm';
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2285, estate: 'noble', dynastyId: null, householdId: hero.householdId });
  marry(ctx, hero, wife);
  const riceOptions = (actor: Character) => prepareEvent(ctx, 'war.rice_gone', { actor: actor.id }).options.map((o) => o.id).join();
  S.meta.war = { prep: 0 };
  if (riceOptions(hero) !== 'buy,slip,surrender,endure') problems.push(`ไม่ได้เตรียมตัวแต่มีเงิน ได้ตัวเลือก ${riceOptions(hero)}`);
  S.meta.war = { prep: 3 };
  if (riceOptions(hero) !== 'share,buy,slip,surrender,endure') problems.push(`เตรียมตัวไว้และมีเงิน ได้ตัวเลือก ${riceOptions(hero)}`);
  const poor = spawnCharacter(ctx, { name: 'ยาจก', sex: 'm', birthYear: 2280, estate: 'phrai_som', dynastyId: null, householdId: null, wealth: 3 });
  S.meta.war = { prep: 0 };
  if (riceOptions(poor) !== 'slip,surrender,endure') problems.push(`ไม่มีทั้งข้าวและเงิน ได้ตัวเลือก ${riceOptions(poor)}`);
  // ฝังเงินไว้หมดแล้วซื้อข้าวไม่ได้
  hero.social.wealth = 0;
  const father = S.characters[S.households[hero.householdId!]!.headId]!;
  const buried = purse(ctx, hero);
  buryValuables(ctx, hero, 1);
  if (purse(ctx, hero) > 1 || buried < 20) problems.push(`ฝังเงินจนหมดแล้วเงินที่ใช้ได้ยังเหลือ ${purse(ctx, hero)} (ก่อนฝัง ${buried}) ${father.name}`);
  S.meta.war = { prep: 0 };
  if (riceOptions(hero).includes('buy')) problems.push('เงินฝังไว้หมดแล้วยังซื้อข้าวได้');

  // ลอบออกจากกรุง: สำเร็จ → ออกไปกับคนใกล้ชิด · พลาด → ยังอยู่ในกรุง; ผลทั้งสองแบบต้องเกิดได้
  let slipped = 0;
  let caught = 0;
  for (let i = 0; i < 80 && !(slipped && caught); i++) {
    hero.social.wealth = 100;
    S.meta.war = { prep: 0, stance: 'stay' };
    chooseOption(ctx, prepareEvent(ctx, 'war.rice_gone', { actor: hero.id }), 'slip');
    if (S.meta.war?.stance === 'leave') {
      slipped++;
      const party = S.meta.war.party ?? [];
      if (!party.includes(hero.id) || !party.includes(wife.id) || S.meta.war.dir !== 'east') problems.push('ลอบออกสำเร็จแต่รายชื่อ/ทิศไม่ถูก');
    } else caught++;
  }
  if (!slipped || !caught) problems.push(`ลอบออก 80 ครั้ง สำเร็จ ${slipped} พลาด ${caught} — ต้องเกิดได้ทั้งสองแบบ`);

  // การเตรียมตัวลดความเสี่ยงตายของคนในกรุง (สูงสุด 40%) ไม่มีผลกับคนที่ออกไปแล้ว
  S.meta.war = { prep: 0 };
  const m0 = warDeathMult(ctx, hero.id);
  S.meta.war = { prep: 5 };
  const m5 = warDeathMult(ctx, hero.id);
  S.meta.war = { prep: 50 };
  const mMax = warDeathMult(ctx, hero.id);
  S.meta.war = { prep: 5, stance: 'leave', dir: 'east', party: [hero.id] };
  const mEast = warDeathMult(ctx, hero.id);
  if (Math.abs(m0 - 1) > 1e-9 || Math.abs(m5 - 0.6) > 1e-9 || Math.abs(mMax - 0.6) > 1e-9) problems.push(`ตัวคูณความเสี่ยงของคนในกรุง prep 0/5/50 = ${m0}/${m5}/${mMax} (ควร 1/0.6/0.6)`);
  if (Math.abs(mEast - 0.3) > 1e-9) problems.push(`คนที่หนีตะวันออกได้ตัวคูณ ${mEast} ควร 0.3 (prep ไม่เกี่ยว)`);

  // ฝ่าวงล้อมตามพระยาตาก: เฉพาะชายอายุ 18–45 ที่มีทักษะรบ ≥ 10 และยังอยู่ในกรุง
  const bo = makeCtx(emptyState(56), content);
  const hb = bootstrapScenario(bo);
  hb.sex = 'm';
  hb.skills['combat'] = 0;
  if (warEventsBetween(bo, yearStart(bo, 2310) + 4, 6).includes('war.taksin_breakout')) problems.push('ไม่มีทักษะรบแต่ได้ event ตามพระยาตาก');
  hb.skills['combat'] = 20;
  if (!warEventsBetween(bo, yearStart(bo, 2310) + 4, 6).includes('war.taksin_breakout')) problems.push('ชายมีทักษะรบไม่ได้ event ตามพระยาตาก');
  let ok = 0;
  let dead = 0;
  for (let i = 0; i < 200 && !(ok && dead); i++) {
    bo.state.meta.war = { prep: 0, stance: 'stay' };
    hb.deathDay = null;
    hb.deathCause = null;
    chooseOption(bo, prepareEvent(bo, 'war.taksin_breakout', { actor: hb.id }), 'follow');
    if (!isAlive(hb)) dead++;
    else if (bo.state.meta.war?.taksin && bo.state.meta.war.party?.length === 1 && bo.state.meta.war.dir === 'east') ok++;
  }
  if (!ok || !dead) problems.push(`ตามพระยาตาก 200 ครั้ง รอด ${ok} ตาย ${dead} — ต้องเกิดได้ทั้งสองแบบ`);

  // ผู้ที่ตามพระยาตากได้ความโปรดปรานในราชการช่วง 2311–2324
  const cr = makeCtx(emptyState(57), content);
  const hc = bootstrapScenario(cr);
  hc.sex = 'm';
  hc.social.estate = 'noble';
  delete hc.office;
  applyCareer(cr, hc, 'enter_dept', 'patrol');
  const favorAfterTick = (taksin: boolean) => {
    cr.state.meta.day = yearStart(cr, 2312) + 100;
    cr.state.meta.war = { prep: 0, ...(taksin ? { taksin: true } : {}) };
    hc.office!.favor = 0;
    careerYearTick(cr);
    return hc.office!.favor;
  };
  const withTaksin = favorAfterTick(true);
  const without = favorAfterTick(false);
  if (!(withTaksin > without + 0.1)) problems.push(`ตามพระยาตากแล้วความโปรดปรานช่วง 2312 ไม่เพิ่ม (${without.toFixed(2)} → ${withTaksin.toFixed(2)})`);
  check('ล้อมกรุงและพระยาตาก', problems);
  if (failed === before) console.log('  ✓ คนที่ออกไปแล้วไม่ได้ event ล้อมกรุง · ข้าวหมด: แบ่งข้าว/ซื้อข้าว/ลอบออกต่างเงื่อนไข เงินที่ฝังซื้อข้าวไม่ได้ · เตรียมตัวลดความเสี่ยงสูงสุด 40% · ตามพระยาตากรอด/ตายได้ ได้ความโปรดปรานช่วงธนบุรี');
}

// [5h3] ข้อแลกเปลี่ยนใน event ที่เจอบ่อย: งานบุญและผลผูกมิตรต้องมีตัวเลือกที่เสียเงินกับตัวเลือกที่ไม่เสีย และเสียแล้วเงินลดจริง
{
  const before = failed;
  console.log('ข้อแลกเปลี่ยนใน event ที่เจอบ่อย:');
  const ctx = makeCtx(emptyState(45), content);
  const hero = bootstrapScenario(ctx);
  ctx.state.meta.day += yearsToDays(12);
  hero.sex = 'm';
  const target = spawnLocal(ctx, hero, { sex: 'm', age: 20, distance: 'near' });
  const problems: string[] = [];
  const costOf = (o: { effects: Array<{ op: string; role?: string; delta?: number }> }) =>
    -o.effects.filter((e) => e.op === 'wealth' && e.role === 'actor').reduce((a, e) => a + (e.delta ?? 0), 0);
  for (const id of ['festival.holy_day', 'festival.temple_fair', 'festival.lanterns', 'intent.befriend.done', 'intent.befriend.failed']) {
    const p = prepareEvent(ctx, id, { actor: hero.id, target: target.id });
    const costs = p.options.map(costOf);
    if (p.options.length < 2) problems.push(`${id} มีตัวเลือกเดียว ผู้เล่นไม่ได้ตัดสินใจ`);
    if (!costs.some((c) => c > 0) || !costs.some((c) => c <= 0)) problems.push(`${id} ไม่มีทั้งตัวเลือกที่เสียเงินและไม่เสียเงิน`);
  }
  hero.social.wealth = 10;
  setRelation(ctx, hero.id, target.id, 'acquaintance', 0.5);
  const done = prepareEvent(ctx, 'intent.befriend.done', { actor: hero.id, target: target.id });
  chooseOption(ctx, done, 'feast');
  if (Math.abs(hero.social.wealth - 9) > 0.001) problems.push(`เลี้ยงฉลองเพื่อนแล้วเงินไม่ลด 1 ตำลึง (${hero.social.wealth})`);
  // คำใบ้บอกการได้วิชา (ของตัวเองและของลูก) และเงินที่ได้ — ไม่งั้นฝั่ง "ได้" ของข้อแลกเปลี่ยนมองไม่เห็น
  const text = load('text.th.json') as Record<string, string>;
  const kid = spawnCharacter(ctx, { name: 'บุญมี', sex: 'm', birthYear: yearOf(ctx, ctx.state.meta.day) - 6, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
  const hintOf = (id: string, opt: string, b: Record<string, string>) =>
    eventView(ctx, prepareEvent(ctx, id, { actor: hero.id, ...b }, { moon: 'moon:full' }), text).options.find((o) => o.id === opt)?.hint ?? '';
  const holyChild = hintOf('festival.holy_day', 'child', { child: kid.id });
  if (!holyChild.includes('บุญมีได้ฝึก') || !holyChild.includes('เสียเงิน 0.3')) problems.push(`วันพระ พาลูกไปวัด: คำใบ้ไม่บอกว่าลูกได้ฝึกวิชา/เสียเงิน (${holyChild})`);
  const fish = hintOf('festival.holy_day', 'fish', { child: kid.id });
  if (!fish.includes('ได้เงิน 0.3')) problems.push(`วันพระ หาปลา: คำใบ้ไม่บอกว่าได้เงิน (${fish})`);
  const spar = hintOf('skill.muay_sparring', 'spar', {});
  if (!spar.startsWith('ได้ฝึก')) problems.push(`ซ้อมมวย: คำใบ้ไม่บอกว่าได้ฝึกวิชา (${spar})`);
  const bath = hintOf('festival.bathing', 'temple', { parent: hero.id });
  if (!bath.includes('ได้บุญ') || !bath.includes('เสียเงิน')) problems.push(`รดน้ำผู้ใหญ่ ไปวัดก่อน: คำใบ้ไม่ครบ (${bath})`);
  check('ข้อแลกเปลี่ยนใน event ที่เจอบ่อย', problems);
  if (failed === before) console.log(`  ✓ งานบุญและผลผูกมิตรมีทั้งตัวเลือกเสียเงินและไม่เสีย · เสียแล้วเงินลดจริง · คำใบ้: "${holyChild}" / "${fish}" / "${spar}"`);
}

// [5h3b] ตัวเลือกแพ้ขาด (docs/design-tradeoffs.md): event ที่ผู้เล่นเจอ ≥ 1% ต้องไม่มีตัวเลือกที่อีกตัวเลือกดีกว่าหรือเท่ากันทุกด้าน
// และดีกว่าอย่างน้อยหนึ่งด้าน — เทียบเฉพาะผลที่เป็นตัวเลข; ตัวเลือกที่มีผลชนิดอื่น (แต่งงาน ตั้งชื่อ ความสัมพันธ์ ฯลฯ) หรือไม่มีผลเลย ไม่เอามาเทียบ
{
  const before = failed;
  console.log('ตัวเลือกแพ้ขาดใน event ที่เจอบ่อย:');
  /** ตั้งใจให้มีตัวเลือกชนะขาด — ใส่เหตุผลทุกข้อ */
  const ALLOW: Record<string, string> = {};
  const total = Object.values(seenEvents).reduce((a, n) => a + n, 0);
  const frequent = Object.entries(seenEvents).filter(([, n]) => n / total >= 0.01).map(([id]) => id);
  const NUMERIC = new Set(['wealth', 'merit', 'stress', 'skill', 'favor', 'prestige', 'bond']);
  type Opt = (typeof content.events)[string]['options'][number];
  /** ค่าบวก = ดี */
  const score = (o: Opt): Record<string, number> | undefined => {
    if (!o.effects.length || o.effects.some((e) => !NUMERIC.has(e.op))) return undefined;
    const v: Record<string, number> = { wealth: 0, merit: 0, calm: 0, skillSelf: 0, skillOther: 0, favor: 0, prestige: 0, bond: 0, safe: -(o.risk?.base ?? 0) };
    for (const e of o.effects as Array<{ op: string; role?: string; delta?: number; affection?: number; perSakdina?: number }>) {
      if (e.op === 'wealth') v.wealth! += (e.delta ?? 0) + (e.perSakdina ?? 0) * 400; // ศักดินา 400 = ขุนนางผู้น้อยราวกลางเกม (ใช้แค่เทียบทิศทาง)
      else if (e.op === 'merit') v.merit! += e.delta ?? 0;
      else if (e.op === 'stress') v.calm! -= e.delta ?? 0;
      else if (e.op === 'skill') v[e.role === 'actor' ? 'skillSelf' : 'skillOther']! += e.delta ?? 0;
      else if (e.op === 'favor') v.favor! += e.delta ?? 0;
      else if (e.op === 'prestige') v.prestige! += e.delta ?? 0;
      else if (e.op === 'bond') v.bond! += e.affection ?? 0;
    }
    return v;
  };
  const problems: string[] = [];
  for (const id of frequent) {
    if (ALLOW[id]) continue;
    const opts = content.events[id]!.options.map((o) => ({ id: o.id, v: score(o) })).filter((o) => o.v);
    for (const a of opts) for (const b of opts) {
      if (a === b) continue;
      const keys = Object.keys(a.v!);
      if (keys.every((k) => b.v![k]! >= a.v![k]! - 1e-9) && keys.some((k) => b.v![k]! > a.v![k]! + 1e-9)) problems.push(`${id}: "${b.id}" ดีกว่า "${a.id}" ทุกด้าน`);
    }
  }
  check('ตัวเลือกแพ้ขาด', problems);
  if (failed === before) console.log(`  ✓ event ที่เจอ ≥ 1% (${frequent.length} ชนิด) ไม่มีตัวเลือกแพ้ขาด`);
}

// [5h4] ชั้นยุค (docs/design-eras.md): ยุคต่อกันครบช่วงเกม, เงื่อนไขปี/ยุค, สถาบันยังมีผลตลอด 2288–2400 (ช่องเสียบ),
// ข้าวแจกที่ธนบุรีออกเฉพาะ 2311–2312, เลือกข้างตอนผลัดแผ่นดิน 2325 ก่อน shock (ลงกลางปี) และฝ่ายพระยาสรรค์ถูกกวาดล้าง
{
  const before = failed;
  console.log('ชั้นยุค:');
  const problems: string[] = [];
  const eras = content.eras;
  if (eras[0]!.from > 2288 || eras[eras.length - 1]!.to < END_YEAR) problems.push(`ยุคไม่ครอบคลุม 2288–${END_YEAR}`);
  for (let i = 1; i < eras.length; i++) if (eras[i]!.from !== eras[i - 1]!.to) problems.push(`ยุค ${eras[i - 1]!.id} → ${eras[i]!.id} ไม่ต่อกัน`);
  const eraIds = new Set(eras.map((e) => e.id));
  for (const d of Object.values(content.events)) {
    const conds = [...(d.trigger.requires ?? []), ...d.options.flatMap((o) => o.conditions ?? [])];
    for (const c of conds) {
      if (c.type === 'era') for (const id of c.in) if (!eraIds.has(id)) problems.push(`${d.id}: ไม่มียุค ${id}`);
      if (c.type === 'year' && ((c.max ?? Infinity) < 2288 || (c.min ?? -Infinity) > END_YEAR)) problems.push(`${d.id}: เงื่อนไขปีอยู่นอกช่วงเกม`);
    }
  }
  const ctx = makeCtx(emptyState(77), content);
  const hero = bootstrapScenario(ctx);
  hero.sex = 'm';
  const at = (year: number, day = 0) => { ctx.state.meta.day = yearStart(ctx, year) + day; };
  for (const y of [2290, 2350, 2399]) for (const id of ['slavery', 'corvee', 'sakdinaIncome'] as const) {
    at(y);
    if (!institutionActive(ctx, id)) problems.push(`${id} ไม่มีผลปี ${y} (ช่องเสียบต้องยังเปิดอยู่)`);
  }
  at(2381); if (institutionActive(ctx, 'inoculation')) problems.push('ปลูกฝีมีก่อน 2382');
  at(2382); if (!institutionActive(ctx, 'inoculation')) problems.push('ปลูกฝีไม่มีปี 2382');
  at(2320); if (eraAt(ctx).id !== 'thonburi') problems.push(`ปี 2320 ไม่อยู่ยุคธนบุรี (${eraAt(ctx).id})`);
  const dole = content.events['thonburi.rice_dole']!;
  for (const [y, want] of [[2310, false], [2311, true], [2312, true], [2313, false]] as const) {
    at(y, 100);
    if (requirementsMet(ctx, dole, hero, { actor: hero.id }) !== want) problems.push(`ข้าวแจก ปี ${y}: ควร${want ? '' : 'ไม่'}ออก`);
  }
  // เลือกข้าง 2325: ต้องมีตำแหน่ง; event มาวันที่นัด (90) ก่อน shock (120)
  const shock = content.history.find((h) => h.tag === 'history:thonburi_succession')!;
  const sched = content.historyEvents.find((h) => h.event === 'thonburi.succession_side')!;
  if (!(sched.year === shock.year && sched.day < (shock.day ?? 0))) problems.push('event เลือกข้างไม่ได้มาก่อน shock ผลัดแผ่นดิน');
  at(2325, sched.day);
  hero.birthDay = ctx.state.meta.day - yearsToDays(30);
  if (historyEventsToday(ctx).some((p) => p.def.id === 'thonburi.succession_side')) problems.push('คนไม่มีตำแหน่งได้ event เลือกข้าง');
  applyCareer(ctx, hero, 'enter_dept', 'patrol');
  const side = historyEventsToday(ctx).find((p) => p.def.id === 'thonburi.succession_side');
  if (!side) problems.push('ข้าราชการไม่ได้ event เลือกข้างปี 2325');
  else chooseOption(ctx, side, 'san');
  const dyn = ctx.state.dynasties[hero.dynastyId!]!;
  if (dyn.faction !== 'faction:phraya_san') problems.push(`เลือกฝ่ายพระยาสรรค์แล้วตระกูลไม่เป็นฝ่ายนั้น (${dyn.faction})`);
  // shock ลงวันที่ 120 ผ่าน advanceDay (ลงกลางปี) — กวาดล้างตามโอกาส ทอยหลายรอบให้เห็นผล
  let purged = 0;
  const N = 40;
  for (let i = 0; i < N; i++) {
    hero.social.wealth = 100;
    hero.social.title ??= 'หมื่นทดสอบ';
    dyn.faction = 'faction:phraya_san';
    at(2325, (shock.day ?? 0) - 1);
    const sigs = advanceDay(ctx);
    if (i === 0 && !sigs.some((g) => g.type === 'log' && g.kind === 'history')) problems.push('shock ผลัดแผ่นดินไม่ลงกลางปีผ่าน advanceDay');
    if (hero.social.wealth <= 20) purged++;
    if (!isAlive(hero)) break;
  }
  if (purged < N * 0.4 || purged > N * 0.95) problems.push(`ฝ่ายพระยาสรรค์ถูกกวาดล้าง ${purged}/${N} (ควรราว 70%)`);
  // ข้อความของ event ยุคธนบุรีครบ ไม่มีตัวแปรค้าง
  const text = load('text.th.json') as Record<string, string>;
  at(2311, 100);
  for (const id of ['thonburi.rice_dole', 'thonburi.succession_side']) {
    const v = eventView(ctx, prepareEvent(ctx, id, { actor: hero.id }), text);
    if (v.title === id || !v.text || /[{}]/.test(v.text) || v.options.some((o) => !o.text || /[{}]|^event\./.test(o.text))) problems.push(`${id}: ข้อความไม่ครบ`);
  }
  check('ชั้นยุค', problems);
  if (failed === before) console.log(`  ✓ ${eras.length} ยุคต่อกัน · เงื่อนไขปี/ยุค · สถาบันยังเปิด · ข้าวแจกเฉพาะ 2311–2312 · เลือกข้างก่อน shock · ฝ่ายพระยาสรรค์ถูกกวาดล้าง ${purged}/${N}`);
}

// [5h4d] ไปทัพเองไม่อยู่บ้าน (BACKLOG 2026-11-07 → PLAN ข้อ 5): ตั้งแต่รับหมายว่าไปเองจนศึกจบ ไม่มี event งานบ้าน งานวัด ทาบทาม เฝ้าไข้
//  เทียบกับเรือนที่จ่ายแทน (อยู่บ้าน) ในช่วงวันเดียวกัน — ต้องมี event บ้านเกิดบ้าง ไม่งั้นตัวตรวจนี้ไม่ได้ตรวจอะไร
{
  const before = failed;
  console.log('ไปทัพเองไม่อยู่บ้าน:');
  const problems: string[] = [];
  const end = content.historyEvents.find((h) => h.resolve === 'nine_armies')!;
  const run = (seed: number, mode: 'serve' | 'pay') => {
    const ctx = makeCtx(emptyState(seed), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = 'm';
    hero.social.wealth = 500;
    ctx.state.meta.day = yearStart(ctx, 2328) + 335;
    hero.birthDay = ctx.state.meta.day - yearsToDays(25);
    chooseOption(ctx, prepareEvent(ctx, 'war2328.levy', { actor: hero.id }), mode);
    const home: string[] = [];
    let awayDays = 0;
    const last = yearStart(ctx, end.year) + end.day;
    while (ctx.state.meta.day < last - 1 && isAlive(hero) && ctx.state.meta.playerCharacterId === hero.id) {
      const sigs = advanceDay(ctx);
      checkWhereabouts(ctx, sigs);
      if (atWar(ctx, hero)) awayDays++;
      for (const s of sigs) {
        if (s.type !== 'event' && s.type !== 'habit') continue;
        const id = s.prepared.def.id;
        if (!/^(war2328\.|body\.)/.test(id)) home.push(id);
      }
    }
    // วันศึกจบแล้วต้องกลับบ้าน
    ctx.state.meta.day = last;
    const back = !atWar(ctx, hero);
    return { home, awayDays, back };
  };
  let leak: string[] = [];
  let stayHome = 0;
  for (let i = 0; i < 40; i++) {
    const a = run(700 + i, 'serve');
    leak.push(...a.home);
    if (a.awayDays === 0) problems.push(`seed ${700 + i}: ไปเองแล้วไม่นับว่าอยู่ในทัพ`);
    if (!a.back) problems.push(`seed ${700 + i}: ศึกจบแล้วยังนับว่าอยู่ในทัพ`);
    stayHome += run(700 + i, 'pay').home.length;
  }
  leak = [...new Set(leak)];
  if (leak.length) problems.push(`ไปทัพอยู่แต่ได้ event ที่บ้าน: ${leak.join(', ')}`);
  if (stayHome === 0) problems.push('เรือนที่จ่ายแทนไม่ได้ event บ้านเลยในช่วงนี้ — ตัวตรวจไม่ได้ตรวจอะไร');
  check('ไปทัพเองไม่อยู่บ้าน', problems);
  if (failed === before) console.log(`  ✓ ไปทัพ 40 seed ไม่มี event บ้าน · อยู่บ้าน (จ่ายแทน) ช่วงเดียวกันได้ ${stayHome} เรื่อง · ศึกจบแล้วกลับบ้าน`);
}

// [5h4e] ผัวอยู่ในทัพวันทอยตั้งครรภ์ (1 ม.ค.) → เมียไม่ตั้งครรภ์ปีนั้น — ไปเองและส่งไปแทน · เรือนที่จ่ายแทนยังตั้งครรภ์ตามปกติ
{
  const before = failed;
  console.log('เมียไม่ตั้งครรภ์ระหว่างผัวไปทัพ:');
  const problems: string[] = [];
  const N = 300;
  const trial = (seed: number, mode: 'serve' | 'pay' | 'sent') => {
    const ctx = makeCtx(emptyState(seed), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = 'm';
    hero.social.wealth = 500;
    ctx.state.meta.day = yearStart(ctx, 2328) + 335;
    hero.birthDay = ctx.state.meta.day - yearsToDays(28);
    for (const w of livingWives(ctx, hero)) markDead(ctx, w, 'situation:illness');
    const wife = spawnCharacter(ctx, { name: 'เมีย', sex: 'f', birthYear: 2306, estate: hero.social.estate, dynastyId: null, householdId: null });
    marry(ctx, hero, wife, ctx.state.meta.day - yearsToDays(3));
    hero.marriedDay = ctx.state.meta.day - yearsToDays(3); // marry() ไม่ตั้งวันแต่ง (applyMarriageStep ตั้ง)
    if (mode === 'sent') ctx.state.meta.campaigns = { nine_armies: { mode: 'send', soldier: hero.id } }; // ผัวเป็นคนที่ถูกส่งไปแทน (ทางเดียวกับลูก/ญาติ)
    else chooseOption(ctx, prepareEvent(ctx, 'war2328.levy', { actor: hero.id }), mode);
    ctx.state.meta.day = yearStart(ctx, 2329) - 1;
    advanceDay(ctx); // 1 ม.ค. 2329 — วันทอยตั้งครรภ์ ศึกยังไม่จบ (จบวันที่ 47)
    return wife.pregnancy?.memberId === hero.id;
  };
  const count = (mode: 'serve' | 'pay' | 'sent') => Array.from({ length: N }, (_, i) => trial(900 + i, mode)).filter(Boolean).length;
  const serve = count('serve');
  const sent = count('sent');
  const pay = count('pay');
  if (serve > 0) problems.push(`ผัวไปทัพเองแต่เมียตั้งครรภ์ ${serve}/${N}`);
  if (sent > 0) problems.push(`ผัวถูกส่งไปแทนแต่เมียตั้งครรภ์ ${sent}/${N}`);
  if (pay < N * 0.2) problems.push(`เรือนที่จ่ายแทนตั้งครรภ์แค่ ${pay}/${N} (ควรราว 35%) — ตัวตรวจไม่ได้ตรวจอะไร`);
  check('เมียไม่ตั้งครรภ์ระหว่างผัวไปทัพ', problems);
  if (failed === before) console.log(`  ✓ ไปเอง ${serve}/${N} · ถูกส่งไปแทน ${sent}/${N} · จ่ายแทน (อยู่บ้าน) ${pay}/${N}`);
}

// [5h4g] เณรอยู่วัด (ผู้ใช้ลองเล่น 2026-11-07 → PLAN ข้อ 5): ระหว่างเป็นเณรไม่มีงานบ้าน เทศกาล ไปเที่ยว เรื่องสุ่มในเรือน · สึกแล้วกลับมามีตามปกติ
//  เทียบกับเด็กคนเดียวกันที่ไม่ได้เป็นเณร — ต้องมี event บ้านเกิดบ้าง ไม่งั้นตัวตรวจนี้ไม่ได้ตรวจอะไร
{
  const before = failed;
  console.log('เณรอยู่วัด:');
  const problems: string[] = [];
  const W = content.balance.world;
  const run = (seed: number, novice: boolean) => {
    const ctx = makeCtx(emptyState(seed), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = 'm';
    ctx.state.meta.day = yearStart(ctx, 2340);
    hero.birthDay = ctx.state.meta.day - yearsToDays(9) - 100;
    if (novice) hero.noviceUntilYear = 2340 + W.noviceYears;
    const during: string[] = [];
    let after = 0;
    let disrobed = 0;
    let wrongSpan = 0;
    while (ctx.state.meta.day < yearStart(ctx, 2340 + W.noviceYears + 2) && isAlive(hero) && ctx.state.meta.playerCharacterId === hero.id) {
      const sigs = advanceDay(ctx);
      checkWhereabouts(ctx, sigs);
      const inWindow = ctx.state.meta.day < yearStart(ctx, 2340 + W.noviceYears);
      if (novice && isNovice(ctx, hero) !== inWindow) wrongSpan++;
      for (const s of sigs) {
        if (s.type === 'log' && s.line === `${hero.name}สึกจากเณรกลับมาอยู่เรือน`) disrobed++;
        if (s.type !== 'event' && s.type !== 'habit') continue;
        if (inWindow) during.push(s.prepared.def.id);
        else after++;
      }
    }
    return { during, after, disrobed, wrongSpan, lived: isAlive(hero) && ctx.state.meta.playerCharacterId === hero.id };
  };
  const leak = new Set<string>();
  let back = 0;
  let control = 0;
  let atTempleEvents = 0;
  for (let i = 0; i < 30; i++) {
    const n = run(1500 + i, true);
    // ที่ยังเกิดได้: ป่วย/บาดเจ็บของตัวเอง และงานศพคนในตระกูล (เณรกลับมาร่วมงานศพได้) — ที่เหลือคือรั่ว
    for (const id of n.during) if (!/^(body\.|family\.death$|novice\.)/.test(id)) leak.add(id);
    atTempleEvents += n.during.filter((id) => id.startsWith('novice.')).length;
    if (n.wrongSpan) problems.push(`seed ${1500 + i}: isNovice ไม่ตรงช่วงปีที่เป็นเณร ${n.wrongSpan} วัน`);
    if (n.lived && n.disrobed !== 1) problems.push(`seed ${1500 + i}: บรรทัดสึกจากเณรออก ${n.disrobed} ครั้ง (ควร 1)`); // เด็กตายก่อนสึก (ไข้ ฯลฯ) ไม่นับ
    back += n.after;
    const c = run(1500 + i, false);
    control += c.during.length;
    if ([...c.during].some((id) => id.startsWith('novice.'))) problems.push(`seed ${1500 + i}: ไม่ได้เป็นเณรแต่ได้ event เณร`);
  }
  if (leak.size) problems.push(`เป็นเณรอยู่แต่ได้ event ที่บ้าน: ${[...leak].join(', ')}`);
  if (back === 0) problems.push('สึกแล้วไม่กลับมามี event ที่บ้านเลย');
  if (atTempleEvents < 30) problems.push(`ช่วงเป็นเณรได้ event เณรแค่ ${atTempleEvents} เรื่องใน 30 seed`);
  // ขอลาสึกก่อนกำหนด → ไม่เป็นเณรทันที ไม่มีบรรทัดสึกซ้ำตอนปีใหม่
  {
    const ctx = makeCtx(emptyState(11), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = 'm';
    ctx.state.meta.day = yearStart(ctx, 2340) + 100;
    hero.birthDay = ctx.state.meta.day - yearsToDays(9);
    hero.noviceUntilYear = 2340 + W.noviceYears;
    const cg = hero.caregiverIds.map((id) => ctx.state.characters[id]).find(isAlive);
    if (!cg) problems.push('ตัวตรวจลาสึก: ไม่มีคนเลี้ยง');
    else {
      const p = prepareEvent(ctx, 'novice.food', { actor: hero.id, caregiver: cg.id });
      const r = chooseOption(ctx, p, 'go_home');
      if (isNovice(ctx, hero) || !r.notes.some((l) => l.includes('ลาสึก'))) problems.push('ขอลาสึกแล้วยังเป็นเณร/ไม่มีบรรทัดบอก');
      if (!eventView(ctx, p, load('text.th.json') as Record<string, string>).text) problems.push('ข้อความ novice.food ว่าง');
    }
  }
  if (control === 0) problems.push('เด็กที่ไม่ได้เป็นเณรไม่ได้ event เลยในช่วงเดียวกัน — ตัวตรวจไม่ได้ตรวจอะไร');
  // เข้าเป็นเณรตอน 8 ขวบ: ตั้งปีสึก นับว่าโกนจุกแล้ว · ลูกที่เป็นเณรไม่ตามผู้ใหญ่ไปงานบุญ
  {
    const ctx = makeCtx(emptyState(9), content);
    const dad = bootstrapScenario(ctx);
    ctx.state.meta.day = yearStart(ctx, 2340);
    const boy = spawnCharacter(ctx, { name: 'เณรน้อย', sex: 'm', birthYear: 2332, estate: dad.social.estate, father: dad.sex === 'm' ? dad : undefined, mother: dad.sex === 'f' ? dad : undefined });
    const was = companions(ctx, dad).child === boy.id;
    const chance = W.noviceChance;
    W.noviceChance = 1;
    lifeMilestones(ctx);
    W.noviceChance = chance;
    if (boy.noviceUntilYear !== 2340 + W.noviceYears || boy.topknotCutYear === undefined) problems.push(`เข้าเป็นเณรแล้วไม่ตั้งปีสึก/ไม่นับว่าโกนจุก (${boy.noviceUntilYear}, ${boy.topknotCutYear})`);
    if (!was) problems.push('ก่อนเป็นเณร ลูกไม่ได้ตามไปงานบุญ — ตัวตรวจไม่ได้ตรวจอะไร');
    if (companions(ctx, dad).child === boy.id) problems.push('ลูกที่เป็นเณรยังตามพ่อแม่ไปงานบุญ');
  }
  check('เณรอยู่วัด', problems);
  if (failed === before) console.log(`  ✓ เป็นเณร ${W.noviceYears} ปี 30 seed ไม่มีงานบ้าน/เทศกาล/เรื่องสุ่มในเรือน ได้เรื่องที่วัด ${atTempleEvents} เรื่อง (เด็กไม่ได้เป็นเณรช่วงเดียวกัน ${control} เรื่อง) · ลาสึกก่อนกำหนดได้ · สึกแล้วมี ${back} เรื่อง · ลูกเณรไม่ตามไปงานบุญ`);
}

// [5h4h] ที่อยู่ตอนนี้ (PLAN ข้อ 5b): ทุก event ที่ส่งถึงผู้เล่นใน [1] [5h4d] [5h4g] เกิดในที่ที่ actor อยู่ตาม trigger.at
//  ต้องมี event ที่เกิดตอนอยู่ในทัพและที่วัดบ้าง ไม่งั้นตัวตรวจนี้ไม่ได้ตรวจอะไร
{
  const before = failed;
  console.log('event เกิดตรงที่อยู่:');
  const problems: string[] = [];
  if (misplaced.size) problems.push(`เกิดผิดที่: ${[...misplaced].map(([k, n]) => `${k} ×${n}`).join(', ')}`);
  if (!awayEvents.army || !awayEvents.temple) problems.push(`ไม่มี event ตอนอยู่ในทัพ (${awayEvents.army}) หรือที่วัด (${awayEvents.temple}) — ตัวตรวจไม่ได้ตรวจอะไร`);
  for (const def of Object.values(content.events)) {
    for (const w of def.trigger.at ?? []) if (!['home', 'army', 'temple'].includes(w)) problems.push(`${def.id}: trigger.at ไม่รู้จัก "${w}"`);
  }
  check('event เกิดตรงที่อยู่', problems);
  if (failed === before) console.log(`  ✓ ทุก event อยู่ในที่ที่เกิดได้ · ตอนอยู่ในทัพ ${awayEvents.army} เรื่อง · ที่วัด ${awayEvents.temple} เรื่อง`);
}

// [5h4f] ขบวนเรือหลวงเดือน 12 (docs/design-barge-procession.md, PLAN ข้อ 15): ปีที่มี/งด · หมายฝีพายเฉพาะไพร่ชาย · ปีละเรื่องเดียวตามฐานะ · ข้อความครบ · โอกาสตามที่ตั้ง
{
  const before = failed;
  console.log('ขบวนเรือหลวงเดือน 12:');
  const problems: string[] = [];
  const text = load('text.th.json') as Record<string, string>;
  const B = content.balance.barge;
  const probe = makeCtx(emptyState(1), content);
  for (const y of [2308, 2315, 2324, 2328, 2329, 2335, 2336, 2376]) if (bargeYear(probe, y)) problems.push(`ปี ${y} ไม่ควรมีขบวน`);
  for (const y of [2290, 2300, 2325, 2340, 2399]) if (!bargeYear(probe, y)) problems.push(`ปี ${y} ควรมีขบวน`);
  const findDay = (ctx: Ctx, year: number, month: number, waxing: boolean, d: number) => {
    for (let day = yearStart(ctx, year); day < yearStart(ctx, year + 1); day++) {
      const l = lunarOf(ctx, day);
      if (l.month === month && l.waxing === waxing && l.phaseDay === d) return day;
    }
    return -1;
  };
  const setup = (seed: number, opts: { sex?: 'm' | 'f'; age?: number; office?: boolean } = {}) => {
    const ctx = makeCtx(emptyState(seed), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = opts.sex ?? 'm';
    hero.social.wealth = 50;
    ctx.state.meta.day = yearStart(ctx, 2340);
    hero.birthDay = ctx.state.meta.day - yearsToDays(opts.age ?? 25);
    if (opts.office) applyCareer(ctx, hero, 'enter_dept', 'patrol');
    const levy = findDay(ctx, 2340, B.levyMonth, false, B.levyDay);
    const proc = findDay(ctx, 2340, B.month, true, B.day);
    return { ctx, hero, levy, proc };
  };
  const at = (ctx: Ctx, day: number) => { ctx.state.meta.day = day; return bargeToday(ctx); };
  const viewOk = (ctx: Ctx, p: PreparedEvent) => {
    const v = eventView(ctx, p, text);
    return v.title !== p.def.id && !!v.text && !/[{}]/.test(v.text) && v.options.every((o) => !!o.text && !/[{}]|^(event|risk|outcome)\./.test(o.text));
  };
  {
    const s = setup(5);
    if (s.levy < 0 || s.proc < 0 || s.levy >= s.proc) problems.push(`วันหมาย/วันขบวนผิด (${s.levy}, ${s.proc})`);
  }
  // หมายฝีพาย: ไพร่ชายราว levyChance · หญิงและขุนนางไม่ได้
  let levied = 0;
  let female = 0;
  let officialLevy = 0;
  for (let i = 0; i < 200; i++) {
    const m = setup(1000 + i);
    if (at(m.ctx, m.levy).events.some((e) => e.event === 'barge.levy')) levied++;
    const f = setup(1000 + i, { sex: 'f' });
    if (at(f.ctx, f.levy).events.length) female++;
    const o = setup(1000 + i, { office: true });
    if (at(o.ctx, o.levy).events.length) officialLevy++;
  }
  if (Math.abs(levied / 200 - B.levyChance) > 0.1) problems.push(`ได้หมายฝีพาย ${levied}/200 (ควรราว ${B.levyChance * 100}%)`);
  if (female || officialLevy) problems.push(`หญิงได้หมาย ${female} · ขุนนางได้หมาย ${officialLevy}`);
  // วันขบวน: ปีละเรื่องเดียวตามฐานะ + ข้อความครบ
  const kinds = new Map<string, number>();
  let multi = 0;
  let badText = 0;
  for (let i = 0; i < 120; i++) {
    const mode = (['official', 'rower', 'other'] as const)[i % 3];
    const s = setup(2000 + i, { office: mode === 'official' });
    if (mode === 'rower') {
      s.ctx.state.meta.day = s.levy;
      chooseOption(s.ctx, prepareEvent(s.ctx, 'barge.levy', { actor: s.hero.id }), 'serve');
    }
    const r = at(s.ctx, s.proc);
    if (r.events.length > 1) multi++;
    for (const e of r.events) {
      kinds.set(`${mode}:${e.event}`, (kinds.get(`${mode}:${e.event}`) ?? 0) + 1);
      if (!viewOk(s.ctx, prepareEvent(s.ctx, e.event, e.bindings, e.vars))) badText++;
    }
  }
  if (multi) problems.push(`วันขบวนได้หลายเรื่องพร้อมกัน ${multi} ครั้ง`);
  if (badText) problems.push(`ข้อความ event ขบวนไม่ครบ ${badText} ครั้ง`);
  if (!kinds.get('official:barge.official')) problems.push('ขุนนางไม่ได้หมายเข้ากระบวน');
  if (!kinds.get('rower:barge.rowing')) problems.push('ไพร่ที่ไปพายเองไม่ได้ event พายเรือ');
  if (!kinds.get('other:festival.barge_watch')) problems.push('คนทั่วไปไม่ได้ไปดูกระบวน');
  if ([...kinds.keys()].some((k) => (k.startsWith('official:') && k !== 'official:barge.official') || (k.startsWith('rower:') && k !== 'rower:barge.rowing'))) problems.push(`ได้เรื่องผิดฐานะ: ${[...kinds.keys()].join(', ')}`);
  // ปีงดไม่มีอะไรเลย
  {
    const s = setup(77);
    s.ctx.state.meta.day = yearStart(s.ctx, 2315);
    const proc = findDay(s.ctx, 2315, B.month, true, B.day);
    if (at(s.ctx, proc).events.length) problems.push('ปี 2315 (ธนบุรี) มีขบวน');
  }
  // คนหัวเรือ: พูดจา 40 + เคยพายแล้วขอได้ · ขอแล้วปีหลังได้ตัวเลือกนั่งหัวเรือ (ติดตัว)
  {
    const s = setup(88);
    s.hero.skills.speech = 45;
    const opts = () => prepareEvent(s.ctx, 'barge.rowing', { actor: s.hero.id }).options.map((o) => o.id);
    if (opts().includes('ask_lead')) problems.push('ยังไม่เคยพายแต่เห็นตัวเลือกขอนั่งหัวเรือ');
    chooseOption(s.ctx, prepareEvent(s.ctx, 'barge.rowing', { actor: s.hero.id }), 'steady');
    if (!opts().includes('ask_lead')) problems.push('เคยพายแล้ว พูดจา 45 แต่ไม่เห็นตัวเลือกขอนั่งหัวเรือ');
    chooseOption(s.ctx, prepareEvent(s.ctx, 'barge.rowing', { actor: s.hero.id }), 'ask_lead');
    const after = opts();
    if (after.includes('ask_lead') || !after.includes('lead_he')) problems.push(`ขอนั่งหัวเรือแล้วปีหลังไม่ได้ตัวเลือกคนหัวเรือ (${after.join(',')})`);
  }
  // หลบถูกจับราว 25% · ขุนนางประหยัดเรือตามไม่ทันราว 30%
  let caught = 0;
  let late = 0;
  for (let i = 0; i < 200; i++) {
    const s = setup(3000 + i);
    s.ctx.state.meta.day = s.levy;
    const w0 = s.hero.social.wealth;
    chooseOption(s.ctx, prepareEvent(s.ctx, 'barge.levy', { actor: s.hero.id }), 'dodge');
    if (s.hero.social.wealth < w0) caught++;
    const o = setup(3000 + i, { office: true });
    o.ctx.state.meta.day = o.proc;
    const f0 = o.hero.office?.favor ?? 0;
    chooseOption(o.ctx, prepareEvent(o.ctx, 'barge.official', { actor: o.hero.id }, { boat: 'x' } as never), 'frugal');
    if ((o.hero.office?.favor ?? 0) < f0) late++;
  }
  if (caught < 30 || caught > 75) problems.push(`หลบหมายฝีพายถูกจับ ${caught}/200 (ควรราว 25%)`);
  if (late < 40 || late > 85) problems.push(`ขุนนางประหยัดแล้วเรือตามไม่ทัน ${late}/200 (ควรราว 30%)`);
  check('ขบวนเรือหลวงเดือน 12', problems);
  if (failed === before) console.log(`  ✓ งด 2308–2324 และปีศึก · หมายฝีพาย ${levied}/200 (หญิง/ขุนนางไม่ได้) · ปีละเรื่องตามฐานะ ข้อความครบ · คนหัวเรือติดตัว · หลบถูกจับ ${caught}/200 · ประหยัดตามไม่ทัน ${late}/200`);
}

// [5h4c] ข้าหลวงเดิม 2367 (docs/design-eras.md หัวข้อ 7b): มาหลัง shock ผลัดแผ่นดิน · เฉพาะผู้มีตำแหน่ง · ฝากตัวเลื่อนขั้นราว 45% · ข้อความครบ
{
  const before = failed;
  console.log('ข้าหลวงเดิม 2367:');
  const problems: string[] = [];
  const text = load('text.th.json') as Record<string, string>;
  const sched = content.historyEvents.find((h) => h.event === 'rama3.old_retainers')!;
  const shock = content.history.find((h) => h.tag === 'history:rama3_accession')!;
  if (!(sched.year === shock.year && sched.day > (shock.day ?? 0))) problems.push('ข้าหลวงเดิมไม่ได้มาหลังผลัดแผ่นดิน 2367');
  const setup = (seed: number) => {
    const ctx = makeCtx(emptyState(seed), content);
    const hero = bootstrapScenario(ctx);
    hero.sex = 'm';
    ctx.state.meta.day = yearStart(ctx, 2367) + sched.day;
    hero.birthDay = ctx.state.meta.day - yearsToDays(30);
    const find = () => historyEventsToday(ctx).find((p) => p.def.id === 'rama3.old_retainers');
    return { ctx, hero, find };
  };
  {
    const { ctx, hero, find } = setup(43);
    if (find()) problems.push('คนไม่มีตำแหน่งได้ event ข้าหลวงเดิม');
    applyCareer(ctx, hero, 'enter_dept', 'patrol');
    const p = find();
    if (!p) problems.push('ผู้มีตำแหน่งไม่ได้ event ข้าหลวงเดิม');
    else {
      const v = eventView(ctx, p, text);
      if (v.title === p.def.id || !v.text || /[{}]/.test(v.text) || v.options.some((o) => !o.text || /[{}]|^(event|risk|outcome)\./.test(o.text))) problems.push('ข้าหลวงเดิม: ข้อความไม่ครบ');
    }
  }
  let promoted = 0;
  for (let i = 0; i < 60; i++) {
    const s = setup(400 + i);
    applyCareer(s.ctx, s.hero, 'enter_dept', 'patrol');
    s.hero.social.wealth = 10;
    const rank = officeRank(s.ctx, s.hero) ?? 0;
    const q = s.find();
    if (!q) continue;
    chooseOption(s.ctx, q, 'patron');
    if ((officeRank(s.ctx, s.hero) ?? 0) > rank) promoted++;
  }
  if (promoted < 15 || promoted > 42) problems.push(`ฝากตัวกับข้าหลวงเดิมเลื่อนขั้น ${promoted}/60 (ควรราว 45%)`);
  check('ข้าหลวงเดิม 2367', problems);
  if (failed === before) console.log(`  ✓ มาหลังผลัดแผ่นดิน · เฉพาะผู้มีตำแหน่ง · ฝากตัวเลื่อน ${promoted}/60 · ข้อความครบ`);
}

// [5h5] ถูกกวาดต้อนไปพม่าไม่มีงานศพ (ยังไม่ตาย) แต่ทรัพย์ยังตกแก่ญาติ — คนตายตามปกติยังมีงานศพ
{
  const before = failed;
  console.log('ผู้ถูกกวาดต้อน:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(31), content);
  const hero = bootstrapScenario(ctx);
  const mk = (name: string) => spawnCharacter(ctx, { name, sex: 'm', birthYear: 2270, estate: 'noble', dynastyId: hero.dynastyId, householdId: hero.householdId });
  const taken = mk('ถูกต้อน'); taken.social.wealth = 50;
  const dead = mk('ตายปกติ'); dead.social.wealth = 50;
  markDead(ctx, taken, CAPTIVE_TAG);
  markDead(ctx, dead, 'situation:illness');
  const a = settleDeath(ctx, taken).lines, b = settleDeath(ctx, dead).lines;
  if (a.some((l) => l.includes('งานศพ'))) problems.push(`จัดงานศพให้คนที่ถูกกวาดต้อน: ${a.join(' / ')}`);
  if (!b.some((l) => l.includes('งานศพ'))) problems.push('คนตายปกติไม่มีงานศพ');
  check('ผู้ถูกกวาดต้อน', problems);
  if (failed === before) console.log('  ✓ ไม่มีงานศพให้คนที่ถูกกวาดต้อน · คนตายปกติยังมีงานศพ');
}

// [5i] ผู้เล่นรู้สึกหนักใจเอง: ญาติใกล้ชิดตาย (ยิ่งรักยิ่งหนัก) เมียที่ไม่รักแล้ว และเหตุการณ์บ้านเมือง
{
  const before = failed;
  console.log('ความหนักใจของผู้เล่น:');
  const ctx = makeCtx(emptyState(47), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(20);
  hero.sex = 'm';
  hero.personality.neuroticism = 0.5;
  const problems: string[] = [];
  const mk = (name: string) => spawnCharacter(ctx, { name, sex: 'f', birthYear: yearOf(ctx, S.meta.day) - 22, estate: 'noble', dynastyId: null, householdId: hero.householdId });
  const wife = mk('เมียรัก');
  marry(ctx, hero, wife);
  const rested = () => { hero.stress = 0; setRelation(ctx, wife.id, hero.id, 'affection', 0.6); };
  const tick = () => { hero.stress = 0; kinYearTick(ctx); return hero.stress; };

  // ปกติไม่มีเรื่องหนักใจ (ลงมาอยู่ที่ระดับพักของนิสัย ไม่เกิน 0.1)
  rested();
  const calm = tick();
  if (calm > 0.1) problems.push(`ไม่มีเรื่องอะไรแต่หนักใจ ${calm.toFixed(2)}`);
  // เมียไม่รัก → หนักใจขึ้น
  setRelation(ctx, wife.id, hero.id, 'affection', 0.1);
  const cold = tick();
  if (cold <= calm) problems.push(`เมียไม่รักแล้วแต่หนักใจไม่ขึ้น (${calm.toFixed(3)} → ${cold.toFixed(3)})`);
  // คนใกล้ชิดตาย: ยิ่งรักยิ่งหนัก
  const lose = (aff: number) => {
    const w = mk(`เมีย${aff}`);
    marry(ctx, hero, w);
    setRelation(ctx, hero.id, w.id, 'affection', aff);
    markDead(ctx, w, 'tag:test' as never);
    return tick();
  };
  setRelation(ctx, wife.id, hero.id, 'affection', 0.6);
  const loveless = lose(0.1);
  const loved = lose(0.9);
  if (!(loved > loveless + 0.05)) problems.push(`ยิ่งรักยิ่งต้องหนักกว่า แต่ ${loveless.toFixed(2)} vs ${loved.toFixed(2)}`);
  // เหตุการณ์บ้านเมือง (โรคระบาด) ทำให้หนักใจ
  rested();
  hero.stress = 0;
  applyHistoricalShocks(ctx, 2363);
  if (isAlive(hero) && hero.stress <= 0) problems.push('โรคระบาดผ่านไปแต่ผู้เล่นไม่หนักใจเลย');
  check('ความหนักใจของผู้เล่น', problems);
  if (failed === before) console.log('  ✓ ปกติใจเบา · เมียไม่รักทำให้หนักใจ · คนที่รักตายหนักกว่า · โรคระบาดทำให้หนักใจ');
}

// [6] การจัดการเรือน วิชาความชำนาญ และมรดกตระกูล
{
  const before = failed;
  console.log('จัดการเรือน วิชาความชำนาญ และมรดกตระกูล:');
  const problems: string[] = [];
  const ctx = makeCtx(emptyState(9010), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += yearsToDays(20); // อายุ 26 ปี
  const hh = S.households[hero.householdId!]!;
  hh.headId = hero.id;
  hero.social.wealth = 200;

  const cap0 = houseCapacity(ctx, hh);
  expandHousehold(ctx, hero);
  const cap1 = houseCapacity(ctx, hh);
  if (cap1 <= cap0) problems.push(`ขยายเรือนแล้วความจุไม่เพิ่ม (${cap0} -> ${cap1})`);

  const m0 = householdMonth(ctx, hh);
  buyHouseholdLand(ctx, hero);
  const m1 = householdMonth(ctx, hh);
  if (m1.landYield <= m0.landYield) problems.push('ซื้อที่นาแล้วรายได้จากที่นาไม่เพิ่ม');

  const slaves0 = hh.retainers?.that ?? 0;
  buyHouseholdSlave(ctx, hero);
  if ((hh.retainers?.that ?? 0) !== slaves0 + 1) problems.push('ไถ่ทาสเพิ่มแล้วจำนวนทาสไม่เพิ่ม');
  freeHouseholdSlave(ctx, hero);
  if ((hh.retainers?.that ?? 0) !== slaves0) problems.push('ปล่อยทาสเป็นไทแล้วจำนวนทาสไม่ลด');

  // ฝึกวิชาและปลดล็อกขั้นวิชา
  setSkillFocus(ctx, hero, 'martial');
  if (hero.focus !== 'martial') problems.push('ตั้งใจฝึกวิชาต่อสู้ไม่สำเร็จ');
  // บรรทัด "พร้อมสำเร็จวิชา" ออกครั้งเดียวตอนแต้มเต็ม และแยกจากบรรทัดทั่วไป (UI แสดงเด่นในหมวดวิชา)
  const readyLines = Array.from({ length: 26 }, () => skillsMonthTick(ctx)).flatMap((r) => r.ready);
  if (readyLines.length !== 1) problems.push(`บรรทัดพร้อมสำเร็จวิชาควรออกครั้งเดียว ออก ${readyLines.length} ครั้ง`);
  if ((hero.skills['combat'] ?? 0) <= 0) problems.push('ฝึกวิชาต่อสู้รายเดือนแล้วค่าวิชาไม่เพิ่ม');
  if ((hero.skillXp?.martial ?? 0) < 100) problems.push(`ฝึกวิชา 26 เดือนแต่ความก้าวหน้ายังไม่เต็ม (${hero.skillXp?.martial})`);
  unlockNextPerk(hero, 'martial');
  if (!hasPerk(hero, 'martial_1')) problems.push('ปลดล็อกวิชาขั้นแรกของสายต่อสู้ไม่สำเร็จ');

  // ซ้อมมวยซ้อมดาบ & นำลูกหมู่ปราบโจรเอง
  const sparEv = prepareEvent(ctx, 'skill.muay_sparring', { actor: hero.id });
  if (sparEv.options.length < 3) problems.push('กิจกรรมซ้อมมวยซ้อมดาบมีตัวเลือกไม่ครบ');
  chooseOption(ctx, sparEv, 'sword');

  const patrolEv = prepareEvent(ctx, 'career.patrol_thief', { actor: hero.id });
  const leadOpt = patrolEv.options.find((o) => o.id === 'lead');
  if (!leadOpt?.risk) problems.push('ไม่มีตัวเลือกถือดาบนำลูกหมู่ปราบโจรด้วยตัวเอง');

  // มรดกตระกูล
  const dyn = S.dynasties[hero.dynastyId!]!;
  dyn.headNodeId = hero.familyNodeId;
  dyn.prestige = 50;
  unlockDynastyLegacy(ctx, hero, 'warrior');
  if (legacyLevel(ctx, hero, 'warrior') !== 1) problems.push('จารึกมรดกตระกูลสายนักรบไม่สำเร็จ');

  // ผลของมรดก/วิชาที่ประกาศไว้ต้องมีผลจริง
  const sh0 = mortalityShield(ctx, hero, 3);
  dyn.legacies = { ...dyn.legacies, kin: 2, wisdom: 4, warrior: 4 };
  if (!(mortalityShield(ctx, hero, 3) < sh0)) problems.push('มรดกสายญาติไม่ลดความเสี่ยงตายของเด็ก');
  const merit0 = hero.merit;
  const pres0 = dyn.prestige;
  hero.stress = 0.5;
  skillsYearTick(ctx);
  if (!(hero.merit > merit0 && dyn.prestige > pres0)) problems.push('มรดกสายปราชญ์/นักรบไม่ให้บุญหรือบารมีรายปี');
  for (const sk of SKILL_TRACKS) {
    for (const pk of sk.perks) {
      if (!/\d/.test(pk.desc)) problems.push(`วิชา ${pk.id} ไม่มีตัวเลขผล`);
    }
  }
  // ปล่อยทาสถี่ไม่ได้ และไม่ซื้อคืนอัตโนมัติทันที
  hh.retainers!.that = 3;
  let freedTwice = true;
  try { freeHouseholdSlave(ctx, hero); } catch { freedTwice = false; }
  if (freedTwice) problems.push('ปล่อยทาสซ้ำในปีเดียวกันได้');
  // ฝึกวิชาเสียค่าครู
  const purse0 = hero.social.wealth;
  setSkillFocus(ctx, hero, 'diplomacy');
  skillsMonthTick(ctx);
  if (!(hero.social.wealth < purse0)) problems.push('ฝึกวิชาแล้วไม่เสียค่าครู');

  check('จัดการเรือน วิชา และมรดกตระกูล', problems);
  if (failed === before) console.log('  ✓ ขยายเรือน/ซื้อที่นา/ไถ่-ปล่อยทาส · ฝึกวิชาและปลดล็อกขั้นวิชา · ซ้อมมวยและนำทีมปราบโจร · จารึกมรดกตระกูล');
}

// [5j] ความเสี่ยงถึงชีวิตจากตัวเลือก: kill + chance ใน risk.fail (docs/design-choice-risk.md ขั้น 1) — ยังไม่มี event จริงใช้ ทดสอบด้วย event สมมติ
{
  const before = failed;
  console.log('ความเสี่ยงถึงชีวิตจากตัวเลือก:');
  const problems: string[] = [];
  const mkEvent = (id: string, kill: Record<string, unknown> | null, opts: { hint?: string; safe?: boolean; inEffects?: boolean } = {}): GameEventDef => {
    const k = kill ? [{ op: 'kill', role: 'actor', cause: 'situation:drowning', allowKin: true, ...kill }] : [];
    const risky = {
      id: 'risky', textKey: `event.${id}.risky`,
      effects: opts.inEffects ? k : [],
      ...(!opts.inEffects && kill ? { risk: { base: 1, hintKey: opts.hint ?? 'risk.test', fail: { textKey: `event.${id}.fail`, effects: k } } } : {}),
    };
    return {
      id, textKey: `event.${id}`, contextTags: [], roles: { actor: {} }, trigger: { weight: 0 }, percepts: [],
      options: opts.safe === false ? [risky] : [risky, { id: 'safe', textKey: `event.${id}.safe`, effects: [] }],
    } as unknown as GameEventDef;
  };
  const raw = (extra: Record<string, GameEventDef>) => buildContentDB({
    names: load('names.json'), tags: load('tags.json'), anatomy: load('anatomy.json'), traitKinds: load('traitKinds.json'),
    events: { ...load('events.json'), ...extra }, rules: load('rules.json'), intents: load('intents.json'),
    offices: load('offices.json'), chores: load('chores.json'), balance: load('balance.json'),
  });
  const rejects = (label: string, ev: GameEventDef) => {
    try { raw({ [ev.id]: ev }); problems.push(`ตรวจเนื้อหาไม่ปฏิเสธ: ${label}`); } catch { /* ถูกต้อง */ }
  };
  rejects('ตายตรงๆ ใน effects', mkEvent('t_direct', {}, { inEffects: true }));
  rejects('ตายได้แต่ไม่มี hintKey', mkEvent('t_nohint', { chance: 0.1 }, { hint: '' }));
  rejects('ทุกตัวเลือกตายได้', mkEvent('t_alllethal', { chance: 0.1 }, { safe: false }));
  try { raw({ t_ok: mkEvent('t_ok', { chance: 0.1 }) }); } catch (e) { problems.push(`เนื้อหาที่ถูกกลับถูกปฏิเสธ: ${(e as Error).message}`); }

  // ทอยจริง: chance 0 ไม่ตาย, chance 1 ตายและแจ้งการตาย, chance 0.3 ตายราว 30%
  const trial = (chance: number | undefined, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const ev = mkEvent('t_roll', chance === undefined ? {} : { chance });
      const db = raw({ t_roll: ev });
      const c = makeCtx(emptyState(9000 + i), db);
      const h = bootstrapScenario(c);
      chooseOption(c, prepareEvent(c, 't_roll', { actor: h.id }), 'risky');
      if (!isAlive(h)) {
        dead++;
        if (h.deathCause !== 'situation:drowning') problems.push(`ตายด้วย ${h.deathCause}`);
        if (i === 0 && !advanceDay(c).some((s) => s.type === 'playerDied')) problems.push('ผู้เล่นตายจากตัวเลือกแล้วไม่มีสัญญาณ playerDied');
      }
    }
    return dead;
  };
  if (trial(0, 60) !== 0) problems.push('chance 0 แต่ตาย');
  // risk.base 1 ถูกบีบเหลือ 0.95 (riskChance) → พลาดแล้วตายแน่ราว 95% ของครั้ง
  const d1 = trial(1, 40);
  if (d1 < 34) problems.push(`chance 1 ตาย ${d1}/40 (คาดราว 38)`);
  const d30 = trial(0.3, 200);
  if (d30 < 35 || d30 > 85) problems.push(`chance 0.3 ตาย ${d30}/200 (คาดราว 60)`);
  check('ความเสี่ยงถึงชีวิตจากตัวเลือก', problems.slice(0, 4));
  if (failed === before) console.log('  ✓ ตรวจเนื้อหา 4 กรณี · chance 0/1/0.3 ตายตามโอกาสและแจ้ง playerDied');
}

// [5k] ความเสี่ยงชั้น 1: จมน้ำ ปราบโจร แผลเน่าถึงตาย (เฉพาะผู้เล่น) การรักษา และความหนักใจ — docs/design-choice-risk.md
{
  const before = failed;
  console.log('ความเสี่ยงชั้น 1 (จมน้ำ แผลเน่า ความหนักใจ):');
  const problems: string[] = [];
  // ทุก event ต้องมีชื่อหัวข้อ (<textKey>.title) — ไม่งั้นหน้าต่างเลือกแสดง id ดิบ (พบตอนลองเล่น body.wound_infected / plague.news)
  const textTh = load('text.th.json') as Record<string, string>;
  const untitled = Object.values(content.events).filter((e) => !textTh[`${e.textKey}.title`]).map((e) => e.id);
  if (untitled.length) problems.push(`event ไม่มีชื่อหัวข้อ: ${untitled.slice(0, 4).join(', ')}`);
  // ทุกข้อความของ event ต้องมี text และ {ชื่อบทบาท} ต้องมีอยู่จริงใน roles/variables (ไม่งั้นผู้เล่นเห็น "{avenger}" ดิบ) — family.legend_truth ใช้ตัวแปร {told}/{truth} ที่เติมนอก event
  const badText: string[] = [];
  for (const e of Object.values(content.events)) {
    if (e.id === 'family.legend_truth') continue;
    const keys = new Set<string>([e.textKey]);
    for (const o of e.options) { keys.add(o.textKey); if (o.replyKey) keys.add(o.replyKey); if (o.risk) { if (o.risk.successKey) keys.add(o.risk.successKey); keys.add(o.risk.fail.textKey); } }
    const names = new Set<string>([...Object.keys(e.roles), ...Object.keys(e.variables ?? {})]);
    for (const k of keys) {
      const t = textTh[k];
      if (t === undefined) { badText.push(`${e.id}: ไม่มีข้อความ ${k}`); continue; }
      for (const m of t.matchAll(/{([a-zA-Z_]+)}/g)) if (!names.has(m[1]!)) badText.push(`${e.id} ${k}: {${m[1]}} ไม่ใช่บทบาท`);
    }
  }
  if (badText.length) problems.push(...badText.slice(0, 3));
  const lethalOpt = (evId: string, optId: string) => {
    const o = content.events[evId]!.options.find((x) => x.id === optId)!;
    return o.risk?.fail.effects.some((f) => f.op === 'kill' && f.chance !== undefined && f.allowKin) ?? false;
  };
  if (!lethalOpt('life.drowning', 'dive')) problems.push('กระโดดช่วยคนตกน้ำไม่มีโอกาสตายใน risk.fail');
  if (!lethalOpt('career.patrol_thief', 'lead')) problems.push('นำจับโจรไม่มีโอกาสตายใน risk.fail');
  if (content.events['life.drowning']!.options.find((o) => o.id === 'pole')!.risk!.fail.effects.some((f) => f.op === 'kill')) problems.push('ใช้ไม้ยื่นช่วย (ทางปลอดภัย) ไม่ควรตาย');

  // แผลหนองเน่าของผู้เล่น: ไม่รักษา vs รักษาดี — ตายเฉพาะผู้เล่น และการรักษาลดโอกาสตาย
  const festering = (quality: number, asPlayer: boolean, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(7000 + i), content);
      const h = bootstrapScenario(c);
      const victim = asPlayer ? h : Object.values(c.state.characters).find((x) => x.id !== h.id && isAlive(x) && ageOf(c, x) > 15)!;
      const part = selectPart(c, victim, { tag: 'body:torso' })!;
      const w = inflictWound(c, victim, part, 'cut', 0.7, quality > 0 ? { quality, by: null, remedy: null } : null, null);
      w.stage = 'festering';
      w.stageSinceDay = c.state.meta.day - 10;
      if (tickWounds(c, victim).some((o) => o.result === 'fatal')) dead++;
    }
    return dead;
  };
  const untreated = festering(0, true, 300);
  const treated = festering(0.75, true, 300);
  const npc = festering(0, false, 100);
  if (untreated < 70 || untreated > 150) problems.push(`แผลเน่าไม่รักษา ตาย ${untreated}/300 (คาดราว 108)`);
  if (!(treated < untreated * 0.7)) problems.push(`รักษาดีแล้วตาย ${treated}/300 ไม่น้อยกว่าไม่รักษา ${untreated}/300 ชัดเจน`);
  if (npc !== 0) problems.push(`NPC ตายจากแผลเน่า ${npc} (ควรเป็นเฉพาะผู้เล่น)`);

  // event "แผลอักเสบ" ออกครั้งเดียวต่อแผล และ treat ใส่คุณภาพการรักษา
  const c2 = makeCtx(emptyState(41), content);
  const p2 = bootstrapScenario(c2);
  const w2 = inflictWound(c2, p2, selectPart(c2, p2, { tag: 'body:torso' })!, 'cut', 0.6, null, null);
  w2.stage = 'infected';
  w2.stageSinceDay = c2.state.meta.day;
  const seen = (): number => advanceDay(c2).filter((s) => s.type === 'event' && s.prepared.def.id === 'body.wound_infected').length;
  const first = seen();
  let again = 0;
  for (let i = 0; i < 3; i++) again += seen();
  if (first !== 1 || again !== 0) problems.push(`event แผลอักเสบออก ${first} ครั้งแรก แล้วซ้ำ ${again} (ควร 1 แล้ว 0)`);
  chooseOption(c2, prepareEvent(c2, 'body.wound_infected', { actor: p2.id }), 'physician');
  const q2 = Object.values(c2.state.wounds).find((x) => x.characterId === p2.id)?.treatment?.quality;
  if (q2 !== 0.75) problems.push(`เลือกหมอยาแล้วคุณภาพการรักษา ${q2}`);

  // ความหนักใจสูงเพิ่มความเสี่ยงตายรายปีของผู้เล่นเท่านั้น
  const M = content.balance.mortality;
  const yearDeaths = (stress: number, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(8000 + i), content);
      const h = bootstrapScenario(c);
      c.state.meta.day = yearStart(c, 2330);
      h.birthDay = c.state.meta.day - 40 * 365;
      h.stress = stress;
      mortalityYearTick(c);
      if (!isAlive(h)) dead++;
    }
    return dead;
  };
  const calm = yearDeaths(0.2, 3000);
  const tense = yearDeaths(0.95, 3000);
  const expectRatio = (1 + M.stressSlope * (0.95 - M.stressFrom));
  if (!(tense > calm * (expectRatio * 0.6))) problems.push(`ความหนักใจสูงตาย ${tense}/3000 vs ปกติ ${calm}/3000 (คาดอัตราส่วนราว ${expectRatio.toFixed(2)})`);
  check('ความเสี่ยงชั้น 1', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ จมน้ำ/ปราบโจรมี kill chance · แผลเน่าตาย ไม่รักษา ${untreated}/300 รักษาดี ${treated}/300 NPC 0 · event แผลอักเสบครั้งเดียว · ความหนักใจสูงตายมากขึ้น (${calm}→${tense}/3000)`);
}

// [5l] ชั้น 2b: เตรียมรับโรคระบาด (ไข้ป่วงใหญ่ 2363/2392) — ข่าวปีก่อน ผู้เล่นเลือกหนี/ปิดเรือน/ทำบุญ ผลต่อคนในเรือนเท่านั้น
{
  const before = failed;
  console.log('เตรียมรับโรคระบาด:');
  const problems: string[] = [];
  for (const y of [2362, 2391]) {
    if (!content.historyEvents.some((s) => s.year === y && s.event === 'plague.news')) problems.push(`ไม่มีข่าวโรคระบาดตามตาราง ${y}`);
  }
  const trial = (kind: string | null, n: number) => {
    let members = 0;
    let dead = 0;
    let outsiders = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(6000 + i), content);
      const h = bootstrapScenario(c);
      c.state.meta.day = yearStart(c, 2362) + 300;
      if (kind) chooseOption(c, prepareEvent(c, 'plague.news', { actor: h.id }), kind);
      const house = Object.values(c.state.characters).filter((x) => isAlive(x) && x.householdId && x.householdId === h.householdId);
      const others = Object.values(c.state.characters).filter((x) => isAlive(x) && !house.includes(x));
      applyHistoricalShocks(c, 2363);
      members += house.length;
      dead += house.filter((x) => !isAlive(x)).length;
      outsiders += others.filter((x) => !isAlive(x)).length;
      if (c.state.meta.plague) problems.push('meta.plague ไม่ถูกลบหลังใช้');
    }
    return { members, dead, rate: dead / members, outsiders };
  };
  const none = trial(null, 250);
  const flee = trial('flee', 250);
  const home = trial('home', 250);
  const merit = trial('merit', 250);
  if (none.rate < 0.12 || none.rate > 0.28) problems.push(`ไม่เตรียมตัว คนในเรือนตาย ${(none.rate * 100).toFixed(0)}% (คาดราว 20%)`);
  if (!(flee.rate < none.rate * 0.7)) problems.push(`หนี ${(flee.rate * 100).toFixed(0)}% ไม่ต่ำกว่าไม่เตรียมตัว ${(none.rate * 100).toFixed(0)}% ชัดเจน`);
  if (!(home.rate < none.rate * 0.88)) problems.push(`ปิดเรือน ${(home.rate * 100).toFixed(0)}% ไม่ต่ำกว่าไม่เตรียมตัว`);
  if (merit.rate > none.rate * 1.08) problems.push(`ทำบุญ ${(merit.rate * 100).toFixed(0)}% แย่กว่าไม่เตรียมตัว`);
  // คนนอกเรือนไม่ได้อานิสงส์ (ตายใกล้เคียงกัน ในสัดส่วนเดียวกัน)
  const base = none.outsiders / 250;
  for (const [label, t] of [['หนี', flee], ['ปิดเรือน', home], ['ทำบุญ', merit]] as const) {
    if (Math.abs(t.outsiders / 250 - base) > base * 0.25) problems.push(`คนนอกเรือนตายต่างกันเมื่อ${label} (${(t.outsiders / 250).toFixed(1)} vs ${base.toFixed(1)})`);
  }
  check('เตรียมรับโรคระบาด', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ คนในเรือนตาย: ไม่เตรียม ${(none.rate * 100).toFixed(0)}% · หนี ${(flee.rate * 100).toFixed(0)}% · ปิดเรือน ${(home.rate * 100).toFixed(0)}% · ทำบุญ ${(merit.rate * 100).toFixed(0)}% · คนนอกเรือนไม่ได้อานิสงส์ · ข่าว 2362/2391 อยู่ในตาราง`);
}

// [5n] PLAN 3b ลูกไข้หนัก (docs/design-sick-child.md): ลูกของผู้เล่นในเรือนที่ทอยตายด้วยไข้ ส่วนหนึ่งกลายเป็น event ให้เลือกรักษา
// (หลานไม่ได้) · ตายใน event แล้วได้งานศพ/มรดก/ออกจากเรือนทันที · ตัวเลือกมีครบและหมอยาเสียเงิน
{
  const before = failed;
  console.log('ลูกไข้หนัก:');
  const problems: string[] = [];
  const M = content.balance.mortality;
  const keep = { young: M.young, smallpoxYearChance: M.smallpoxYearChance };
  M.young = 0.4; M.smallpoxYearChance = 0; // ให้ทอยตายบ่อยพอจะเห็นทั้งสองทาง (คืนค่าท้ายข้อ)
  let events = 0, diceDeaths = 0, grandEvents = 0;
  for (let i = 0; i < 60; i++) {
    const ctx = makeCtx(emptyState(500 + i), content);
    const hero = bootstrapScenario(ctx);
    ctx.state.meta.day = yearStart(ctx, 2300);
    hero.birthDay = ctx.state.meta.day - yearsToDays(30);
    const kid = spawnCharacter(ctx, { name: 'ลูกป่วย', sex: 'm', birthYear: 2297, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
    kid.constitution = 0;
    mortalityYearTick(ctx);
    if (ctx.state.meta.childIllness === kid.id) events++;
    else if (!isAlive(kid)) diceDeaths++;
    // หลาน (ลูกของลูก) ไม่ได้ event — ใช้ลูกเต๋าเดิม
    delete ctx.state.meta.childIllness;
    const grown = spawnCharacter(ctx, { name: 'ลูกโต', sex: 'm', birthYear: 2280, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
    const grand = spawnCharacter(ctx, { name: 'หลานป่วย', sex: 'm', birthYear: 2297, estate: 'noble', father: grown, dynastyId: hero.dynastyId, householdId: hero.householdId });
    grand.constitution = 0;
    for (const c of Object.values(ctx.state.characters)) if (c.id !== grand.id && c.id !== hero.id) c.deathGraceUntil = ctx.state.meta.day + 400;
    mortalityYearTick(ctx);
    if (ctx.state.meta.childIllness === grand.id) grandEvents++;
  }
  Object.assign(M, keep);
  if (events < 10 || diceDeaths < 5) problems.push(`ลูกของผู้เล่นควรได้ทั้ง event และตายด้วยลูกเต๋า (event ${events} ลูกเต๋า ${diceDeaths} จาก 60)`);
  if (grandEvents) problems.push(`หลานได้ event ลูกไข้หนัก ${grandEvents} ครั้ง (ควรเป็นเฉพาะลูกของผู้เล่น)`);
  // event: ตัวเลือกครบ หมอยาเสียเงิน ตายแล้วถูกจัดการทันที
  const text = load('text.th.json') as Record<string, string>;
  let settled = false, paid = false;
  for (let i = 0; i < 40 && !settled; i++) {
    const ctx = makeCtx(emptyState(700 + i), content);
    const hero = bootstrapScenario(ctx);
    hero.social.wealth = 20;
    const kid = spawnCharacter(ctx, { name: 'ลูกป่วย', sex: 'f', birthYear: yearOf(ctx, ctx.state.meta.day) - 2, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
    const p = prepareEvent(ctx, 'family.child_grave_illness', { actor: hero.id, child: kid.id });
    if (i === 0) {
      const v = eventView(ctx, p, text);
      if (v.options.length !== 4 || v.options.some((o) => !o.text || /[{}]/.test(o.text) || !o.hint?.includes('ราว'))) problems.push(`ตัวเลือกลูกไข้หนักไม่ครบ/ไม่มีคำใบ้ความเสี่ยง: ${v.options.map((o) => o.text + ' | ' + o.hint).join(' / ')}`);
      if (/[{}]/.test(v.text)) problems.push(`ข้อความลูกไข้หนักมีตัวแปรค้าง: ${v.text}`);
      const w = hero.social.wealth;
      chooseOption(ctx, p, 'physician');
      paid = hero.social.wealth <= w - 3 + 1e-9;
      continue;
    }
    chooseOption(ctx, p, 'wait');
    if (!isAlive(kid)) {
      settled = !ctx.state.households[hero.householdId!]!.memberIds.includes(kid.id);
      if (!settled) problems.push('ลูกที่ตายใน event ยังค้างอยู่ในเรือน (ไม่ได้จัดการการตาย)');
      settled = true;
    }
  }
  if (!paid) problems.push('ตามหมอยาแล้วเงินไม่ลด 3 ตำลึง');
  // ผู้เล่นตายในรอบทอยเดียวกับที่ลูกได้ event → ไม่มีใครเลือก ลูกต้องทอยตายด้วยค่าเฉลี่ยของตัวเลือก (0.5) ไม่รอดฟรี
  let orphanDeaths = 0, orphanLogs = 0, orphanStuck = 0;
  const ORPHAN_N = 200;
  for (let i = 0; i < ORPHAN_N; i++) {
    const ctx = makeCtx(emptyState(900 + i), content);
    const hero = bootstrapScenario(ctx);
    ctx.state.meta.day = yearStart(ctx, 2300) - 1;
    const kid = spawnCharacter(ctx, { name: 'ลูกป่วย', sex: 'f', birthYear: 2297, estate: 'noble', father: hero, dynastyId: hero.dynastyId, householdId: hero.householdId });
    kid.deathGraceUntil = ctx.state.meta.day + 400; // กันลูกเต๋ารายปีฆ่าก่อน — วัดเฉพาะทางที่ส่ง event ไม่ได้
    ctx.state.meta.childIllness = kid.id;
    markDead(ctx, hero, 'situation:illness');
    const out = advanceDay(ctx);
    if (ctx.state.meta.childIllness) problems.push('ค้าง meta.childIllness หลังผู้เล่นตาย');
    if (out.some((o) => o.type === 'event' && o.prepared.def.id === 'family.child_grave_illness')) problems.push('ส่ง event ลูกไข้หนักทั้งที่ผู้เล่นตายแล้ว');
    if (!isAlive(kid)) {
      orphanDeaths++;
      if (out.some((o) => o.type === 'log' && o.line.startsWith(`${kid.name}เจ็บไข้ตาย`))) orphanLogs++;
      if (Object.values(ctx.state.households).some((h) => h.memberIds.includes(kid.id))) orphanStuck++;
    }
  }
  const orphanRate = orphanDeaths / ORPHAN_N;
  if (orphanRate < 0.38 || orphanRate > 0.62) problems.push(`ลูกไข้หนักที่ผู้เล่นตายไปก่อน ตาย ${(orphanRate * 100).toFixed(0)}% (ควรราว 50% เท่าเลือกสุ่ม)`);
  if (orphanLogs !== orphanDeaths) problems.push(`ลูกไข้หนักที่ตายเพราะไม่มีคนรักษา ไม่ขึ้น log ${orphanDeaths - orphanLogs} คน`);
  if (orphanStuck) problems.push(`ลูกไข้หนักที่ตายเพราะไม่มีคนรักษา ยังค้างในเรือน ${orphanStuck} คน`);
  check('ลูกไข้หนัก', problems);
  if (failed === before) console.log(`  ✓ ลูกของผู้เล่น: event ${events} · ตายด้วยลูกเต๋า ${diceDeaths} (จาก 60, ความเสี่ยงที่ตั้งไว้สูง) · หลานไม่ได้ event · ตัวเลือก 4 แบบมีคำใบ้ · หมอยาเสียเงิน · ตายแล้วออกจากเรือนทันที · ผู้เล่นตายก่อน ลูกยังเสี่ยง ${(orphanRate * 100).toFixed(0)}% (n=${ORPHAN_N})`);
}

// [5m] ชั้น 2c: ปลูกฝีให้ลูก (ตั้งแต่ 2382) — เสนอครั้งเดียวต่อเด็กที่ยังไม่เคยเป็นไข้ทรพิษ; ปลูกแล้วภูมิคุ้มกัน; เสี่ยงตายต่ำ
{
  const before = failed;
  console.log('ปลูกฝี:');
  const problems: string[] = [];
  /** ผู้เล่น + ภรรยา + ลูกอายุ 5 ขวบ ณ ปี year (ฉากเริ่มผู้เล่นอายุ 7 ไม่มีลูก) */
  const family = (seed: number, year: number) => {
    const c = makeCtx(emptyState(seed), content);
    const h = bootstrapScenario(c);
    const wife = spawnCharacter(c, { name: 'ภรรยา', sex: 'f', birthYear: 2290, estate: 'noble', dynastyId: null, householdId: null });
    marry(c, h, wife);
    const kid = spawnCharacter(c, { name: 'ลูกทดสอบ', sex: 'f', birthYear: 2285, estate: 'noble', father: h, mother: wife });
    c.state.meta.day = yearStart(c, year);
    kid.birthDay = c.state.meta.day - 5 * 365;
    kid.hadSmallpox = false;
    return { c, h, kid };
  };
  const early = family(31, 2381);
  if (inoculationEvent(early.c)) problems.push('ออก event ปลูกฝีก่อน 2382');
  const f1 = family(32, 2390);
  const first = inoculationEvent(f1.c);
  if (first?.def.id !== 'health.inoculation') problems.push('หลัง 2382 ไม่เสนอปลูกฝีให้ลูกที่ยังไม่เคยเป็นไข้ทรพิษ');
  if (inoculationEvent(f1.c)) problems.push('เสนอซ้ำให้เด็กที่ถูกเสนอแล้ว');
  const f2 = family(33, 2390);
  f2.kid.hadSmallpox = true;
  if (inoculationEvent(f2.c)) problems.push('เสนอให้เด็กที่เคยเป็นไข้ทรพิษแล้ว');
  const f3 = family(34, 2390);
  f3.kid.birthDay = f3.c.state.meta.day - 16 * 365;
  if (inoculationEvent(f3.c)) problems.push('เสนอให้คนอายุเกิน 14');

  let dead = 0;
  let immune = 0;
  let declinedDead = 0;
  const N = 1200;
  for (let i = 0; i < N; i++) {
    const t = family(9000 + i, 2390);
    chooseOption(t.c, prepareEvent(t.c, 'health.inoculation', { actor: t.h.id, child: t.kid.id }), 'inoculate');
    if (!isAlive(t.kid)) dead++;
    else if (t.kid.hadSmallpox) immune++;
    const u = family(19000 + i, 2390);
    chooseOption(u.c, prepareEvent(u.c, 'health.inoculation', { actor: u.h.id, child: u.kid.id }), 'decline');
    if (!isAlive(u.kid)) declinedDead++;
  }
  if (immune + dead < N * 0.97) problems.push(`ปลูกแล้วไม่ได้ภูมิ: ${immune} รอด + ${dead} ตาย จาก ${N}`);
  if (dead < N * 0.005 || dead > N * 0.04) problems.push(`ปลูกฝีตาย ${dead}/${N} (คาดราว 1.8% ≈ ${Math.round(N * 0.018)})`);
  if (declinedDead) problems.push(`ไม่ปลูกแล้วเด็กตายทันที ${declinedDead}`);
  check('ปลูกฝี', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ ไม่ออกก่อน 2382 · เสนอครั้งเดียวต่อเด็กที่ยังไม่เคยเป็นไข้ทรพิษอายุ 1–14 · ปลูกแล้วได้ภูมิ ตาย ${dead}/${N} (${(100 * dead / N).toFixed(1)}%) · ไม่ปลูกไม่มีใครตาย`);
}

// [5n] ชั้น 2a: ลอบฆ่าสำเร็จ → ญาติล้างแค้น; พลาดแล้วถูกโบย — เฉพาะผู้เล่นที่สั่งฆ่า
{
  const before = failed;
  console.log('ล้างแค้น:');
  const problems: string[] = [];
  // 1) ลอบฆ่าสำเร็จ → มีเรื่องรอ; พลาด → ถูกโบยเป็นบาดแผล
  let success = 0;
  let caught = 0;
  let caughtWound = 0;
  for (let i = 0; i < 80; i++) {
    const c = makeCtx(emptyState(11000 + i), content);
    const h = bootstrapScenario(c);
    h.birthDay = c.state.meta.day - 25 * 365;
    const victim = spawnLocal(c, h, { sex: 'm', age: 30, distance: 'near' });
    const r = chooseOption(c, prepareEvent(c, 'scheme.assassin', { actor: h.id, target: victim.id }), 'cheap');
    if (r.outcome?.failed) { caught++; if (h.woundIds.length) caughtWound++; }
    else if (c.state.meta.feuds?.some((f) => f.actorId === h.id && f.dueDay > c.state.meta.day)) success++;
  }
  if (success === 0) problems.push('ลอบฆ่าสำเร็จแล้วไม่มีเรื่องล้างแค้นรอ');
  if (caught === 0 || caughtWound !== caught) problems.push(`พลาดถูกจับ ${caught} ครั้ง แต่ถูกโบยเป็นแผล ${caughtWound}`);

  // 2) เรื่องถึงกำหนด → event ออกครั้งเดียวให้ผู้สั่งฆ่า; ผู้สั่งตายแล้วเรื่องจบ ไม่ตกถึงผู้สืบ
  const c2 = makeCtx(emptyState(41), content);
  const h2 = bootstrapScenario(c2);
  h2.birthDay = c2.state.meta.day - 25 * 365;
  c2.state.meta.feuds = [{ actorId: h2.id, dueDay: c2.state.meta.day + 10 }];
  if (feudEvent(c2)) problems.push('ล้างแค้นออกก่อนถึงกำหนด');
  c2.state.meta.day += 20;
  const ev = feudEvent(c2);
  if (ev?.def.id !== 'feud.revenge') problems.push('ถึงกำหนดแล้วไม่มี event ล้างแค้น');
  if (feudEvent(c2)) problems.push('ล้างแค้นออกซ้ำ');
  const c3 = makeCtx(emptyState(42), content);
  const h3 = bootstrapScenario(c3);
  h3.birthDay = c3.state.meta.day - 25 * 365;
  c3.state.meta.feuds = [{ actorId: h3.id, dueDay: c3.state.meta.day - 1 }];
  markDead(c3, h3, 'situation:old_age');
  if (feudEvent(c3) || c3.state.meta.feuds) problems.push('ผู้สั่งฆ่าตายแล้วเรื่องล้างแค้นยังค้างอยู่');

  // 3) ผลของตัวเลือก: ไกล่เกลี่ย/ย้ายไม่มีใครตาย; คุ้มกันตาย ~2.5%; เพิกเฉยตาย ~12%
  const rate = (opt: string, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(13000 + i), content);
      const h = bootstrapScenario(c);
      h.birthDay = c.state.meta.day - 25 * 365;
      h.skills['combat'] = 0;
      const a = spawnLocal(c, h, { sex: 'm', age: 35, distance: 'far' });
      chooseOption(c, prepareEvent(c, 'feud.revenge', { actor: h.id, avenger: a.id }), opt);
      if (!isAlive(h)) dead++;
    }
    return dead / n;
  };
  const settle = rate('settle', 300);
  const move = rate('move', 300);
  const guards = rate('guards', 1500);
  const ignore = rate('ignore', 800);
  if (settle !== 0 || move !== 0) problems.push(`ไกล่เกลี่ย/ย้ายไม่ควรมีคนตาย (${settle}, ${move})`);
  if (guards < 0.005 || guards > 0.06) problems.push(`จ้างคนคุ้มกัน ตาย ${(guards * 100).toFixed(1)}% (คาดราว 2.5%)`);
  if (ignore < 0.06 || ignore > 0.2) problems.push(`เพิกเฉย ตาย ${(ignore * 100).toFixed(1)}% (คาดราว 12%)`);
  if (!(ignore > guards * 2)) problems.push('เพิกเฉยควรอันตรายกว่าจ้างคนคุ้มกันชัดเจน');
  check('ล้างแค้น', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ ฆ่าสำเร็จมีเรื่องรอ (${success}/80) · พลาดถูกโบยเป็นแผลทุกครั้ง (${caught}) · event ออกครั้งเดียวและไม่ตกถึงผู้สืบ · ตาย: ไกล่เกลี่ย/ย้าย 0 · คุ้มกัน ${(guards * 100).toFixed(1)}% · เพิกเฉย ${(ignore * 100).toFixed(1)}%`);
}

// [5o] ผลชดเชยเมื่อตายจากการกระทำกล้า (จมน้ำตอนช่วยคน / ฟันตอนนำจับโจร): ตระกูลได้บารมี ผู้สืบเห็นข้อความ — ตายแบบอื่นไม่ได้
{
  const before = failed;
  console.log('ผลชดเชยการตายอย่างกล้า:');
  const problems: string[] = [];
  const run = (cause: string) => {
    const c = makeCtx(emptyState(77), content);
    const h = bootstrapScenario(c);
    const dyn = c.state.dynasties[h.dynastyId!]!;
    markDead(c, h, cause as never);
    const rep = performHandover(c, h.id);
    return { prestige: dyn.prestige, said: rep.log.some((l) => l.includes('จากไปด้วยความกล้า')) };
  };
  const base = run('situation:old_age');
  const B = content.balance.inheritance;
  for (const cause of B.heroicDeathCauses) {
    const r = run(cause);
    if (!r.said) problems.push(`${cause}: ไม่มีข้อความถึงผู้สืบ`);
    if (Math.abs(r.prestige - base.prestige - B.heroicDeathPrestige) > 0.01) problems.push(`${cause}: บารมีต่างจากตายตามวัย ${(r.prestige - base.prestige).toFixed(2)} (คาด ${B.heroicDeathPrestige})`);
  }
  for (const cause of ['situation:illness', 'situation:feud', 'situation:wound_fever', 'situation:old_age']) {
    const r = run(cause);
    if (r.said || Math.abs(r.prestige - base.prestige) > 0.01) problems.push(`${cause}: ไม่ควรได้ผลชดเชย`);
  }
  // ตัวเลือกที่ตายได้โดยกล้าต้องเป็นสาเหตุเดียวกับที่ชดเชย (กันแก้ cause ใน event แล้วชดเชยหลุด)
  const causesOf = (evId: string, optId: string) => content.events[evId]!.options.find((o) => o.id === optId)!.risk!.fail.effects.flatMap((f) => (f.op === 'kill' ? [f.cause] : []));
  for (const [evId, optId] of [['life.drowning', 'dive'], ['career.patrol_thief', 'lead']] as const) {
    for (const cause of causesOf(evId, optId)) if (!B.heroicDeathCauses.includes(cause)) problems.push(`${evId}.${optId} ตายด้วย ${cause} ที่ไม่อยู่ใน heroicDeathCauses`);
  }
  check('ผลชดเชยการตายอย่างกล้า', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ ${B.heroicDeathCauses.join(', ')} → บารมีตระกูล +${B.heroicDeathPrestige} และผู้สืบเห็นข้อความ · ตายแบบอื่นไม่ได้`);
}

// [5p] งานเล็กของชุดความเสี่ยง: โหมงานจนป่วยหนัก (เสี่ยงตายรายปีสูงขึ้น) · ใส่ความคู่แข่งพลาดแล้วถูกโบย · ป้าย "รอดตายมาแล้ว N ครั้ง"
{
  const before = failed;
  console.log('งานเล็กชุดความเสี่ยง:');
  const problems: string[] = [];
  const failFx = (evId: string, optId: string) => content.events[evId]!.options.find((o) => o.id === optId)!.risk!.fail.effects;
  if (!failFx('adult.heavy_heart', 'work').some((f) => f.op === 'ill')) problems.push('โหมงานพลาดแล้วไม่ป่วยหนัก');
  if (!failFx('career.rival_accuses', 'counter').some((f) => f.op === 'wound')) problems.push('ใส่ความพลาดแล้วไม่ถูกโบย');

  // ป่วยหนักปีที่ผ่านมา → ความเสี่ยงตายรายปีของผู้เล่นเพิ่ม ×illMult (ไม่เพิ่มให้ NPC)
  const yearDeaths = (ill: boolean, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(15000 + i), content);
      const h = bootstrapScenario(c);
      c.state.meta.day = yearStart(c, 2330);
      h.birthDay = c.state.meta.day - 45 * 365;
      h.stress = 0;
      if (ill) h.illYear = 2329;
      mortalityYearTick(c);
      if (!isAlive(h)) dead++;
    }
    return dead;
  };
  const well = yearDeaths(false, 4000);
  const sick = yearDeaths(true, 4000);
  if (!(sick > well * 1.25)) problems.push(`ป่วยหนักตาย ${sick}/4000 ไม่มากกว่าปกติ ${well}/4000 ชัดเจน (คาด ×${content.balance.mortality.illMult})`);

  // รอดตายแล้วนับ closeCalls และขึ้นป้าย
  const c = makeCtx(emptyState(66), content);
  const h = bootstrapScenario(c);
  h.closeCalls = 2;
  const badges = playerView(c).statuses.map((b) => b.label);
  if (!badges.includes('รอดตายมาแล้ว 2 ครั้ง')) problems.push(`ไม่มีป้ายรอดตาย (มี: ${badges.join(', ')})`);
  let survived = 0;
  for (let i = 0; i < 300; i++) {
    const cc = makeCtx(emptyState(16000 + i), content);
    const hh = bootstrapScenario(cc);
    hh.birthDay = cc.state.meta.day - 25 * 365;
    const a = spawnLocal(cc, hh, { sex: 'm', age: 35, distance: 'far' });
    chooseOption(cc, prepareEvent(cc, 'feud.revenge', { actor: hh.id, avenger: a.id }), 'ignore');
    if (isAlive(hh) && hh.woundIds.length && (hh.closeCalls ?? 0) > 0) survived++;
  }
  if (survived === 0) problems.push('รอดการลอบทำร้ายแล้ว closeCalls ไม่เพิ่ม');
  check('งานเล็กชุดความเสี่ยง', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ โหมงานพลาด→ป่วยหนัก (ตายรายปี ${well}→${sick}/4000) · ใส่ความพลาด→ถูกโบย · ป้ายรอดตาย + นับเมื่อรอดจริง (${survived}/300)`);
}

// [5q] ไข้หนัก: ผู้เล่นอายุ 15–59 ที่ทอยตายด้วยไข้ ส่วนหนึ่งกลายเป็น event ให้เลือกวิธีรักษา — ตายเฉลี่ยของผู้เล่นสุ่มคงเดิม รอบคอบดีกว่า ประมาทแย่กว่า
{
  const before = failed;
  console.log('ไข้หนัก (เลือกวิธีรักษา):');
  const problems: string[] = [];
  const M = content.balance.mortality;
  const optionRate = (opt: string, n: number) => {
    let dead = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(21000 + i), content);
      const h = bootstrapScenario(c);
      h.birthDay = c.state.meta.day - 40 * 365;
      chooseOption(c, prepareEvent(c, 'body.grave_illness', { actor: h.id }), opt);
      if (!isAlive(h)) { dead++; if (h.deathCause !== 'situation:fever') problems.push(`ตายด้วย ${h.deathCause}`); }
    }
    return dead / n;
  };
  const phys = optionRate('physician', 800);
  const folk = optionRate('folk', 800);
  const endure = optionRate('endure', 800);
  if (Math.abs(phys - 0.3) > 0.07 || Math.abs(folk - 0.5) > 0.07 || Math.abs(endure - 0.7) > 0.07) problems.push(`ตายตามวิธีรักษา หมอยา ${phys.toFixed(2)} (0.3) พื้นบ้าน ${folk.toFixed(2)} (0.5) ทนเอง ${endure.toFixed(2)} (0.7)`);
  if (!(phys < folk && folk < endure)) problems.push('ลำดับความเสี่ยงของวิธีรักษาผิด');

  // ตายเฉลี่ยทั้งปีของผู้เล่นอายุ 55: ลูกเต๋าล้วน (diceShare 1) เทียบกับมี event + เลือกวิธีรักษาแบบสุ่ม — ต้องใกล้กัน
  const yearDeaths = (diceShare: number, policy: 'random' | 'physician' | 'endure', n: number) => {
    const saved = M.graveIllnessDiceShare;
    M.graveIllnessDiceShare = diceShare;
    let dead = 0;
    let events = 0;
    for (let i = 0; i < n; i++) {
      const c = makeCtx(emptyState(30000 + i), content);
      const h = bootstrapScenario(c);
      c.state.meta.day = yearStart(c, 2330);
      h.birthDay = c.state.meta.day - 55 * 365;
      h.stress = 0;
      mortalityYearTick(c);
      if (c.state.meta.graveIllness) {
        events++;
        const opts = ['physician', 'folk', 'endure'];
        const pick = policy === 'random' ? opts[Math.floor(c.rng.next() * 3)]! : policy;
        chooseOption(c, prepareEvent(c, 'body.grave_illness', { actor: h.id }), pick);
      }
      if (!isAlive(h)) dead++;
    }
    M.graveIllnessDiceShare = saved;
    return { dead, events };
  };
  const N = 15000;
  const dice = yearDeaths(1, 'random', N);
  const rnd = yearDeaths(M.graveIllnessDiceShare, 'random', N);
  const careful = yearDeaths(M.graveIllnessDiceShare, 'physician', N);
  const reckless = yearDeaths(M.graveIllnessDiceShare, 'endure', N);
  if (dice.events !== 0) problems.push('diceShare 1 แต่ยังมี event ไข้หนัก');
  if (Math.abs(rnd.dead - dice.dead) > dice.dead * 0.22) problems.push(`ผู้เล่นสุ่มตาย ${rnd.dead}/${N} ต่างจากลูกเต๋าล้วน ${dice.dead}/${N} เกิน 22%`);
  if (!(careful.dead < rnd.dead && rnd.dead < reckless.dead)) problems.push(`ลำดับตายรายปี รอบคอบ ${careful.dead} สุ่ม ${rnd.dead} ประมาท ${reckless.dead}`);
  check('ไข้หนัก', problems.slice(0, 4));
  if (failed === before) console.log(`  ✓ ตายตามวิธีรักษา ${(phys * 100).toFixed(0)}/${(folk * 100).toFixed(0)}/${(endure * 100).toFixed(0)}% · ตายรายปีอายุ 55 (n=${N}): ลูกเต๋าล้วน ${dice.dead} · สุ่ม ${rnd.dead} · หมอยา ${careful.dead} · ทนเอง ${reckless.dead}`);
}

// [7] ปฏิทินจันทรคติเทียบวันที่ที่รู้แน่ (Gislén & Eade, JAHH 22(3) 2019 และวันที่ในพงศาวดาร)
{
  const before = failed;
  console.log('ปฏิทินจันทรคติ:');
  const jdCases: Array<[number, number, number, boolean, number]> = [
    // JD, จ.ศ., เดือน, เดือน 8 หลัง, วันที่ในเดือน (1–30)
    [2337769, 1050, 8, false, 1],
    [2337872, 1050, 11, false, 15],
    [2337919, 1050, 1, false, 3],
    [2392934, 1201, 8, true, 2],
  ];
  check('วันที่อ้างอิง', jdCases.flatMap(([jd, y, m, second, d]) => {
    const l = lunarFromJd(jd);
    return l.csYear === y && l.month === m && l.secondEighth === second && l.day === d ? [] : [`JD ${jd} → จ.ศ. ${l.csYear} เดือน ${l.month} วัน ${l.day}`];
  }));
  const chronicle: Array<[[number, number, number], string]> = [
    [[1680, 4, 10], 'วันพุธ ขึ้น 12 ค่ำ เดือน 5 ปีวอก จ.ศ. 1042'], // vocab.chronicle_date_format
    [[1767, 4, 7], 'วันอังคาร ขึ้น 9 ค่ำ เดือน 5 ปีกุน จ.ศ. 1129'], // เสียกรุงครั้งที่ 2
  ];
  check('วันที่ในพงศาวดาร', chronicle.flatMap(([[y, m, d], want]) => {
    const got = formatLunar(lunarFromJd(gregorianToJd(y, m, d)));
    return got === want ? [] : [`${y}-${m}-${d}: ${got} ≠ ${want}`];
  }));
  const pt = formatPortuguese(solarDate(2280, gregorianToJd(1680, 4, 10) - epochJd(2280)));
  check('วันที่แบบโปรตุเกส', pt === '10 de Abril de 1680' ? [] : [pt]);
  if (failed === before) console.log('  ✓ ตรงทุกวัน');
}

if (failed) {
  console.log(`\nไม่ผ่าน ${failed} ข้อ`);
  process.exit(1);
}
console.log('\nผ่านทั้งหมด');
