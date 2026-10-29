// ============================================================================
// Main thread ⇄ Worker protocol
// - Request/Reply: มี id กำกับ (RPC แบบ promise)
// - Push: worker ส่งเองระหว่าง simulate (log, progress, event ที่รอผู้เล่นเลือก)
// ทุกอย่างเป็น plain data (structured-clone ได้) — ไม่ส่ง Ctx/class ข้ามเธรด
// ============================================================================

export type Command =
  | { type: 'newGame'; seed: number; heroName?: string }
  | { type: 'load'; slot: string }
  | { type: 'save'; slot: string }
  | { type: 'listSaves' }
  | { type: 'deleteSave'; slot: string }
  | { type: 'advance'; days: number }
  | { type: 'pause' }
  | { type: 'choose'; instanceId: string; optionId: string }
  | { type: 'viewPlayer' }
  | { type: 'viewDynasty' }
  | { type: 'viewPending' };

export interface ReplyData {
  newGame: CharacterView;
  load: CharacterView;
  save: SaveSlotInfo;
  listSaves: SaveSlotInfo[];
  deleteSave: null;
  advance: { stoppedBy: StopReason; day: number };
  pause: null;
  choose: { lines: string[] };
  viewPlayer: CharacterView;
  viewDynasty: DynastyView;
  viewPending: EventView[];
}

export type StopReason = 'done' | 'event' | 'paused' | 'gameOver';

export interface Request<T extends Command['type'] = Command['type']> {
  id: number;
  cmd: Extract<Command, { type: T }>;
}

export type Reply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };

export type Push =
  | { type: 'ready' }
  | { type: 'log'; year: number; lines: string[] }
  | { type: 'progress'; day: number; year: number }
  | { type: 'pendingEvent'; event: EventView }
  | { type: 'handover'; deceased: string; heir: string; lines: string[] }
  | { type: 'error'; message: string }; // ผิดพลาดที่ไม่ผูกกับ request ใด (เช่น โหลด content ไม่ได้, worker พัง)

export type WorkerMessage = { kind: 'reply'; reply: Reply } | { kind: 'push'; push: Push };

export interface EventView {
  instanceId: string;
  title: string;
  text: string;
  /** note: เหตุผลที่ล็อก หรือคำเตือนว่าต้องฝืนใจ */
  options: Array<{ id: string; text: string; locked: boolean; injected: boolean; note?: string }>;
  triggered: string[]; // ปมที่ถูกกระตุ้น (สำหรับ UI แสดง "ใจสั่น...")
}

export interface CharacterView {
  name: string;
  age: number;
  year: number;
  estate: string;
  title: string | null;
  wealth: number;
  traits: string[];
  scars: string[];
  wounds: string[];
  capabilities: Record<string, number>;
}

export interface DynastyView {
  name: string;
  prestige: number;
  taboos: string[];
  legends: string[]; // เฉพาะฉบับ "ที่เล่ากัน" — ความจริงต้องค้นพบผ่าน gameplay
  livingMembers: number;
  familyNodes: number;
}

export interface SaveSlotInfo {
  slot: string;
  savedAt: number;
  year: number;
  playerName: string;
  dynastyName: string;
  bytes: number;
  schemaVersion: number;
}
