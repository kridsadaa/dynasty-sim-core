import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { eventArtTags, pickArt, portraitArtTags, type ArtImage, type ArtManifest } from './select';

const img = (id: string, style: ArtImage['style'], tags: string[]): ArtImage => ({ id, file: `art/${id}.webp`, style, tags, alt: id, width: 1024, height: 572 });
const manifest: ArtManifest = {
  styleVersion: 'test',
  images: [
    img('scene.compound', 'reality', ['group:family']),
    img('scene.sickbed', 'reality', ['event:family.parent_illness', 'situation:illness']),
    img('scene.kitchen', 'reality', ['place:kitchen', 'situation:kitchen_work']),
    img('legend.battle', 'chronicle', ['legend:any', 'place:battlefield']),
    img('portrait.m.adult.noble', 'portrait', ['sex:m', 'age:adult', 'estate:noble']),
    img('portrait.m.adult.official_patrol', 'portrait', ['sex:m', 'age:adult', 'estate:noble', 'role:official', 'role:official_patrol']),
    img('portrait.m.adult.official_patrol.head', 'portrait', ['sex:m', 'age:adult', 'estate:noble', 'role:official', 'role:official_patrol', 'rank:head']),
    img('portrait.f.adult.noble', 'portrait', ['sex:f', 'age:adult', 'estate:noble', 'role:principal_wife']),
    img('portrait.m.youth.page', 'portrait', ['sex:m', 'age:youth', 'age:adult', 'estate:noble', 'role:page']),
    img('portrait.f.adult.commoner', 'portrait', ['sex:f', 'age:adult', 'estate:phrai_som']),
  ],
};

test('ภาพของ event นั้นโดยตรงชนะภาพสำรองของหมวด', () => {
  assert.equal(pickArt(manifest, 'reality', eventArtTags('family.parent_illness', []))?.id, 'scene.sickbed');
  assert.equal(pickArt(manifest, 'reality', eventArtTags('family.newborn', []))?.id, 'scene.compound');
});

test('tag ฉากของ event หาภาพได้แม้ไม่มีภาพของ event นั้น', () => {
  assert.equal(pickArt(manifest, 'reality', eventArtTags('childhood.kitchen_cut', ['place:kitchen']))?.id, 'scene.kitchen');
});

test('ไม่มีภาพที่ตรง หรือไม่มี manifest → null', () => {
  assert.equal(pickArt(manifest, 'reality', eventArtTags('career.promotion', [])), null);
  assert.equal(pickArt(null, 'reality', ['group:family']), null);
});

test('ภาพตำนานเลือกเฉพาะสไตล์ chronicle', () => {
  assert.equal(pickArt(manifest, 'chronicle', ['legend:any', 'place:battlefield'])?.id, 'legend.battle');
  assert.equal(pickArt(manifest, 'reality', ['place:battlefield']), null);
});

test('ภาพตัวละครเลือกตรงเพศ ช่วงวัย และให้บทบาทเฉพาะชนะฐานะทั่วไป', () => {
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble', roles: ['official', 'official_patrol'] }))?.id, 'portrait.m.adult.official_patrol');
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble' }))?.id, 'portrait.m.adult.noble');
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'f', age: 30, estate: 'noble', roles: ['principal_wife'] }))?.id, 'portrait.f.adult.noble');
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'f', age: 8, estate: 'noble' })), null);
});

test('ภาพที่ติดขั้นยศใช้เฉพาะคนที่ยศขั้นนั้น ขั้นอื่นถอยไปใช้ภาพบทบาทเดียวกันที่ไม่ติดขั้น', () => {
  const pick = (rank?: Parameters<typeof portraitArtTags>[0]['rank']) =>
    pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble', roles: ['official', 'official_patrol'], rank }))?.id;
  assert.equal(pick('head'), 'portrait.m.adult.official_patrol.head');
  assert.equal(pick('mid'), 'portrait.m.adult.official_patrol');
  assert.equal(pick('page'), 'portrait.m.adult.official_patrol');
  assert.equal(pick(), 'portrait.m.adult.official_patrol');
  // คนไม่มียศไม่ได้ภาพที่ติดขั้นยศ แม้เป็นชายขุนนางวัยเดียวกัน
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble' }))?.id, 'portrait.m.adult.noble');
});

