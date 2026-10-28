import type { GameState } from '../core/types';
import type { SaveSlotInfo } from './protocol';

// ============================================================================
// IndexedDB persistence (ใช้ได้ใน Dedicated Worker โดยตรง)
//
// DB "dynasty-sim"
//   slots  : keyPath 'slot' → SaveSlotInfo (สำหรับหน้า Load โดยไม่ต้องอ่านเซฟทั้งก้อน)
//   tables : key `${slot}:${table}` → Record<id, entity> ของตารางนั้น
//
// - เขียนทุกตารางใน transaction เดียว → atomic: ปิดแท็บกลางคันไม่มีวันได้เซฟครึ่งๆ กลางๆ
// - เก็บเป็น structured clone ตรงๆ (ไม่ JSON.stringify) → เร็วและไม่มี parse cost ตอนโหลด
// - 1 ตาราง = 1 record: ต่อยอดเป็น dirty-table save ได้ (เขียนเฉพาะตารางที่เปลี่ยน)
// ============================================================================

const DB_NAME = 'dynasty-sim';
const DB_VERSION = 1;
export const CURRENT_SCHEMA = 1;

type TableName = Exclude<keyof GameState, 'meta'>;
const TABLES: TableName[] = [
  'characters', 'bodyParts', 'wounds', 'memories', 'traits', 'households',
  'familyNodes', 'dynasties', 'legends', 'items', 'relations', 'eventLog',
];

/** migration[v] แปลง state จาก schema v → v+1 */
const migrations: Record<number, (s: GameState) => void> = {};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('tables')) db.createObjectStore('tables');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });

const result = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const slotRange = (slot: string) => IDBKeyRange.bound(`${slot}:`, `${slot}:￿`);

export async function saveState(
  slot: string, state: GameState, info: Pick<SaveSlotInfo, 'year' | 'playerName' | 'dynastyName'>,
): Promise<SaveSlotInfo> {
  const db = await openDb();
  const tx = db.transaction(['slots', 'tables'], 'readwrite');
  const tables = tx.objectStore('tables');
  tables.delete(slotRange(slot));
  tables.put(state.meta, `${slot}:meta`);
  for (const t of TABLES) tables.put(state[t], `${slot}:${t}`);
  const full: SaveSlotInfo = {
    ...info,
    slot,
    savedAt: Date.now(),
    bytes: new Blob([JSON.stringify(state)]).size, // ขนาดโดยประมาณ แสดงใน UI
    schemaVersion: state.meta.schemaVersion,
  };
  tx.objectStore('slots').put(full);
  await done(tx);
  return full;
}

export async function loadState(slot: string): Promise<GameState | null> {
  const db = await openDb();
  const tx = db.transaction('tables', 'readonly');
  const store = tx.objectStore('tables');
  const meta = await result(store.get(`${slot}:meta`) as IDBRequest<GameState['meta'] | undefined>);
  if (!meta) return null;
  const state = { meta } as GameState;
  const parts = await Promise.all(TABLES.map((t) => result(store.get(`${slot}:${t}`))));
  TABLES.forEach((t, i) => ((state as unknown as Record<string, unknown>)[t] = parts[i] ?? {}));
  return migrate(state);
}

export async function listSlots(): Promise<SaveSlotInfo[]> {
  const db = await openDb();
  const all = await result(db.transaction('slots', 'readonly').objectStore('slots').getAll() as IDBRequest<SaveSlotInfo[]>);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSlot(slot: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['slots', 'tables'], 'readwrite');
  tx.objectStore('tables').delete(slotRange(slot));
  tx.objectStore('slots').delete(slot);
  await done(tx);
}

function migrate(state: GameState): GameState {
  let v = state.meta.schemaVersion;
  if (v > CURRENT_SCHEMA) throw new Error(`เซฟมาจากเวอร์ชันใหม่กว่า (schema ${v})`);
  while (v < CURRENT_SCHEMA) {
    const step = migrations[v];
    if (!step) throw new Error(`ไม่มี migration จาก schema ${v}`);
    step(state);
    state.meta.schemaVersion = ++v;
  }
  return state;
}
