// npm run sim:check — รันโลกจริง (advanceDay) หลาย seed แล้วตรวจ invariant ของ state
// exit code ≠ 0 เมื่อมีข้อใดผิด → ใช้เป็น regression test ได้โดยไม่ต้องมี test framework
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { epochJd, formatLunar, formatPortuguese, gregorianToJd, lunarFromJd, solarDate, yearsToDays } from './core/calendar';
import { ageOf, dayOfYear, isAlive, makeCtx, yearOf, type Ctx } from './core/ctx';
import type { Character, ContentDB } from './core/types';
import { chooseOption, prepareFollowUp, type PreparedEvent } from './systems/events';
import { emptyState, marry, spawnCharacter } from './systems/factory';
import { estateHeirs, heirCandidates, markDead, performHandover } from './systems/handover';
import { knownLocals } from './systems/acquaintance';
import { activeIntent, planIntent, startIntent, targetProblem } from './systems/intent';
import { bootstrapScenario } from './systems/scenario';
import { advanceDay } from './systems/world';

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
const YEARS = 110;
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
  for (let d = 0; d < yearsToDays(YEARS) && !over; d++) {
    // กลางปี: ผู้เล่นที่ว่างอยู่ตั้งใจทำอะไรสักอย่างกับคนที่รู้จัก (สุ่มคน/สิ่งที่ตั้งใจ/วิธี) — ทดสอบระบบ intent
    const player = S.characters[S.meta.playerCharacterId];
    if (dayOfYear(ctx, S.meta.day) === 180 && isAlive(player) && !activeIntent(ctx, player.id) && ctx.rng.chance(0.6)) {
      const options = knownLocals(ctx, player).flatMap((t) => Object.values(content.intents)
        .filter((def) => !targetProblem(ctx, def, player, t))
        .flatMap((def) => planIntent(ctx, def.id, player, t).filter((p) => !p.unavailable).map((p) => ({ def, t, p }))));
      const pick = ctx.rng.pick(options);
      if (pick) startIntent(ctx, pick.def.id, player, pick.t, pick.p.def.id);
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
        if (!heirCandidates(ctx, dead).length) {
          over = true;
          break;
        }
        performHandover(ctx, dead.id);
      }
    }
    trackDemography(ctx, tracked);
  }
  if (over) extinct++;
  const before = failed;
  console.log(`seed ${seed}: ถึงปี ${yearOf(ctx, S.meta.day)}${over ? ' (สิ้นสาย)' : ''}`
    + ` · ตัวละคร ${Object.keys(S.characters).length} · node ${Object.keys(S.familyNodes).length}`
    + ` · เซฟ ${(JSON.stringify(S).length / 1024).toFixed(0)} KB`);
  invariants(ctx, over);
  if (failed === before) console.log(over ? '  ✓ invariant ครบ (ข้ามข้อมรดกเพราะเกมจบ)' : '  ✓ invariant ครบ');
}
demographyReport();

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

// [5] ปฏิทินจันทรคติเทียบวันที่ที่รู้แน่ (Gislén & Eade, JAHH 22(3) 2019 และวันที่ในพงศาวดาร)
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
