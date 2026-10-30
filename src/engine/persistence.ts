import { DAYS_PER_YEAR } from '../core/calendar';
import type { GameState } from '../core/types';
import type { PendingEventSnapshot } from '../systems/events';
import type { SaveSlotInfo } from './protocol';

// ============================================================================
// IndexedDB persistence (ใช้ได้ใน Dedicated Worker โดยตรง)
//
// DB "dynasty-sim"
//   slots  : keyPath 'slot' → SaveSlotInfo (สำหรับหน้า Load โดยไม่ต้องอ่านเซฟทั้งก้อน)
//   tables : key `${slot}:${table}` → Record<id, entity> ของตารางนั้น
//            key `${slot}:pending` → PendingEventSnapshot[] (event ที่รอผู้เล่น — ไม่ใช่ส่วนของ GameState)
//
// - เขียนทุกตารางใน transaction เดียว → atomic: ปิดแท็บกลางคันไม่มีวันได้เซฟครึ่งๆ กลางๆ
// - เก็บเป็น structured clone ตรงๆ (ไม่ JSON.stringify) → เร็วและไม่มี parse cost ตอนโหลด
// - 1 ตาราง = 1 record: ต่อยอดเป็น dirty-table save ได้ (เขียนเฉพาะตารางที่เปลี่ยน)
// ============================================================================

const DB_NAME = 'dynasty-sim';
const DB_VERSION = 1;
export const CURRENT_SCHEMA = 2;

type TableName = Exclude<keyof GameState, 'meta'>;
const TABLES: TableName[] = [
  'characters', 'bodyParts', 'wounds', 'memories', 'traits', 'households',
  'familyNodes', 'dynasties', 'legends', 'items', 'relations', 'eventLog', 'intents',
];

/** migration[v] แปลง state จาก schema v → v+1 */
const migrations: Record<number, (s: GameState) => void> = {
  // ปี 360 วัน → วันจริงตามปฏิทิน (core/calendar.ts): ทุกฟิลด์ที่เป็นวันยืดตามสัดส่วน ปีที่ n ยังตรงกับปีที่ n
  1: (s) => scaleDays(s, DAYS_PER_YEAR / 360),
};

/** ชื่อฟิลด์ที่เก็บ Day ใน GameState (ดู core/types.ts) */
const DAY_KEYS = new Set([
  'day', 'birthDay', 'deathDay', 'marriedDay', 'moveOutDay', 'weddingDay', 'untilDay', 'sinceDay', 'dueDay',
  'askAfter', 'startDay', 'inflictedDay', 'stageSinceDay', 'acquiredDay', 'lastTriggeredDay',
]);

function scaleDays(node: unknown, k: number): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, v] of Object.entries(node as Record<string, unknown>)) {
    if (typeof v === 'number' && DAY_KEYS.has(key)) (node as Record<string, unknown>)[key] = Math.round(v * k);
    else scaleDays(v, k);
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('slots')) db.createObjectStore('slots', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('tables')) db.createObjectStore('tables');
    };
    r.onsuccess = () => {
      const db = r.result;
      if (blocked) return db.close(); // reject ไปแล้ว — การเปิดที่สำเร็จทีหลังไม่มีใครถือ ต้องปิดทิ้ง
      // แท็บอื่น (เวอร์ชันใหม่) ขออัปเกรด DB → ปิดของเราเพื่อไม่ขวาง แล้วเปิดใหม่ครั้งหน้า
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    // แท็บเก่ายังเปิด DB เวอร์ชันเดิมค้างอยู่ → อัปเกรดไม่ได้ (ไม่งั้น save/load ค้างเงียบ)
    r.onblocked = () => {
      blocked = true;
      reject(new Error('ฐานข้อมูลเซฟถูกแท็บอื่นของเกมใช้อยู่ — ปิดแท็บอื่นแล้วลองใหม่'));
    };
  }).catch((err) => {
    dbPromise = null; // ไม่ cache ความล้มเหลว → ลองเปิดใหม่ได้
    throw err;
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

/** ':' เป็นตัวคั่น key — ถ้ายอมให้ชื่อ slot มี ':' ช่วงของ slot "a" จะกินเซฟของ "a:b" ด้วย */
function checkSlot(slot: string): void {
  if (!slot || slot.includes(':')) throw new Error(`ชื่อช่องเซฟไม่ถูกต้อง: "${slot}" (ห้ามว่างหรือมี ':')`);
}

const slotRange = (slot: string) => IDBKeyRange.bound(`${slot}:`, `${slot}:￿`);

export interface SavedGame {
  state: GameState;
  pending: PendingEventSnapshot[]; // event ที่รอผู้เล่นตัดสินใจ ณ ตอนเซฟ
}

export async function saveState(
  slot: string, { state, pending }: SavedGame, info: Pick<SaveSlotInfo, 'year' | 'playerName' | 'dynastyName'>,
): Promise<SaveSlotInfo> {
  checkSlot(slot);
  const full: SaveSlotInfo = {
    ...info,
    slot,
    savedAt: Date.now(),
    bytes: new Blob([JSON.stringify(state)]).size, // ขนาดโดยประมาณ แสดงใน UI
    schemaVersion: state.meta.schemaVersion,
  };
  const db = await openDb();
  const tx = db.transaction(['slots', 'tables'], 'readwrite');
  const committed = done(tx);
  try {
    const tables = tx.objectStore('tables');
    tables.delete(slotRange(slot));
    tables.put(state.meta, `${slot}:meta`);
    for (const t of TABLES) tables.put(state[t], `${slot}:${t}`);
    tables.put(pending, `${slot}:pending`);
    tx.objectStore('slots').put(full);
  } catch (err) {
    // put โยน error แบบ sync ได้ (เช่น DataCloneError) — ต้อง abort เอง ไม่งั้น delete + put ที่ผ่านแล้วจะ commit
    tx.abort();
    committed.catch(() => {});
    throw err;
  }
  await committed;
  return full;
}

export async function loadState(slot: string): Promise<SavedGame | null> {
  checkSlot(slot);
  const db = await openDb();
  const tx = db.transaction('tables', 'readonly');
  const store = tx.objectStore('tables');
  const meta = await result(store.get(`${slot}:meta`) as IDBRequest<GameState['meta'] | undefined>);
  if (!meta) return null;
  const state = { meta } as GameState;
  const [pending, ...parts] = await Promise.all([
    result(store.get(`${slot}:pending`) as IDBRequest<PendingEventSnapshot[] | undefined>),
    ...TABLES.map((t) => result(store.get(`${slot}:${t}`))),
  ]);
  TABLES.forEach((t, i) => ((state as unknown as Record<string, unknown>)[t] = parts[i] ?? {}));
  return { state: migrate(state), pending: pending ?? [] };
}

export async function listSlots(): Promise<SaveSlotInfo[]> {
  const db = await openDb();
  const all = await result(db.transaction('slots', 'readonly').objectStore('slots').getAll() as IDBRequest<SaveSlotInfo[]>);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSlot(slot: string): Promise<void> {
  checkSlot(slot);
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
