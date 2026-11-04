// npm run sim:policy [seeds] [นโยบาย] [--strict] — ผู้เล่นอัตโนมัติ 4 แบบ (รอบคอบ / ประมาท / สุ่ม / ตัวเลือกแรก) เล่นทั้งสายตระกูลถึงปีจบ
// วัดว่าการเลือกมีผลต่อความตายของผู้เล่นแค่ไหน (docs/design-choice-risk.md หัวข้อ 6 และ 13)
//   • ชีวิตแรก: ตัวละครแรกที่ผู้เล่นคุม (เกิด 2281)  • ทุกชีวิต: ผู้เล่นทุกคนตลอดสายตระกูล (ตอนผู้ใหญ่ ≥ 15)
// ศึก 2308–2310 และข่าวโรคระบาดระบุตัวเลือกเป็นรายตัว (ความหมายรู้แน่) ที่เหลือใช้ risk.base ของตัวเลือก (รอบคอบ = เสี่ยงน้อยสุด, ประมาท = มากสุด)
// รายงาน + "ประตูก่อนออกรุ่น" (ครบ 4 นโยบาย และ n ≥ 150 จึงเชื่อถือได้): พิมพ์ ✓/⚠ ไม่ทำให้ npm test ล้ม — ใส่ --strict ให้ exit ≠ 0 เมื่อเตือน
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { ageOf, dayOfYear, isAlive, makeCtx, yearStart } from './core/ctx';
import type { ContentDB } from './core/types';
import { chooseOption, prepareFollowUp, type PreparedEvent } from './systems/events';
import { emptyState } from './systems/factory';
import { knownLocals } from './systems/acquaintance';
import { heirCandidates, performHandover } from './systems/handover';
import { interactionsFor, performInteraction } from './systems/interactions';
import { bootstrapScenario } from './systems/scenario';
import { advanceDay } from './systems/world';

const load = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'content', f), 'utf8'));
const content: ContentDB = buildContentDB({
  names: load('names.json'), tags: load('tags.json'), anatomy: load('anatomy.json'), traitKinds: load('traitKinds.json'),
  events: load('events.json'), rules: load('rules.json'), intents: load('intents.json'), offices: load('offices.json'),
  chores: load('chores.json'), balance: load('balance.json'),
});
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const STRICT = process.argv.includes('--strict');
const SEEDS = Number(args[0] ?? 60);
const ALL_POLICIES = ['careful', 'reckless', 'random', 'first'] as const;
const POLICIES = ALL_POLICIES.filter((p) => !args[1] || p === args[1]);
type Policy = (typeof ALL_POLICIES)[number];

const FIXED_CHOICE: Record<'careful' | 'reckless', Record<string, string>> = {
  careful: { 'war.prepare': 'bury_most', 'war.decide_leave': 'east_all', 'war.levy': 'pay', 'war.siege_begins': 'home', 'war.rice_gone': 'surrender', 'war.news_tenasserim': 'store', 'plague.news': 'flee', 'health.inoculation': 'inoculate', 'feud.revenge': 'move', 'body.grave_illness': 'physician', 'scheme.assassin': 'cancel' },
  reckless: { 'war.prepare': 'none', 'war.decide_leave': 'stay', 'war.levy': 'serve', 'war.siege_begins': 'wall', 'war.rice_gone': 'endure', 'war.news_tenasserim': 'ignore', 'plague.news': 'none', 'health.inoculation': 'decline', 'feud.revenge': 'ignore', 'body.grave_illness': 'endure' },
};
/** โอกาสต่อปีที่ผู้เล่นกดปุ่ม "จ้างคนลอบฆ่า" กับคนที่รู้จัก (ข้อสมมุติของนโยบาย: ประมาท 35%, สุ่ม 5%, อื่น ๆ ไม่กด) */
const ASSASSIN_PER_YEAR: Record<Policy, number> = { careful: 0, reckless: 0.35, random: 0.05, first: 0 };
const NATURAL = /old_age|illness|smallpox|childbirth/;
const WAR_HISTORY = /fall_of_ayutthaya|captive_after_fall|burmese_invasion|nine_armies|tha_din_daeng|famine_after_fall/;
/** natural = ลูกเต๋าตามวัย/โรค, history = ศึก/โรคระบาด/ข้าวยากตามประวัติศาสตร์, choice = ผลของตัวเลือกที่ผู้เล่นเลือก (จมน้ำ รบ แผลเน่า ล้างแค้น) */
const category = (cause: string) => (cause.startsWith('history:') ? 'history' : NATURAL.test(cause) ? 'natural' : 'choice');

interface Life { age: number; cause: string; first: boolean }
const rows: Array<{ policy: Policy; lives: Life[]; extinct: number }> = [];

