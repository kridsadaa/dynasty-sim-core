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
    img('portrait.f.adult.noble', 'portrait', ['sex:f', 'age:adult', 'estate:noble', 'role:principal_wife']),
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

const PORTRAIT_TAGS = new Set([
  'sex:m', 'sex:f',
  'age:child', 'age:youth', 'age:adult', 'age:elder',
  'role:page', 'role:official', 'role:official_patrol', 'role:official_palace', 'role:official_scholar',
  'role:monk', 'role:principal_wife', 'role:minor_wife', 'role:household_head', 'role:pregnant',
]);

test('ทุกภาพใน assets.spec.json มี tag ที่มีอยู่จริงใน tags.json หรือเป็น event/หมวด/ตัวละครที่มีจริง', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; tags: string[] }> };
  const tags = new Set((JSON.parse(readFileSync('public/content/tags.json', 'utf8')) as Array<{ id: string }>).map((t) => t.id));
  const events = Object.keys(JSON.parse(readFileSync('public/content/events.json', 'utf8')) as Record<string, unknown>);
  const groups = new Set(events.map((e) => e.split('.')[0]));
  for (const i of spec.images) {
    for (const t of i.tags) {
      const ok = t === 'legend:any' || PORTRAIT_TAGS.has(t)
        || (t.startsWith('event:') ? events.includes(t.slice(6)) : t.startsWith('group:') ? groups.has(t.slice(6)) : tags.has(t));
      assert.ok(ok, `${i.id}: tag ${t} ไม่มีอยู่จริง`);
    }
  }
});
