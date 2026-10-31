// npm test — ทางที่ save/load ล้มได้ ซึ่งเดิมตรวจด้วยการอ่านโค้ดเท่านั้น (fake-indexeddb แทน IndexedDB ของเบราว์เซอร์)
// ลำดับ test มีผล: persistence.ts cache การเปิด DB ไว้ทั้งโมดูล → test "แท็บอื่น block" ต้องรันก่อนเปิด DB ครั้งแรก
import { IDBFactory } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Character, GameState } from '../core/types';
import { emptyState } from '../systems/factory';
import { deleteSlot, listSlots, loadState, saveState } from './persistence';

const info = { year: 2290, playerName: 'ทดสอบ', dynastyName: 'ตระกูลทดสอบ' };

function stateWith(name: string): GameState {
  const s = emptyState(7);
  s.characters['chr_1' as Character['id']] = { name } as Character;
  return s;
}

test('แท็บอื่น block การเปิด DB → reject พร้อมข้อความ และครั้งถัดไปลองเปิดใหม่ได้', async () => {
  const real = globalThis.indexedDB;
  globalThis.indexedDB = {
    open: () => {
      const r = {} as IDBOpenDBRequest;
      queueMicrotask(() => r.onblocked?.(new Event('blocked') as IDBVersionChangeEvent));
      return r;
    },
  } as unknown as IDBFactory;
  await assert.rejects(saveState('a', { state: stateWith('ก'), pending: [] }, info), /แท็บอื่น/);
  globalThis.indexedDB = real;
  await saveState('a', { state: stateWith('ก'), pending: [] }, info);
  await deleteSlot('a');
});

test('เซฟแล้วโหลดได้ state และ event ที่รออยู่ครบ', async () => {
  const pending = [{ defId: 'childhood.kitchen_cut' }] as never[];
  await saveState('round', { state: stateWith('ทอง'), pending }, info);
  const got = await loadState('round');
  assert.equal(got?.state.characters['chr_1' as Character['id']]?.name, 'ทอง');
  assert.deepEqual(got?.pending, pending);
  assert.deepEqual((await listSlots()).map((s) => s.slot), ['round']);
  await deleteSlot('round');
  assert.equal(await loadState('round'), null);
});

test('put ล้มกลาง transaction (DataCloneError) → abort ทั้งก้อน เซฟเดิมในช่องนั้นไม่หาย', async () => {
  await saveState('keep', { state: stateWith('เดิม'), pending: [] }, info);
  const bad = stateWith('ใหม่');
  (bad.characters['chr_1' as Character['id']] as unknown as Record<string, unknown>).fn = () => 1;
  await assert.rejects(saveState('keep', { state: bad, pending: [] }, info));
  const got = await loadState('keep');
  assert.equal(got?.state.characters['chr_1' as Character['id']]?.name, 'เดิม');
  await deleteSlot('keep');
});

test('ลบช่อง "a" ไม่กินเซฟของช่องที่ชื่อขึ้นต้นเหมือนกัน', async () => {
  await saveState('a', { state: stateWith('ก'), pending: [] }, info);
  await saveState('ab', { state: stateWith('ข'), pending: [] }, info);
  await deleteSlot('a');
  assert.equal((await loadState('ab'))?.state.characters['chr_1' as Character['id']]?.name, 'ข');
  await deleteSlot('ab');
});

test('ชื่อช่องว่างหรือมี ":" ถูกปฏิเสธ', async () => {
  await assert.rejects(saveState('', { state: stateWith('ก'), pending: [] }, info), /ชื่อช่องเซฟ/);
  await assert.rejects(loadState('a:b'), /ชื่อช่องเซฟ/);
});

test('เซฟจาก schema ที่ใหม่กว่าเกม → โหลดไม่ได้ (ไม่เดาแปลงย้อน)', async () => {
  const s = stateWith('ก');
  s.meta.schemaVersion = 999;
  await saveState('future', { state: s, pending: [] }, info);
  await assert.rejects(loadState('future'), /เวอร์ชันใหม่กว่า/);
  await deleteSlot('future');
});