for (const policy of POLICIES) {
  const lives: Life[] = [];
  let extinct = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const ctx = makeCtx(emptyState(seed * 7919), content);
    bootstrapScenario(ctx);
    const S = ctx.state;
    const endDay = yearStart(ctx, S.meta.endYear!);
    const pick = (p: PreparedEvent) => {
      const opts = p.options.filter((o) => !p.locked.has(o.id));
      if (policy === 'first') return opts[0]!;
      if (policy === 'random') return opts[Math.floor(ctx.rng.next() * opts.length)]!;
      const want = FIXED_CHOICE[policy][p.def.id];
      const named = want ? opts.find((o) => o.id === want) : undefined;
      if (named) return named;
      const risk = (o: (typeof opts)[number]) => o.risk?.base ?? 0;
      return [...opts].sort((a, b) => (policy === 'careful' ? risk(a) - risk(b) : risk(b) - risk(a)))[0]!;
    };
    let over = false;
    let n = 0;
    const resolve = (start: PreparedEvent | null) => {
      for (let p = start; p; ) {
        if (!p.options.some((o) => !p!.locked.has(o.id))) break;
        p = prepareFollowUp(ctx, p, chooseOption(ctx, p, pick(p).id));
      }
    };
    while (S.meta.day < endDay && !over) {
      const me = S.characters[S.meta.playerCharacterId]!;
      if (isAlive(me) && ageOf(ctx, me) >= 18 && dayOfYear(ctx, S.meta.day) === 200 && ctx.rng.chance(ASSASSIN_PER_YEAR[policy])) {
        const targets = knownLocals(ctx, me).filter((t) => interactionsFor(ctx, me, t).some((a) => a.id === 'assassin' && !a.problem));
        const t = targets[Math.floor(ctx.rng.next() * targets.length)];
        if (t) { const r = performInteraction(ctx, me, t, 'assassin'); if ('event' in r) resolve(r.event); }
      }
      for (const sig of advanceDay(ctx)) {
        if (sig.type === 'event') resolve(sig.prepared);
        else if (sig.type === 'playerDied') {
          const dead = S.characters[S.meta.playerCharacterId]!;
          lives.push({ age: ageOf(ctx, dead, dead.deathDay ?? S.meta.day), cause: dead.deathCause ?? 'unknown', first: n++ === 0 });
          if (!heirCandidates(ctx, dead).length) { over = true; extinct++; break; }
          performHandover(ctx, dead.id);
        }
      }
    }
  }
  rows.push({ policy, lives, extinct });
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : '–');
const adultsOf = (ls: Life[]) => ls.filter((l) => l.age >= 15);
const meanAge = (ls: Life[]) => ls.reduce((s, l) => s + l.age, 0) / Math.max(1, ls.length);
const summary: Partial<Record<Policy, { choiceShare: number; meanNonWar: number }>> = {};

for (const r of rows) {
  const first = r.lives.filter((l) => l.first).map((l) => l.age);
  const ad = adultsOf(r.lives);
  const by = (cat: string) => ad.filter((l) => category(l.cause) === cat).length;
  console.log(`${r.policy.padEnd(8)} n=${SEEDS} · ชีวิตแรก: รอดถึง 30 ${pct(first.filter((a) => a >= 30).length, first.length)} 50 ${pct(first.filter((a) => a >= 50).length, first.length)} 60 ${pct(first.filter((a) => a >= 60).length, first.length)} 70 ${pct(first.filter((a) => a >= 70).length, first.length)} · ตระกูลสิ้นสาย ${pct(r.extinct, SEEDS)}`);
  console.log(`         ทุกชีวิตของผู้เล่น ${r.lives.length} ชีวิต (ผู้ใหญ่ ${ad.length}): ตายตามวัย/โรค ${pct(by('natural'), ad.length)} · ประวัติศาสตร์ ${pct(by('history'), ad.length)} · จากตัวเลือก ${pct(by('choice'), ad.length)} · อายุตายเฉลี่ย ${meanAge(ad).toFixed(1)}`);
  const causes: Record<string, number> = {};
  for (const l of ad) if (category(l.cause) === 'choice') { const k = l.cause.replace('situation:', ''); causes[k] = (causes[k] ?? 0) + 1; }
  if (Object.keys(causes).length) console.log(`         เหตุจากตัวเลือก: ${Object.entries(causes).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  summary[r.policy] = { choiceShare: ad.length ? by('choice') / ad.length : 0, meanNonWar: meanAge(ad.filter((l) => !WAR_HISTORY.test(l.cause))) };
}

if (POLICIES.length === ALL_POLICIES.length) {
  const c = summary.careful!, rk = summary.reckless!, rd = summary.random!;
  const ext = rows.find((r) => r.policy === 'random')!.extinct / SEEDS;
  const gate: Array<[string, boolean, string]> = [
    ['ผู้เล่นสุ่ม: ตายตอนผู้ใหญ่จากตัวเลือก 5–25%', rd.choiceShare >= 0.05 && rd.choiceShare <= 0.25, `${(100 * rd.choiceShare).toFixed(0)}%`],
    ['รอบคอบอายุตายเฉลี่ยมากกว่าประมาท ≥ 3 ปี (ผู้ใหญ่ ไม่นับตายจากศึก)', c.meanNonWar - rk.meanNonWar >= 3, `${(c.meanNonWar - rk.meanNonWar).toFixed(1)} ปี`],
    ['ตระกูลสิ้นสายก่อนจบเรื่อง (ผู้เล่นสุ่ม) ≤ 25%', ext <= 0.25, `${(100 * ext).toFixed(0)}%`],
  ];
  console.log(`\nประตูก่อนออกรุ่น${SEEDS < 150 ? ` (n=${SEEDS} < 150 — เป็นแนวโน้ม อาจเตือนลอย ๆ)` : ''}:`);
  let warn = 0;
  for (const [label, ok, v] of gate) { if (!ok) warn++; console.log(`  ${ok ? '✓' : '⚠'} ${label}: ${v}`); }
  if (STRICT && warn) process.exit(1);
}
