// Demo: รัน flow ทั้งหมดบน content ตัวอย่าง
//   Part 1 — Monte Carlo ของ "มีดบาดตอนหั่นผัก" เพื่อดูการกระจายของปมตรง vs ปมเพี้ยน
//   Part 2 — เล่าเรื่องตระกูลหนึ่ง 4 รุ่น: แผลเป็น → ปม → กฎในเรือน → ข้อห้ามตระกูล → ตำนานบิดเบือน
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { ageOf, isAlive, makeCtx, must, yearOf, type Ctx } from './core/ctx';
import type { Character, ContentDB, Dynasty, TagId } from './core/types';
import { capability, tickWounds } from './systems/body';
import { chooseOption, prepareEvent } from './systems/events';
import { createDynasty, createHousehold, emptyState, livingChildren, marry, spawnCharacter } from './systems/factory';
import { applyHistoricalShocks, markDead, performHandover, settleDeath } from './systems/handover';
import { renderLegend } from './systems/legend';
import { householdYearTick } from './systems/socialLearning';
import { describeTrait } from './systems/traits';
import { lifeMilestones } from './systems/world';

const load = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'content', f), 'utf8'));
const content: ContentDB = buildContentDB({
  names: load('names.json'),
  tags: load('tags.json'),
  anatomy: load('anatomy.json'),
  traitKinds: load('traitKinds.json'),
  events: load('events.json'),
  rules: load('rules.json'),
  balance: load('balance.json'),
});
const B = content.balance;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`.padStart(6);

function category(ctx: Ctx, tag: TagId): 'direct' | 'food' | 'sensation' | 'other' {
  if (ctx.tags.isA(tag, 'property:bladed') || ctx.tags.isA(tag, 'tool:sharp')) return 'direct';
  if (ctx.tags.isA(tag, 'food:any')) return 'food';
  if (ctx.tags.isA(tag, 'sensation:any')) return 'sensation';
  return 'other';
}

// ============================================================================
// Part 1
// ============================================================================

function monteCarlo(N: number): void {
  console.log(`\n=== Part 1: Monte Carlo — มีดบาดตอนหั่นผัก (N=${N} ต่อแถว, บุคลิกสุ่ม) ===`);
  console.log('อายุ  ตัวเลือก   ไม่มีปม  ปมตรง  ปมเพี้ยน(ผัก)  เลือด/อื่น | เพี้ยนเมื่อเป็นฟักทอง  เพี้ยนเมื่อเป็นแตงกวา');
  const kinds: Record<string, number> = {};
  for (const age of [5, 8, 12]) {
    for (const option of ['cry', 'hide'] as const) {
      const c = { none: 0, direct: 0, food: 0, other: 0, pumpkin: 0, pumpkinN: 0, cucumber: 0, cucumberN: 0 };
      for (let i = 0; i < N; i++) {
        const ctx = makeCtx(emptyState(1000 + i * 7919 + age * 31 + (option === 'cry' ? 0 : 17)), content);
        const mother = spawnCharacter(ctx, { name: 'แม่', sex: 'f', birthYear: 2260, estate: 'phrai_som' });
        const child = spawnCharacter(ctx, { name: 'ลูก', sex: 'm', birthYear: 2280, estate: 'phrai_som', mother });
        ctx.state.meta.day = child.birthDay + age * B.daysPerYear;
        const p = prepareEvent(ctx, 'childhood.kitchen_cut', { actor: child.id, caregiver: mother.id });
        const tr = chooseOption(ctx, p, option).trauma[0];
        const cats = new Set((tr?.branches ?? []).map((b) => category(ctx, b.target)));
        for (const b of tr?.branches ?? []) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
        if (!cats.size) c.none++;
        if (cats.has('direct')) c.direct++;
        if (cats.has('food')) c.food++;
        if (cats.has('sensation') || cats.has('other')) c.other++;
        const isPumpkin = p.instance.vars['target_food'] === 'food:pumpkin';
        if (isPumpkin) c.pumpkinN++;
        else c.cucumberN++;
        if (cats.has('food')) isPumpkin ? c.pumpkin++ : c.cucumber++;
      }
      console.log(
        `${String(age).padStart(3)}   ${option.padEnd(6)}  ${pct(c.none / N)} ${pct(c.direct / N)}  ${pct(c.food / N)}     ${pct(c.other / N)}  |` +
          `      ${pct(c.pumpkin / c.pumpkinN)}               ${pct(c.cucumber / c.cucumberN)}`,
      );
    }
  }
  const total = Object.values(kinds).reduce((a, b) => a + b, 0);
  console.log('ชนิดของปมที่เกิด:', Object.entries(kinds).map(([k, v]) => `${k} ${pct(v / total).trim()}`).join(', '));
}

// ============================================================================
// Part 2
// ============================================================================

function story(seed: number, verbose: boolean): boolean {
  const ctx = makeCtx(emptyState(seed), content);
  const say = (...a: unknown[]) => {
    if (verbose) console.log(...a);
  };
  const setYear = (y: number) => (ctx.state.meta.day = (y - B.epochYear) * B.daysPerYear + 5);
  const saveSize = () => `${(JSON.stringify(ctx.state).length / 1024).toFixed(1)} KB`;

  setYear(2284);
  const father = spawnCharacter(ctx, { name: 'หมื่นอิน', sex: 'm', birthYear: 2250, estate: 'noble', wealth: 600 });
  const dyn = createDynasty(ctx, 'บ้านริมคลองตะเคียน', father, 'faction:taksin_loyalist');
  father.social.title = 'หมื่นอินทรรักษา';
  const hh = createHousehold(ctx, father);
  const mother = spawnCharacter(ctx, {
    name: 'แย้ม', sex: 'f', birthYear: 2262, estate: 'noble', householdId: hh.id, personality: { neuroticism: 0.85 },
  });
  const minorWife = spawnCharacter(ctx, { name: 'จันทร์', sex: 'f', birthYear: 2264, estate: 'phrai_som', householdId: hh.id });
  marry(ctx, father, mother);
  marry(ctx, father, minorWife);
  const hero = spawnCharacter(ctx, {
    name: 'บุญมา', sex: 'm', birthYear: 2284, estate: 'noble', father, mother,
    personality: { imagination: 0.75, neuroticism: 0.65, boldness: 0.3, pride: 0.7, agreeableness: 0.5 },
  });
  spawnCharacter(ctx, { name: 'บุญมี', sex: 'm', birthYear: 2286, estate: 'phrai_som', father, mother: minorWife, parentage: 'minor_wife' });
  const item = (tag: TagId, kind: 'house' | 'land' | 'gold' | 'manual', value: number, hidden = false, dynOwned = false) => {
    const id = `itm_${tag}` as never;
    ctx.state.items[id] = {
      id, tag, kind, value, hidden, condition: 1,
      ownerCharacterId: dynOwned ? null : father.id, ownerDynastyId: dynOwned ? dyn.id : null,
    };
  };
  item('house:riverside', 'house', 200);
  item('land:paddy_north', 'land', 150);
  item('land:orchard', 'land', 100);
  item('gold:buried_jar', 'gold', 120, true);
  item('manual:goldsmith', 'manual', 50, false, true);
  ctx.state.meta.playerCharacterId = hero.id;
  ctx.state.meta.playerDynastyId = dyn.id;

  // ---------------- เหตุการณ์ในวัยเด็ก ----------------
  ctx.state.meta.day = hero.birthDay + 6 * B.daysPerYear + 130; // ต้นหน้าฝน
  const prepared = prepareEvent(ctx, 'childhood.kitchen_cut', { actor: hero.id, caregiver: mother.id }, { target_food: 'food:pumpkin' });
  const rep = chooseOption(ctx, prepared, 'cry');
  const tr = must(rep.trauma[0], 'trauma');
  const outcomes = [];
  for (let d = 0; d < 150; d++) {
    ctx.state.meta.day++;
    outcomes.push(...tickWounds(ctx, hero));
  }
  const scarred = outcomes.some((o) => o.scar);
  const bizarre = tr.branches.some((b) => b.misattributed && category(ctx, b.target) === 'food');
  const direct = tr.branches.some((b) => category(ctx, b.target) === 'direct');
  if (!verbose) return scarred && bizarre && direct;

  say(`\n=== Part 2: ตระกูล${dyn.name} (seed ${seed}) ===`);
  say(`\n[${yearOf(ctx, prepared.instance.day)}] ${hero.name} อายุ 6 ขวบ ช่วยแม่${mother.name}ผ่าฟักทองในโรงครัว มีดพลาดบาดนิ้ว`);
  say(`  impact=${tr.impact.toFixed(2)}  rationality=${tr.rationality.toFixed(2)} (เด็ก+จินตนาการ ${hero.personality.imagination})`);
  say('  สมองโทษอะไร:', tr.attribution.map((a) => `${ctx.tags.label(a.tag)}(${a.role}) ${pct(a.weight).trim()}`).join(' | '));
  for (const b of tr.branches) {
    say(`  → ปม: ${describeTrait(ctx, must(ctx.state.traits[b.traitId], 'trait'))}` +
      `  [fixation=${ctx.tags.label(b.tag)}, ${b.misattributed ? 'จำผิด/เพี้ยน' : 'ตรงเหตุ'}, generalize ${b.generalizedSteps} ขั้น]`);
  }
  for (const o of outcomes) {
    say(`  แผลที่${content.anatomies.human!.parts[o.partDefId]!.label.th}: ${o.result}` +
      (o.scar ? ` (แผลเป็น ความรุนแรง ${o.scar.severity.toFixed(2)}, modifiers: ${o.scar.modifiers.map((m) => `${m.stat} ${m.value.toFixed(1)}`).join(', ')})` : ''));
  }
  say(`  manipulation.fine = ${capability(ctx, hero, 'manipulation.fine').toFixed(3)}`);
  say(`  ขนาดเซฟ: ${saveSize()}`);

  // ---------------- ไล่ปีจนจบ 4 รุ่น ----------------
  const deathAge = new Map<string, number>();
  const startYear = yearOf(ctx, ctx.state.meta.day) + 1;
  let handovers = 0;

  const doHandover = (dead: Character, heirId?: Character['id']) => {
    const before = saveSize();
    const r = performHandover(ctx, dead.id, heirId);
    handovers++;
    say(`\n  ──── สืบทอด: ${r.deceased} → ${r.heir} ────`);
    if (r.candidates.length > 1) say(`  ผู้มีสิทธิ์: ${r.candidates.map((c) => `${c.name}(${c.score.toFixed(2)})`).join(', ')}`);
    for (const l of r.log) say('  ' + l);
    say(`  prune: ยุบตัวละคร ${r.prune.charactersCollapsed}, ยุบ node ${r.prune.nodesMerged}, ลบ memory ${r.prune.memoriesDropped}, ลบ event ${r.prune.eventsDropped}  | เซฟ ${before} → ${saveSize()}`);
    printLegends(ctx, dyn);
  };

  for (let year = startYear; year <= 2400; year++) {
    setYear(year);
    for (const l of applyHistoricalShocks(ctx, year)) say(`\n[${year}] ${l}`);
    let player = ctx.state.characters[ctx.state.meta.playerCharacterId];
    if (player && !isAlive(player)) {
      say(`\n[${year}] ${player.name} สิ้นชีวิต (${ctx.tags.label(player.deathCause ?? 'situation:old_age')})`);
      doHandover(player);
      player = ctx.state.characters[ctx.state.meta.playerCharacterId];
    }
    if (!player || !isAlive(player)) break;

    // บิดาตาย (สคริปต์) — มรดกตกถึงผู้เล่น
    if (year === 2308 && isAlive(ctx.state.characters[father.id])) {
      markDead(ctx, father, 'situation:old_age');
      say(`\n[${year}] ${father.name} ถึงแก่กรรม`);
      doHandover(father, player.id);
    }

    // NPC แก่ตาย
    for (const c of Object.values(ctx.state.characters)) {
      if (isAlive(c) && c.id !== player.id && c.id !== father.id && ageOf(ctx, c) > 55 && ctx.rng.chance(0.12)) {
        markDead(ctx, c, 'situation:old_age');
        settleDeath(ctx, c);
      }
    }

    // ชีวิตผู้เล่น
    const age = ageOf(ctx, player);
    if (!deathAge.has(player.id)) deathAge.set(player.id, Math.max(age + 30, Math.round(ctx.rng.range(52, 66))));
    // แต่งงาน ที่อยู่หลังแต่งงาน แยกเรือน มีบุตร เป็นเณร — ใช้กลไกเดียวกับตัวเกม (world.ts)
    const family = new Set([player.name, ...livingChildren(ctx, player).map((c) => c.name)]);
    for (const l of lifeMilestones(ctx)) if ([...family].some((n) => l.startsWith(n))) say(`[${year}] ${l}`);
    if (year === 2315 && age >= 25 && !player.social.title) {
      player.social.title = 'ขุนศรีสงคราม';
      say(`\n[${year}] ${player.name} ได้รับบรรดาศักดิ์ ${player.social.title} จากความชอบในการกู้ชาติ`);
    }

    // เด็กในเรือน: โดนมีดบาดตอน 7 ขวบ
    for (const c of Object.values(ctx.state.characters)) {
      if (!isAlive(c)) continue;
      if (ageOf(ctx, c) === 7 && c.householdId === player.householdId && c.id !== player.id && ctx.rng.chance(0.5)) {
        const mom = c.caregiverIds.map((id) => ctx.state.characters[id]).find((x) => isAlive(x) && x.sex === 'f');
        if (!mom) continue;
        const pe = prepareEvent(ctx, 'childhood.kitchen_cut', { actor: c.id, caregiver: mom.id });
        const r = chooseOption(ctx, pe, ctx.rng.chance(0.5) ? 'cry' : 'hide').trauma[0];
        for (let d = 0; d < 150; d++) {
          ctx.state.meta.day++;
          tickWounds(ctx, c);
        }
        setYear(year);
        say(`[${year}] ${c.name} (7 ขวบ) โดนมีดบาดตอนผ่า${ctx.tags.label(must(pe.instance.vars['target_food'], 'food'))}` +
          ` → ${r?.branches.length ? r.branches.map((b) => describeTrait(ctx, ctx.state.traits[b.traitId]!)).join(', ') : 'ไม่ฝังใจ'}`);
      }
    }

    // งานเลี้ยงในวัง: ดูการ inject ตัวเลือกจากปม
    if (age === 26) {
      // สคริปต์ให้สำรับเป็นฟักทอง เพื่อโชว์การ inject; ในเกมจริงสุ่มจาก variables
      const pe = prepareEvent(ctx, 'adult.court_feast', { actor: player.id }, { dish: 'food:pumpkin' });
      say(`\n[${year}] ${player.name} ไปงานเลี้ยงในวัง สำรับวันนี้มี${ctx.tags.label(must(pe.instance.vars['dish'], 'dish'))}`);
      for (const h of pe.hits) say(`  ปมถูกกระตุ้น: ${describeTrait(ctx, h.trait)} [${h.scope}] strength ${h.strength.toFixed(2)}`);
      for (const o of pe.options) {
        const lock = pe.locked.get(o.id);
        say(`  - ${o.id}${o.injectedBy ? ` (inject โดย ${o.injectedBy})` : ''}${lock ? `  🔒 ล็อกโดย ${lock}` : ''}`);
      }
      const pick = must(pe.options.find((o) => !pe.locked.has(o.id)), 'option');
      chooseOption(ctx, pe, pick.id);
      say(`  เลือก: ${pick.id}`);
    }

    // social learning ทุกเรือน
    for (const h of Object.values(ctx.state.households)) {
      const logs = householdYearTick(ctx, h.id);
      if (h.id === player.householdId || h.memberIds.includes(player.id)) for (const l of logs) say(`[${year}] ${l}`);
    }

    if (age >= (deathAge.get(player.id) ?? 99)) markDead(ctx, player, 'situation:old_age');
    if (handovers >= 4) break;
  }

  say(`\n=== สรุปหลัง ${handovers} การสืบทอด ===`);
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (player) {
    say(`ผู้เล่นปัจจุบัน: ${player.name} อายุ ${ageOf(ctx, player)}`);
    say(`ปมของ${player.name}: ${player.traitIds.map((id) => describeTrait(ctx, ctx.state.traits[id]!)).join(', ') || '-'}` +
      ` | ต้นเหตุ: ${player.traitIds.map((id) => ctx.state.traits[id]!.awareness).join(', ')}`);
  }
  say(`ข้อห้ามตระกูล: ${dyn.taboos.map((t) => `${t.kind} ${ctx.tags.label(t.target)} (แรง ${t.strength.toFixed(2)}, รู้ต้นเหตุ ${t.originKnown})`).join('; ') || '-'}`);
  say(`ผังตระกูล: ${Object.keys(ctx.state.familyNodes).length} nodes, ตัวละครเต็ม ${Object.keys(ctx.state.characters).length}, สายรองที่ยุบ ${dyn.branchSummaries.length}`);
  say(`ขนาดเซฟ: ${saveSize()}`);
  return true;
}

function printLegends(ctx: Ctx, dyn: Dynasty): void {
  for (const lid of dyn.legendIds) {
    const l = ctx.state.legends[lid];
    if (!l) continue;
    console.log(`  📜 ความจริง : ${renderLegend(ctx, l, 'truth')}`);
    console.log(`     ที่เล่ากัน: ${renderLegend(ctx, l, 'current')}  (เล่ามา ${l.generationsRetold} รุ่น, divergence ${l.divergence.toFixed(2)}${l.writtenRecord ? ', มีสมุดข่อย' : ''})`);
  }
}

// ----------------------------------------------------------------------------
monteCarlo(Number(process.argv[2] ?? 2000));
let seed = 1;
while (seed < 5000 && !story(seed, false)) seed++;
story(seed, true);
