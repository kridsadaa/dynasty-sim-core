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
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'setSpeed'; speed: number }
  | { type: 'choose'; instanceId: string; optionId: string; name?: string }
  | { type: 'viewPlayer' }
  | { type: 'viewDynasty' }
  | { type: 'viewPending' }
  | { type: 'viewTree' }
  | { type: 'viewCharacter'; nodeId: string }
  | { type: 'viewKnown' }
  | { type: 'planIntent'; targetId: string; kind: string }
  | { type: 'startIntent'; targetId: string; kind: string; approach: string }
  | { type: 'abandonIntent' };

export interface ReplyData {
  newGame: CharacterView;
  load: CharacterView;
  save: SaveSlotInfo;
  listSaves: SaveSlotInfo[];
  deleteSave: null;
  play: ClockState;
  pause: ClockState;
  setSpeed: ClockState;
  choose: { lines: string[] };
  viewPlayer: CharacterView;
  viewDynasty: DynastyView;
  viewPending: EventView[];
  viewTree: TreeView;
  viewCharacter: InspectView;
  viewKnown: KnownPersonView[];
  planIntent: IntentPlanView;
  startIntent: { lines: string[] };
  abandonIntent: { lines: string[] };
}

/** playing = เวลากำลังเดิน; ended = ตระกูลสิ้นสาย เล่นต่อไม่ได้ */
export interface ClockState {
  playing: boolean;
  speed: number;
  maxSpeed: number;
  ended: boolean;
}

export interface Request<T extends Command['type'] = Command['type']> {
  id: number;
  cmd: Extract<Command, { type: T }>;
}

export type Reply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: string };

export type Push =
  | { type: 'ready' }
  | { type: 'log'; year: number; lines: LogLine[] }
  /** solar: วันที่สุริยคติสำหรับผู้เล่น · lunar: วันจันทรคติแบบที่คนในเรื่องใช้ */
  | { type: 'progress'; day: number; year: number; solar: string; lunar: string }
  | { type: 'clock'; clock: ClockState }
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
  /** note: เหตุผลที่ล็อก หรือคำเตือนว่าต้องฝืนใจ */
  /** nameInput: ตัวเลือกนี้ให้ผู้เล่นพิมพ์ชื่อ — default = ชื่อที่เสนอไว้ก่อน */
  options: Array<{
    id: string; text: string; locked: boolean; injected: boolean; note?: string;
    nameInput?: { default: string; label: string };
    /** ราคา/โอกาสของตัวเลือก (สินสอด ผู้ใหญ่จะยอมไหม) — คนละเรื่องกับ note ที่เป็นเรื่องในใจ */
    hint?: string;
  }>;
  triggered: string[]; // ปมที่ถูกกระตุ้น (สำหรับ UI แสดง "ใจสั่น...")
}

export interface CharacterView {
  name: string;
  nodeId: string; // เปิดหน้าดูตัวละคร/ผังตระกูลจากชื่อผู้เล่น
  age: number;
  year: number;
  /** วันที่สุริยคติ / จันทรคติ ณ ตอนนี้ (แถบวันที่) */
  solar: string;
  lunar: string;
  estate: string;
  title: string | null;
  wealth: number;
  traits: string[];
  scars: string[];
  wounds: string[];
  capabilities: Record<string, number>;
  /** ชีวิตประจำวันตอนนี้ — เปลี่ยนตามความตั้งใจที่ทำอยู่ (ไปช่วยงานบ้านคนอื่น = ไม่ได้อยู่ช่วยบ้าน) */
  lifestyle: string;
  intent: IntentStatusView | null;
  /** หมั้น วันนัดแต่ง ค่าน้ำนมที่ค้าง ช่วยงานบ้านพ่อตาแม่ยาย */
  marriage: string[];
  /** ตำแหน่งราชการ (ไม่มี = null) */
  office: string | null;
  /** ฝีมืองานบ้าน: "งานครัว 23 (หัดได้ 4 ขั้น)" */
  craftSkills: string[];
}

/** คนในแผง "คนที่รู้จัก" — ญาติที่ยังมีชีวิต และคนนอกตระกูลที่ผู้เล่นรู้จัก */
export interface KnownPersonView {
  id: string;
  nodeId: string; // กดชื่อแล้วเปิดหน้าดูตัวละคร
  name: string;
  age: number;
  /** พ่อ แม่ พี่ชาย ภรรยา ลูกสาว / เพื่อนสนิท คนรู้จัก */
  tie: string;
  kin: boolean;
  /** "ลูกสาวบ้านช่างทอง · ต่างตำบล · ยังไม่ออกเรือน" */
  detail: string;
  /** สิ่งที่ตั้งใจทำกับคนนี้ได้ (กดแล้วเปิดหน้าเลือกวิธี) */
  actions: Array<{ kind: string; label: string }>;
  /** เป็นเป้าของความตั้งใจที่ทำอยู่ */
  focus: boolean;
}

export interface OddsFactorView {
  label: string;
  /** เปอร์เซ็นต์ (บวก/ลบ) */
  value: number;
}

export interface IntentPlanView {
  kind: string;
  targetId: string;
  title: string;
  text: string;
  /** ความตั้งใจเดิมที่จะถูกยกเลิกถ้าเริ่มอันนี้ */
  replaces?: string;
  approaches: Array<{
    id: string;
    label: string;
    odds: number;
    months: number;
    factors: OddsFactorView[];
    /** ชีวิตประจำวันจะเปลี่ยนอย่างไร */
    lifestyle: string;
    unavailable?: string;
  }>;
}

export interface IntentStatusView {
  title: string;
  approach: string;
  progress: number;
  monthsLeft: number;
  odds: number;
  factors: OddsFactorView[];
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
  /** แยกไปอยู่ที่อื่นทั้งที่ยังมีชีวิต (ญาติห่างไกล) — ไม่ได้ตาย */
  drifted: boolean;
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
