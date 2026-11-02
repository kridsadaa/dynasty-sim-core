import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHANGELOG, releaseNotes } from './release';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const semver = /^\d+\.\d+\.\d+$/;
const cmp = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  return x![0]! - y![0]! || x![1]! - y![1]! || x![2]! - y![2]!;
};

test('changelog รุ่นบนสุดตรงกับ package.json และเรียงจากใหม่ไปเก่า', () => {
  assert.equal(CHANGELOG[0]!.version, pkg.version, 'ขึ้นเลขใน package.json แล้วต้องเติม entry บนสุดของ src/changelog.json');
  for (let i = 1; i < CHANGELOG.length; i++) assert.ok(cmp(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version) > 0, `รุ่น ${CHANGELOG[i]!.version} ต้องเก่ากว่ารุ่นก่อนหน้า`);
});

test('ทุก entry มีเลขรุ่น วันที่ และอย่างน้อยหนึ่งรายการ', () => {
  const seen = new Set<string>();
  for (const e of CHANGELOG) {
    assert.match(e.version, semver);
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!seen.has(e.version), `รุ่น ${e.version} ซ้ำ`);
    seen.add(e.version);
    assert.ok((e.added?.length ?? 0) + (e.changed?.length ?? 0) + (e.fixed?.length ?? 0) > 0, `รุ่น ${e.version} ไม่มีรายการเลย`);
  }
  assert.equal(releaseNotes('0.0.0'), undefined);
});