test('ภาพที่ติดบทบาทใช้เฉพาะคนที่มีบทบาทนั้น และชนชั้นต้องตรง', () => {
  // ขุนนางไม่มีตำแหน่งไม่ได้ภาพมหาดเล็ก แม้ภาพมหาดเล็กจะติดอายุผู้ใหญ่ไว้ด้วย
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble' }))?.id, 'portrait.m.adult.noble');
  // เมียของไพร่ไม่ได้ภาพนางขุนนาง แม้จะเป็นเมียเอกเหมือนกัน
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'f', age: 30, estate: 'phrai_som', roles: ['principal_wife'] }))?.id, 'portrait.f.adult.commoner');
  // ไม่มีภาพที่ตรงชนชั้น → ไม่แสดง (ชาวต่างชาติ) / เจ้านายใช้ภาพขุนนาง
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'foreigner' })), null);
  assert.equal(pickArt(manifest, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'royal' }))?.id, 'portrait.m.adult.noble');
});

test('คลังภาพจริง: ทุกเพศ วัย ชนชั้น บทบาท ได้ภาพที่ตรงตัว หรือไม่ได้ภาพเลย', () => {
  const real = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')) as ArtManifest;
  const rolesBySex: Record<'m' | 'f', string[][]> = {
    m: [[], ['page'], ['official', 'official_patrol'], ['official', 'official_palace'], ['official', 'official_scholar'], ['monk']],
    f: [[], ['principal_wife'], ['household_head', 'principal_wife'], ['minor_wife'], ['pregnant', 'principal_wife']],
  };
  const estates = ['noble', 'royal', 'merchant', 'phrai_luang', 'phrai_som', 'that', 'monk', 'foreigner'];
  for (const sex of ['m', 'f'] as const) for (const estate of estates) for (const age of [8, 18, 35, 65]) for (const roles of rolesBySex[sex]) {
    const wanted = portraitArtTags({ sex, age, estate, roles, topknotCut: age > 13 });
    const got = pickArt(real, 'portrait', wanted);
    if (!got) continue;
    const want = new Set(wanted);
    const kind = (p: string) => got.tags.filter((t) => t.startsWith(p));
    const label = `${sex} ${estate} ${age} ${roles.join('+') || '-'} → ${got.id}`;
    for (const p of ['sex:', 'age:', 'estate:']) assert.ok(!kind(p).length || kind(p).some((t) => want.has(t)), label);
    assert.ok(!kind('role:').length || kind('role:').some((t) => want.has(t)), label);
  }
  // ขั้นยศ: ภาพที่ติดขั้นยศต้องตรงกับขั้นที่ขอเสมอ (ตอนนี้ยังไม่มีภาพติดขั้นยศ — เทสต์นี้กันภาพผิดขั้นเมื่อสร้างภาพขั้นยศมาเพิ่ม)
  for (const rank of ['page', 'low', 'mid', 'high', 'head'] as const) {
    const got = pickArt(real, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble', roles: ['official', 'official_patrol'], rank }));
    const ranks = got?.tags.filter((t) => t.startsWith('rank:')) ?? [];
    assert.ok(!ranks.length || ranks.includes(`rank:${rank}`), `rank ${rank} → ${got?.id}`);
  }
  assert.equal(pickArt(real, 'portrait', portraitArtTags({ sex: 'f', age: 30, estate: 'noble' }))?.id, 'portrait.f.adult.noble', 'หญิงขุนนางยังไม่มีผัวก็มีภาพ');
});

test('ขุนนางทุกกรม × ทุกขั้นยศได้ภาพขั้นนั้นของกรมตัวเอง (assets.spec.json, docs/design-rank-portraits.md)', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; style: ArtImage['style']; tags: string[] }> };
  const all: ArtManifest = { styleVersion: 'spec', images: spec.images.map((i) => img(i.id, i.style, i.tags)) };
  const ladder = { patrol: ['low', 'mid', 'head'], palace: ['low', 'mid', 'high', 'head'], scholar: ['low', 'mid', 'high', 'head'] } as const;
  for (const [dept, tiers] of Object.entries(ladder)) {
    for (const rank of tiers) {
      const got = pickArt(all, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble', roles: ['official', `official_${dept}`], rank }))?.id;
      assert.equal(got, `portrait.m.adult.official_${dept}_${rank}`, `${dept} ${rank}`);
    }
  }
  // มหาดเล็กยังได้ภาพมหาดเล็ก · คนไม่มีตำแหน่งไม่ได้ภาพขั้นยศ · ขุนนางชราใช้ภาพชราเดิม
  assert.equal(pickArt(all, 'portrait', portraitArtTags({ sex: 'm', age: 20, estate: 'noble', roles: ['page'], rank: 'page' }))?.id, 'portrait.m.youth.page');
  assert.ok(!pickArt(all, 'portrait', portraitArtTags({ sex: 'm', age: 35, estate: 'noble' }))?.tags.some((t) => t.startsWith('rank:')));
});

