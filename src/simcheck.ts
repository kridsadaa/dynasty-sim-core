// npm run sim:check — รันโลกจริง (advanceDay) หลาย seed แล้วตรวจ invariant ของ state
// exit code ≠ 0 เมื่อมีข้อใดผิด → ใช้เป็น regression test ได้โดยไม่ต้องมี test framework
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildContentDB } from './content';
import { isAlive, makeCtx, type Ctx } from './core/ctx';
import type { ContentDB } from './core/types';
import { chooseOption } from './systems/events';
import { emptyState, marry, spawnCharacter } from './systems/factory';
import { estateHeirs, markDead, performHandover, successorCandidates } from './systems/handover';
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
    // ผู้นำตายโดยมีญาติในตระกูล → ต้องส่งต่อ (D2); ว่างได้เฉพาะตอนสิ้นสาย
    check('ผู้นำตระกูลที่ไม่มีชีวิต', Object.values(S.dynasties).filter((d) => !alive(S.familyNodes[d.headNodeId]?.characterId)).map((d) => d.name));
  }
  check('อายุติดลบ', Object.values(S.characters).filter((c) => c.birthDay > S.meta.day).map((c) => c.name));
  check('childIds ชี้ไป node ที่ไม่มี', Object.values(S.familyNodes).flatMap((n) => n.childIds.filter((id) => !S.familyNodes[id])));
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
        if (!successorCandidates(ctx, dead).length) {
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

// [3] ผู้เล่นไม่มีบุตร (D1 + D2) → น้องชายสืบตำแหน่งและได้มรดก; ไม่ใช่สิ้นสาย
{
  const ctx = makeCtx(emptyState(11), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += content.balance.daysPerYear * 25;
  const dyn = S.dynasties[S.meta.playerDynastyId]!;
  const heroNode = S.familyNodes[hero.familyNodeId]!;
  const father = S.characters[S.familyNodes[heroNode.fatherId!]!.characterId!]!;
  const mother = S.characters[S.familyNodes[heroNode.motherId!]!.characterId!]!;
  const brother = spawnCharacter(ctx, { name: 'น้องชาย', sex: 'm', birthYear: 2287, estate: 'noble', father, mother });
  markDead(ctx, father, 'situation:old_age');
  performHandover(ctx, father.id, hero.id, { asPlayer: false });
  hero.social.wealth = 100;
  markDead(ctx, hero, 'situation:old_age');
  const problems: string[] = [];
  const cands = successorCandidates(ctx, hero);
  if (cands[0]?.ch.id !== brother.id) problems.push(`ผู้สืบคนแรกคือ ${cands[0]?.ch.name ?? 'ไม่มี'} ไม่ใช่น้องชาย`);
  const before = brother.social.wealth;
  performHandover(ctx, hero.id);
  if (S.meta.playerCharacterId !== brother.id) problems.push('ผู้เล่นไม่ได้สลับไปเป็นน้องชาย');
  if (dyn.headNodeId !== brother.familyNodeId) problems.push('ผู้นำตระกูลไม่ได้ไปที่น้องชาย');
  if (brother.social.wealth <= before) problems.push('น้องชายไม่ได้มรดก');
  const b = failed;
  console.log('ผู้เล่นไม่มีบุตร:');
  check('ญาติสืบแทน', problems);
  if (failed === b) console.log('  ✓ น้องชายสืบตำแหน่งและได้มรดก');
}

// [4] บุตรตายก่อน → หลานได้มรดกแทน และเป็นผู้สืบก่อนพี่น้อง
{
  const ctx = makeCtx(emptyState(12), content);
  const hero = bootstrapScenario(ctx);
  const S = ctx.state;
  S.meta.day += content.balance.daysPerYear * 60;
  const heroNode = S.familyNodes[hero.familyNodeId]!;
  const father = S.characters[S.familyNodes[heroNode.fatherId!]!.characterId!]!;
  const mother = S.characters[S.familyNodes[heroNode.motherId!]!.characterId!]!;
  spawnCharacter(ctx, { name: 'น้องสาว', sex: 'f', birthYear: 2288, estate: 'noble', father, mother });
  const wife = spawnCharacter(ctx, { name: 'ภรรยา', sex: 'f', birthYear: 2288, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, hero, wife);
  const son = spawnCharacter(ctx, { name: 'ลูกชาย', sex: 'm', birthYear: 2310, estate: 'noble', father: hero, mother: wife });
  const sonWife = spawnCharacter(ctx, { name: 'สะใภ้', sex: 'f', birthYear: 2312, estate: 'noble', dynastyId: null, householdId: null });
  marry(ctx, son, sonWife);
  const grandson = spawnCharacter(ctx, { name: 'หลานชาย', sex: 'm', birthYear: 2330, estate: 'noble', father: son, mother: sonWife });
  markDead(ctx, son, 'situation:old_age');
  markDead(ctx, hero, 'situation:old_age');
  const problems: string[] = [];
  if (successorCandidates(ctx, hero)[0]?.ch.id !== grandson.id) problems.push('ผู้สืบคนแรกไม่ใช่หลาน');
  if (!estateHeirs(ctx, hero).some((h) => h.ch.id === grandson.id && h.relation === 'grandchild')) problems.push('หลานไม่อยู่ในผู้รับมรดก');
  const b = failed;
  console.log('บุตรตายก่อน:');
  check('หลานรับแทน', problems);
  if (failed === b) console.log('  ✓ หลานเป็นผู้สืบและได้ส่วนมรดก');
}

if (failed) {
  console.log(`\nไม่ผ่าน ${failed} ข้อ`);
  process.exit(1);
}
console.log('\nผ่านทั้งหมด');
