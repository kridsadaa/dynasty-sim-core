import type { Estate, TagId } from '../core/types';

// ============================================================================
// Lore Base — คลังข้อมูลประวัติศาสตร์ที่มีแหล่งอ้างอิง
// ไม่ถูกโหลดเข้าเกมตอนรัน: เป็น "แหล่งความจริง" ที่ content (public/content) อ้างถึงผ่าน loreRefs
// และเป็นฐานของ style bible / visual bible
// ปี = พ.ศ. ทั้งหมด
// ============================================================================

export type YearRange = [number, number];

export interface Source {
  id: string; // "src.<slug>"
  title: string;
  author?: string;
  kind: 'primary' | 'secondary' | 'visual';
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

export type LoreDomain = 'event' | 'social' | 'naming' | 'vocab' | 'belief' | 'material' | 'attire' | 'place';

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
  status: 'attested' | 'inferred' | 'invented';
  /** บังคับเมื่อ status = 'invented' */
  rationale?: string;
  citations: Citation[];
  /** มีคนเปิดเอกสารจริงตรวจแล้ว */
  verified: boolean;
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
  currentSlice: { label: string; period: YearRange; estates: Estate[]; region: string };
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