const PORTRAIT_TAGS = new Set([
  'sex:m', 'sex:f',
  'age:child', 'age:youth', 'age:adult', 'age:elder',
  'role:page', 'role:official', 'role:official_patrol', 'role:official_palace', 'role:official_scholar',
  'role:monk', 'role:principal_wife', 'role:minor_wife', 'role:household_head', 'role:pregnant',
  'rank:page', 'rank:low', 'rank:mid', 'rank:high', 'rank:head',
]);

test('ทุกภาพใน assets.spec.json มี tag ที่มีอยู่จริงใน tags.json หรือเป็น event/หมวด/ตัวละครที่มีจริง', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; tags: string[] }> };
  const tags = new Set((JSON.parse(readFileSync('public/content/tags.json', 'utf8')) as Array<{ id: string }>).map((t) => t.id));
  const events = Object.keys(JSON.parse(readFileSync('public/content/events.json', 'utf8')) as Record<string, unknown>);
  const groups = new Set(events.map((e) => e.split('.')[0]));
  const history = (JSON.parse(readFileSync('public/content/rules.json', 'utf8')) as { history: Array<{ kind: string }> }).history;
  const kinds = new Set(history.map((h) => h.kind));
  for (const i of spec.images) {
    for (const t of i.tags) {
      const ok = t === 'legend:any' || PORTRAIT_TAGS.has(t) || (t.startsWith('historykind:') && kinds.has(t.slice(12)))
        || (t.startsWith('event:') ? events.includes(t.slice(6)) : t.startsWith('group:') ? groups.has(t.slice(6)) : tags.has(t));
      assert.ok(ok, `${i.id}: tag ${t} ไม่มีอยู่จริง`);
    }
  }
});

test('งานบ้านแต่ละหมวดได้ภาพของหมวดนั้น ไม่ตกไปที่ลานครัว (ใช้ป้ายจาก assets.spec.json)', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; style: ArtImage['style']; tags: string[] }> };
  const all: ArtManifest = { styleVersion: 'spec', images: spec.images.map((i) => img(i.id, i.style, i.tags)) };
  const chore = (event: string, domain: string) => pickArt(all, 'reality', eventArtTags(event, [`chore:${domain}`, 'chore:any']))?.id;
  for (const event of ['chore.ask', 'chore.learn']) {
    assert.equal(chore(event, 'kitchen'), 'scene.kitchen_yard');
    for (const d of ['housework', 'craft', 'flowers', 'merit']) assert.equal(chore(event, d), `scene.chore_${d}`);
  }
  assert.equal(pickArt(all, 'reality', eventArtTags('marriage.wedding_f', []))?.id, 'scene.wedding');
  assert.equal(pickArt(all, 'reality', eventArtTags('temple.elder', []))?.id, 'scene.elder_visit');
  assert.equal(pickArt(all, 'reality', eventArtTags('temple.other', []))?.id, 'scene.temple_holy_day');
});

