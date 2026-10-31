import type { Estate, TagId } from '../core/types';

// ============================================================================
// Lore Base — คลังข้อมูลประวัติศาสตร์ที่มีแหล่งอ้างอิง
// ไม่ถูกโหลดเข้าเกมตอนรัน: เป็น "แหล่งความจริง" ที่ content (public/content) อ้างถึงผ่าน loreRefs
// และเป็นฐานของ style bible / visual bible
// ปี = พ.ศ. ทั้งหมด
// ============================================================================

export type YearRange = [number, number];

// ค่าที่อนุญาตของฟิลด์ enum — validator ใช้ตรวจตอนรัน (type อ้างจากอาร์เรย์เหล่านี้เพื่อไม่ให้หลุดกัน)
export const SOURCE_KINDS = ['primary', 'secondary', 'visual', 'ethnographic'] as const;
export const LORE_DOMAINS = ['event', 'social', 'naming', 'vocab', 'belief', 'material', 'attire', 'place', 'kinship', 'ritual', 'psyche', 'health'] as const;
export const LORE_STATUSES = ['attested', 'inferred', 'invented'] as const;
export const APPLIES_AS = ['fact', 'pattern', 'mechanic'] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];
export type LoreStatus = (typeof LORE_STATUSES)[number];

export interface Source {
  id: string; // "src.<slug>"
  title: string;
  author?: string;
  /**
   * primary = เอกสารร่วมยุค/ตัวบท, secondary = งานวิชาการประวัติศาสตร์,
   * visual = ภาพ, ethnographic = งานภาคสนามมานุษยวิทยา/สังคมวิทยา (สังเกตสังคมในยุคที่ศึกษา ไม่ใช่ยุคของเกม)
   */
  kind: SourceKind;
  /** ปีที่เขียน/ชำระ/สร้าง — ไม่ทราบให้เว้นไว้และบันทึกใน notes */
  composedYear?: number;
  /** ช่วงเวลาที่เอกสาร "บรรยายถึง" */
  describesPeriod: YearRange;
  /** 1 = น่าสงสัย .. 5 = เชื่อถือได้สูง (ความเห็นของผู้ลงข้อมูล) */
  reliability: 1 | 2 | 3 | 4 | 5;
  url?: string;
  /** สำคัญกับภาพอ้างอิง: ภาพถ่ายจิตรกรรมอาจมีลิขสิทธิ์แม้ตัวงานจะเป็นสมบัติสาธารณะ */
  license?: string;
  notes?: string;
}

/**
 * kinship = เครือญาติ ที่อยู่หลังแต่งงาน ครัวเรือน
 * ritual  = พิธีตามช่วงชีวิต
 * psyche  = ขวัญ การเลี้ยงดู ความกลัวและการเยียวยาแบบพื้นบ้าน
 * health  = โรค การตาย อายุขัย การเกิด — ฐานของความเสี่ยงตายในเกม
 */
export type LoreDomain = (typeof LORE_DOMAINS)[number];

/**
 * ข้อมูลนี้ใช้ทำอะไรได้
 * fact     = ข้อเท็จจริงของยุคในเกม ใช้ในข้อความ/ภาพได้
 * pattern  = แบบแผนทางสังคมที่น่าจะเปลี่ยนช้า ใช้กำหนดพฤติกรรม NPC/ค่าความน่าจะเป็น แต่ไม่ยกไปเป็นรายละเอียดฉาก
 * mechanic = แนวคิด/ทฤษฎีที่ใช้ออกแบบกลไกเกม (เช่น บุญบารมีกับบริวาร)
 */
export type AppliesAs = (typeof APPLIES_AS)[number];

export interface Citation {
  sourceId: string;
  /** เล่ม/หน้า/ย่อหน้า/ผนัง — "TODO" ได้ระหว่างร่าง แต่จะถูกเตือน */
  locator: string;
  quote?: string; // ข้อความสั้นๆ จากต้นฉบับ (ระวังลิขสิทธิ์ของฉบับแปลสมัยใหม่)
}

export interface LoreEntry {
  id: string; // "<domain>.<slug>"
  domain: LoreDomain;
  title: string;
  period: YearRange;
  estates?: Estate[];
  sex?: 'm' | 'f';
  region?: string;
  /** ข้อมูลแบบมีโครงสร้าง — ระบบเกมอ่านได้ (ดู claim types ด้านล่างเป็นแนวทาง) */
  claim: Record<string, unknown>;
  summary: string; // คำอธิบายภาษาคนสำหรับนักเขียน
  status: LoreStatus;
  /** บังคับเมื่อ status = 'invented' */
  rationale?: string;
  citations: Citation[];
  /** มีคนเปิดเอกสารจริงตรวจแล้ว */
  verified: boolean;
  /** ค่าเริ่มต้น 'fact' — ข้อมูลจากงานภาคสนามต่างยุคต้องเป็น pattern/mechanic */
  appliesAs?: AppliesAs;
  /** อธิบายว่าทำไมจึงอนุมานย้อนไปถึงยุคของเกมได้ — บังคับเมื่ออ้างงานภาคสนามที่ไม่ร่วมยุค */
  projection?: string;
  /** ข้อถกเถียงทางวิชาการ/มุมที่ขัดกัน */
  contested?: string;
  /** ผูกกับ content ของเกม — validator ตรวจว่ามีอยู่จริง */
  gameRefs?: { tags?: TagId[] };
}

/** คำ/แนวคิดที่ห้ามใช้นอกช่วงเวลาที่กำหนด — lint ข้อความในเกม */
export interface AnachronismRule {
  term: string;
  validFrom?: number;
  validTo?: number;
  note: string;
  loreRef?: string;
}

export interface LoreConfig {
  /** ช่วงปีที่ข้อความในเกมครอบคลุม — ใช้ตรวจ anachronism */
  gamePeriod: YearRange;
  /** slice ที่กำลังทำ (ROADMAP เฟส 0) */
  currentSlice: { label: string; period: YearRange; estates: Estate[]; region: string; note?: string };
  /** อ้างเอกสารที่ชำระหลังช่วงของข้อมูลเกินกี่ปีถึงเตือน */
  lateCompilationWarnYears: number;
}

// ---------- แนวทาง claim ต่อ domain (ยังไม่บังคับ) ----------

export interface NamingClaim {
  hasSurname?: boolean;
  givenNamePattern?: string;
  examples?: string[];
}

/** รายชื่อบุคคลที่ปรากฏในเอกสาร — compile เป็น public/content/names.json ให้ตัวสุ่มชื่อใช้ */
export interface NameListClaim {
  kind: 'nameList';
  names: Array<{ name: string; sex?: 'm' | 'f'; where?: string }>;
}

export interface AttireClaim {
  garment?: string;
  hairstyle?: string;
  occasion?: string;
  /** ข้อความภาษาอังกฤษสำหรับประกอบ prompt ภาพ */
  visualDescriptor?: string;
}

export interface VocabClaim {
  terms: Array<{ term: string; meaning: string; register?: 'royal' | 'formal' | 'common' }>;
  conversions?: Record<string, string>;
}
