// npm run sim:policy [seeds] [นโยบาย] — ผู้เล่นอัตโนมัติ 3 แบบ (รอบคอบ / ประมาท / สุ่ม) + ตัวเลือกแรก: วัดว่าการเลือกมีผลต่อการรอดของตัวละครแรกแค่ไหน
// เป็นรายงานเฉยๆ ไม่ทำให้ test ล้ม (docs/design-choice-risk.md หัวข้อ 6) — ใช้ดูฐานก่อน/หลังเพิ่มความเสี่ยงที่ผูกกับตัวเลือก
// นโยบาย: ตัวเลือกของศึก 2308–2310 ระบุเป็นรายตัว (ความหมายรู้แน่) ที่เหลือใช้ risk.base ของตัวเลือก (รอบคอบ = เสี่ยงน้อยสุด, ประมาท = มากสุด)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { ageOf, isAlive, makeCtx, yearStart } from './core/ctx';
import type { ContentDB } from './core/types';
import { chooseOption, prepareFollowUp, type PreparedEvent } from './systems/events';
import { emptyState } from './systems/factory';
import { bootstrapScenario } from './systems/scenario';
import { advanceDay } from './systems/world';

const load = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'content', f), 'utf8'));
const content: ContentDB = buildContentDB({
  names: load('names.json'), tags: load('tags.json'), anatomy: load('anatomy.json'), traitKinds: load('traitKinds.json'),
  events: load('events.json'), rules: load('rules.json'), intents: load('intents.json'), offices: load('offices.json'),
  chores: load('chores.json'), balance: load('balance.json'),
});
const SEEDS = Number(process.argv[2] ?? 60);
const ALL_POLICIES = ['careful', 'reckless', 'random', 'first'] as const;
// npm run sim:policy -- 200 random → รันเฉพาะนโยบายที่ระบุ (ใช้ปรับสมดุลให้เร็วขึ้น)
const POLICIES = ALL_POLICIES.filter((p) => !process.argv[3] || p === process.argv[3]);
type Policy = (typeof ALL_POLICIES)[number];

const WAR_CHOICE: Record<'careful' | 'reckless', Record<string, string>> = {
  careful: { 'war.prepare': 'bury_most', 'war.decide_leave': 'east_all', 'war.levy': 'pay', 'war.siege_begins': 'home', 'war.rice_gone': 'surrender', 'war.news_tenasserim': 'store' },
  reckless: { 'war.prepare': 'none', 'war.decide_leave': 'stay', 'war.levy': 'serve', 'war.siege_begins': 'wall', 'war.rice_gone': 'endure', 'war.news_tenasserim': 'ignore' },
};
const NATURAL = /old_age|illness|smallpox|childbirth/;

for (const policy of POLICIES) {
  const ages: number[] = [];
  const causes: Record<string, number> = {};
  let history = 0;
  let byChoice = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const ctx = makeCtx(emptyState(seed * 7919), content);
    bootstrapScenario(ctx);
    const S = ctx.state;
    const heroId = S.meta.playerCharacterId;
    const endDay = yearStart(ctx, S.meta.endYear!);
    const pick = (p: PreparedEvent) => {
      const opts = p.options.filter((o) => !p.locked.has(o.id));
      if (policy === 'first') return opts[0]!;
      if (policy === 'random') return opts[Math.floor(ctx.rng.next() * opts.length)]!;
      const want = WAR_CHOICE[policy][p.def.id];
      const named = want ? opts.find((o) => o.id === want) : undefined;
      if (named) return named;
      const risk = (o: (typeof opts)[number]) => o.risk?.base ?? 0;
      return [...opts].sort((a, b) => (policy === 'careful' ? risk(a) - risk(b) : risk(b) - risk(a)))[0]!;
    };
    while (S.meta.day < endDay && isAlive(S.characters[heroId]!)) {
      for (const sig of advanceDay(ctx)) {
        if (sig.type !== 'event') continue;
        for (let p: PreparedEvent | null = sig.prepared; p; ) {
          if (!p.options.some((o) => !p!.locked.has(o.id))) break;
          p = prepareFollowUp(ctx, p, chooseOption(ctx, p, pick(p).id));
        }
      }
    }
    const hero = S.characters[heroId]!;
    if (isAlive(hero)) { ages.push(99); continue; }
    const cause = hero.deathCause ?? 'unknown';
    causes[cause] = (causes[cause] ?? 0) + 1;
    if (cause.startsWith('history:')) history++;
    else if (!NATURAL.test(cause)) byChoice++;
    ages.push(ageOf(ctx, hero, hero.deathDay ?? S.meta.day));
  }
  ages.sort((a, b) => a - b);
  const q = (p: number) => ages[Math.min(ages.length - 1, Math.floor(p * ages.length))] ?? 0;
  const pct = (n: number) => `${((100 * n) / SEEDS).toFixed(0)}%`;
  const reach = (a: number) => pct(ages.filter((x) => x >= a).length);
  console.log(`${(policy as Policy).padEnd(8)} n=${SEEDS} · อายุตาย median ${q(0.5)} p10 ${q(0.1)} p90 ${q(0.9)} · รอดถึง 30: ${reach(30)} 50: ${reach(50)} 60: ${reach(60)} 70: ${reach(70)} · ตายจากประวัติศาสตร์ ${pct(history)} · ตายจากเหตุที่ตัวเลือกก่อ ${pct(byChoice)}`);
  console.log(`         สาเหตุ: ${Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace(/^(situation|history):/, '')}:${v}`).join(' ')}`);
}
