import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { eventArtTags, pickArt, type ArtImage, type ArtManifest } from './select';

const img = (id: string, style: ArtImage['style'], tags: string[]): ArtImage => ({ id, file: `art/${id}.webp`, style, tags, alt: id, width: 1024, height: 572 });
const manifest: ArtManifest = {
  styleVersion: 'test',
  images: [
    img('scene.compound', 'reality', ['group:family']),
    img('scene.sickbed', 'reality', ['event:family.parent_illness', 'situation:illness']),
    img('scene.kitchen', 'reality', ['place:kitchen', 'situation:kitchen_work']),
    img('legend.battle', 'chronicle', ['legend:any', 'place:battlefield']),
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
  assert.equal(pickArt(manifest, 'chronicle', ['legend:any', 'place:kitchen'])?.id, 'legend.battle');
  assert.equal(pickArt(manifest, 'reality', ['place:battlefield']), null);
});

test('ทุกภาพใน assets.spec.json มี tag ที่มีอยู่จริงใน tags.json หรือเป็น event/หมวดที่มีจริง', () => {
  const spec = JSON.parse(readFileSync('art/assets.spec.json', 'utf8')) as { images: Array<{ id: string; tags: string[] }> };
  const tags = new Set((JSON.parse(readFileSync('public/content/tags.json', 'utf8')) as Array<{ id: string }>).map((t) => t.id));
  const events = Object.keys(JSON.parse(readFileSync('public/content/events.json', 'utf8')) as Record<string, unknown>);
  const groups = new Set(events.map((e) => e.split('.')[0]));
  for (const i of spec.images) {
    for (const t of i.tags) {
      const ok = t === 'legend:any'
        || (t.startsWith('event:') ? events.includes(t.slice(6)) : t.startsWith('group:') ? groups.has(t.slice(6)) : tags.has(t));
      assert.ok(ok, `${i.id}: tag ${t} ไม่มีอยู่จริง`);
    }
  }
});
