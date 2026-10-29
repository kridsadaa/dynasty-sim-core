// npm run sim:check — รันโลกจริง (advanceDay) หลาย seed แล้วตรวจ invariant ของ state
// exit code ≠ 0 เมื่อมีข้อใดผิด → ใช้เป็น regression test ได้โดยไม่ต้องมี test framework
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { isAlive, makeCtx, type Ctx } from './core/ctx';
import type { ContentDB } from './core/types';
import { chooseOption } from './systems/events';
import { emptyState, marry, spawnCharacter } from './systems/factory';
import { heirCandidates, markDead, performHandover } from './systems/handover';
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
  }
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

// [1] รันโลก
for (let seed = 1; seed <= SEEDS; seed++) {
  const ctx = makeCtx(emptyState(seed), content);
  bootstrapScenario(ctx);
  const S = ctx.state;
  let over = false;
  for (let d = 0; d < content.balance.daysPerYear * YEARS && !over; d++) {
    for (const sig of advanceDay(ctx)) {
      if (sig.type === 'event') {
        const p = sig.prepared;
        const opt = p.options.find((o) => !p.locked.has(o.id));
        if (!opt) throw new Error(`seed ${seed}: event ${p.def.id} ไม่มีตัวเลือกที่เลือกได้`);
        chooseOption(ctx, p, opt.id);
      } else if (sig.type === 'playerDied') {
        const dead = S.characters[S.meta.playerCharacterId]!;
        if (!heirCandidates(ctx, dead).length) {
          over = true;
          break;
        }
        performHandover(ctx, dead.id);
      }
    }
  }
  const before = failed;
  console.log(`seed ${seed}: ถึงปี ${content.balance.epochYear + Math.floor(S.meta.day / content.balance.daysPerYear)}${over ? ' (สิ้นสาย)' : ''}`
    + ` · ตัวละคร ${Object.keys(S.characters).length} · node ${Object.keys(S.familyNodes).length}`
    + ` · เซฟ ${(JSON.stringify(S).length / 1024).toFixed(0)} KB`);
  invariants(ctx, over);
  if (failed === before) console.log(over ? '  ✓ invariant ครบ (ข้ามข้อมรดกเพราะเกมจบ)' : '  ✓ invariant ครบ');
}

// [2] ผู้เล่นตายก่อนผู้นำตระกูล (บิดา) → ผู้นำ หัวเรือน และกฎในเรือนของบิดาต้องไม่เปลี่ยน
{
  const ctx = makeCtx(emptyState(7), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += content.balance.daysPerYear * 25;
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

if (failed) {
  console.log(`\nไม่ผ่าน ${failed} ข้อ`);
  process.exit(1);
}
console.log('\nผ่านทั้งหมด');
