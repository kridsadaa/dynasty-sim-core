// ============================================================================
// Main thread ⇄ Worker protocol
// - Request/Reply: มี id กำกับ (RPC แบบ promise)
// - Push: worker ส่งเองระหว่าง simulate (log, progress, event ที่รอผู้เล่นเลือก)
// ทุกอย่างเป็น plain data (structured-clone ได้) — ไม่ส่ง Ctx/class ข้ามเธรด
// ============================================================================

import type { LogKind } from '../systems/world';

export type { LogKind };

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
  | { type: 'viewPending' }
  | { type: 'viewTree' }
  | { type: 'viewCharacter'; nodeId: string };

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
  viewTree: TreeView;
  viewCharacter: InspectView;
}

export type StopReason = 'done' | 'event' | 'paused' | 'gameOver';

export interface Request<T extends Command['type'] = Command['type']> {
  id: number;
  cmd: Extract<Command, { type: T }>;
}

export type Reply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };

export type Push =
  | { type: 'ready' }
  | { type: 'log'; year: number; lines: LogLine[] }
  | { type: 'progress'; day: number; year: number }
  | { type: 'pendingEvent'; event: EventView }
  | { type: 'handover'; deceased: string; heir: string; lines: string[] }
  | { type: 'error'; message: string }; // ผิดพลาดที่ไม่ผูกกับ request ใด (เช่น โหลด content ไม่ได้, worker พัง)

export type WorkerMessage = { kind: 'reply'; reply: Reply } | { kind: 'push'; push: Push };

export interface LogLine {
  kind: LogKind;
  text: string;
}

export interface EventView {
  instanceId: string;
  title: string;
  text: string;
  options: Array<{ id: string; text: string; locked: boolean; injected: boolean }>;
  triggered: string[]; // ปมที่ถูกกระตุ้น (สำหรับ UI แสดง "ใจสั่น...")
}

export interface CharacterView {
  name: string;
  nodeId: string; // เปิดหน้าดูตัวละคร/ผังตระกูลจากชื่อผู้เล่น
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

/** ผังตระกูลแบบแบน — UI ประกอบเป็นต้นไม้เอง (เริ่มจาก founder) */
export interface TreeView {
  dynastyName: string;
  founderNodeId: string;
  headNodeId: string;
  playerNodeId: string | null;
  nodes: TreeNodeView[];
  branches: Array<{ rootNodeId: string; label: string; memberCount: number; generations: number }>;
}

export interface TreeNodeView {
  id: string;
  name: string;
  sex: 'm' | 'f';
  birthYear: number;
  deathYear: number | null;
  alive: boolean;
  /** ตัวละครถูก prune แล้ว เหลือแต่ชื่อในผัง */
  pruned: boolean;
  /** คู่ครองคนนอก (ไม่มีพ่อแม่ในผัง) */
  marriedIn: boolean;
  parentage: string | null; // null = ภรรยาเอก/ไม่ต้องบอก
  fatherId: string | null;
  motherId: string | null;
  spouseIds: string[];
  childIds: string[];
}

/** หน้าดูตัวละครแบบละเอียด (ใช้ debug ระบบ) — คนที่ถูก prune มีแค่ส่วน summary */
export interface InspectView {
  nodeId: string;
  name: string;
  sex: 'm' | 'f';
  lifespan: string;
  status: string; // ยังมีชีวิต / ถึงแก่กรรม (สาเหตุ) / เหลือแต่ชื่อ
  facts: Array<[string, string]>;
  sections: Array<{ title: string; items: string[] }>;
}
