// npm run sim:check — รันโลกจริง (advanceDay) หลาย seed แล้วตรวจ invariant ของ state
// exit code ≠ 0 เมื่อมีข้อใดผิด → ใช้เป็น regression test ได้โดยไม่ต้องมี test framework
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { epochJd, formatLunar, formatPortuguese, gregorianToJd, lunarFromJd, solarDate, yearsToDays } from './core/calendar';
import { ageOf, dayOfYear, isAlive, makeCtx, yearOf, yearStart, type Ctx } from './core/ctx';
import type { Character, ContentDB } from './core/types';
import { chooseOption, prepareEvent, prepareFollowUp, requirementsMet, type PreparedEvent } from './systems/events';
import { emptyState, marry, spawnCharacter } from './systems/factory';
import { applyHistoricalShocks, estateHeirs, heirCandidates, markDead, performHandover } from './systems/handover';
import { knownLocals, setRelation, spawnLocal } from './systems/acquaintance';
import { applyMarriageStep, purse } from './systems/marriage';
import { activeIntent, planIntent, startIntent, targetProblem } from './systems/intent';
import { bootstrapScenario } from './systems/scenario';
import { kinYearTick, markNursing } from './systems/lifeEvents';
import { applyCareer, careerSkill, careerYearTick, officeRank, officeStatus, officeTier } from './systems/career';
import { habitOption } from './systems/festivals';
import { findSlaveConcubines, performInteraction, takeSlaveConcubine } from './systems/interactions';
import { dropMatches } from './systems/matchmaking';
import { buyHouseholdLand, buyHouseholdSlave, expandHousehold, freeHouseholdSlave, houseCapacity, householdMonth } from './systems/servants';
import { hasPerk, legacyLevel, mortalityShield, setSkillFocus, SKILL_TRACKS, skillsMonthTick, skillsYearTick, unlockDynastyLegacy, unlockNextPerk } from './systems/skills';
import { jealousyEvent, livingWives, minorWifeProblem, takeMinorWife } from './systems/wives';
import { advanceDay } from './systems/world';
import { eraConditions } from './engine/views';
import { settlePlayerDeath } from './engine/death';
import { buryValuables, unearthBuried } from './systems/war';
import { riskChance } from './systems/will';

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
// ตัวชี้วัดสมดุลฝั่งผู้เล่น (balanceCheck) — เก็บจากการเล่นอัตโนมัติ "เลือกตัวเลือกแรกเสมอ" แบบเดียวกับที่ BACKLOG ใช้วัด
const bal = {
  firstDeathAges: [] as number[], // อายุที่ตัวละครแรกของผู้เล่นตาย (seed ที่ยังไม่ตายจนจบไม่นับ)
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

// [1] รันโลก
for (let seed = 1; seed <= SEEDS; seed++) {
  const ctx = makeCtx(emptyState(seed), content);
  bootstrapScenario(ctx);
  const S = ctx.state;
  const tracked = new Map<string, Character>();
  trackDemography(ctx, tracked);
  let over = false;
  const heroId = S.meta.playerCharacterId;
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
    for (const sig of advanceDay(ctx)) {
      if (sig.type === 'event') {
        // เลือกตัวเลือกแรกที่ไม่ล็อก แล้วเล่น event ต่อเนื่อง (followUp) จนจบสาย
        if (sig.prepared.def.id === 'family.hard_to_raise') hardToRaise++;
        for (let p: PreparedEvent | null = sig.prepared; p; ) {
          const opt = p.options.find((o) => !p!.locked.has(o.id));
          if (!opt) throw new Error(`seed ${seed}: event ${p.def.id} ไม่มีตัวเลือกที่เลือกได้`);
          p = prepareFollowUp(ctx, p, chooseOption(ctx, p, opt.id));
        }
      } else if (sig.type === 'playerDied') {
        const dead = S.characters[S.meta.playerCharacterId]!;
        if (dead.id === heroId) bal.firstDeathAges.push(ageOf(ctx, dead, dead.deathDay ?? S.meta.day));
        if (!heirCandidates(ctx, dead).length) {
          over = true;
          break;
        }
        performHandover(ctx, dead.id);
        bal.takeoverAges.push(ageOf(ctx, S.characters[S.meta.playerCharacterId]!));
      }
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
    // P0 (BACKLOG): ตัวละครแรกตายก่อนอายุ 30 บ่อยเกินไปเพราะเสียกรุง 2310 โดยไม่มีทางเลือก — วัดได้ราว 18% ตอนเขียนเทสต์นี้
    ['ตัวละครแรกตายก่อนอายุ 30', bal.firstDeathAges.filter((a) => a < 30).length / SEEDS, 0, 0.35],
    ['ตระกูลสิ้นสายก่อนจบเรื่อง', extinct / SEEDS, 0, 0.25],
    ['อายุมัธยฐานของผู้สืบตอนรับช่วง', median(bal.takeoverAges), 25, 60],
    ['ความหนักใจเฉลี่ยของผู้เล่น', ratio(bal.stress), 0.05, 0.35],
    [`ผู้เล่นมีตำแหน่งราชการ (ตั้งแต่ พ.ศ. ${OFFICE_FROM_YEAR})`, ratio(bal.office), 0.15, 0.6],
    ['เงินเฉลี่ยต่อคนในตระกูลตอนจบ (ตำลึง)', median(bal.wealthPerHead), 10, 150],
  ];
  const enforce = SEEDS >= BALANCE_MIN_SEEDS && !INVEST; // โหมด invest เป็นการทดลอง ไม่นับเป็นข้อผิด
  console.log(`สมดุลของผู้เล่น (${SEEDS} seed${enforce ? '' : INVEST ? ' — โหมด invest เป็นรายงานเฉยๆ' : ` — น้อยกว่า ${BALANCE_MIN_SEEDS} จึงเป็นรายงานเฉยๆ`}):`);
  const bad: string[] = [];
  for (const [label, v, lo, hi] of rows) {
    const ok = v >= lo && v <= hi; // NaN = ไม่มีข้อมูล ถือว่าไม่ผ่าน
    console.log(`  ${ok ? '✓' : enforce ? '✗' : '⚠'} ${label} ${+v.toFixed(3)} (ช่วงที่ยอมรับ ${lo}–${hi})`);
    if (!ok) bad.push(`${label} ${+v.toFixed(3)}`);
  }
  console.log(`  · ผู้เล่นถึงขั้นขุนขึ้นไป (ตั้งแต่ พ.ศ. ${OFFICE_FROM_YEAR}) ${+ratio(bal.senior).toFixed(3)}${INVEST ? ' [โหมด invest]' : ''}`);
  if (enforce) check('สมดุลของผู้เล่นหลุดช่วง', bad);
}
balanceCheck();

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
  check('ข้อแลกเปลี่ยนใน event ที่เจอบ่อย', problems);
  if (failed === before) console.log('  ✓ งานบุญและผลผูกมิตรมีทั้งตัวเลือกเสียเงินและไม่เสีย · เสียแล้วเงินลดจริง');
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
  for (let i = 0; i < 26; i++) skillsMonthTick(ctx);
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