test('เหตุการณ์ประวัติศาสตร์ทุกชนิดได้ภาพจิตรกรรมของชนิดนั้น (ผลัดแผ่นดินได้ history.succession)', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; style: ArtImage['style']; tags: string[] }> };
  const all: ArtManifest = { styleVersion: 'spec', images: spec.images.map((i) => img(i.id, i.style, i.tags)) };
  const history = (JSON.parse(readFileSync('public/content/rules.json', 'utf8')) as { history: Array<{ tag: string; kind: string }> }).history;
  for (const h of history) {
    const picked = pickArt(all, 'chronicle', [h.tag, `historykind:${h.kind}`])?.id;
    if (h.kind === 'succession') assert.equal(picked, 'history.succession', h.tag);
    else assert.ok(picked?.startsWith('history.'), `${h.tag} ได้ ${picked}`);
  }
  assert.equal(pickArt(all, 'chronicle', ['history:fall_of_ayutthaya', 'historykind:war'])?.id, 'history.fall_of_ayutthaya');
  assert.equal(pickArt(all, 'chronicle', ['history:cholera_2363', 'historykind:plague'])?.id, 'history.plague');
});

test('ภาพคะแนนเท่ากันสลับตาม seed แต่คงที่ต่อ seed — ไม่ส่ง seed ได้ภาพแรกเสมอ', () => {
  const twins: ArtManifest = { styleVersion: 'test', images: [img('scene.a', 'reality', ['event:x.y']), img('scene.b', 'reality', ['event:x.y'])] };
  const tags = eventArtTags('x.y', []);
  assert.equal(pickArt(twins, 'reality', tags)?.id, 'scene.a');
  const picks = new Set(Array.from({ length: 20 }, (_, i) => pickArt(twins, 'reality', tags, `ev${i}`)?.id));
  assert.deepEqual([...picks].sort(), ['scene.a', 'scene.b']);
  for (let i = 0; i < 20; i++) assert.equal(pickArt(twins, 'reality', tags, `ev${i}`)?.id, pickArt(twins, 'reality', tags, `ev${i}`)?.id);
});

// event ที่ยังรอภาพใหม่ — สร้างภาพแล้วให้ลบออกจากรายการนี้ (ว่างได้)
const AWAITING_ART = new Set<string>([]);

test('ทุก event มีภาพฉาก ยกเว้นที่จดไว้ว่ารอภาพ — event ใหม่ต้องวางภาพไว้ด้วย', () => {
  const real = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')) as ArtManifest;
  const events = Object.values(JSON.parse(readFileSync('public/content/events.json', 'utf8')) as Record<string, { id: string; contextTags?: string[] }>);
  const missing = events.filter((e) => !pickArt(real, 'reality', eventArtTags(e.id, e.contextTags ?? []))).map((e) => e.id);
  assert.deepEqual(missing.filter((id) => !AWAITING_ART.has(id)), [], 'event ไม่มีภาพ: เติม tag event:<id> ให้ภาพที่เข้ากันใน art/assets.spec.json และ public/art/manifest.json');
  for (const id of AWAITING_ART) assert.ok(missing.includes(id), `${id} มีภาพแล้ว — ลบออกจาก AWAITING_ART`);
});

test('tag ของภาพใน manifest ที่เกมโหลดตรงกับ assets.spec.json', () => {
  const real = JSON.parse(readFileSync('public/art/manifest.json', 'utf8')) as ArtManifest;
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; tags: string[] }> };
  for (const s of spec.images) {
    const m = real.images.find((i) => i.id === s.id);
    if (m) assert.deepEqual(m.tags, s.tags, s.id);
  }
});
