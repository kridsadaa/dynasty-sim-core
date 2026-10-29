// ============================================================================
// Core Schema — Flat / Normalized State
//
// หลักการ
// 1. State (เซฟลง IndexedDB) แยกขาดจาก Content (JSON read-only ที่ modder แก้ได้)
// 2. Entity อ้างอิงกันด้วย ID เท่านั้น ห้าม nest entity ซ้อน entity
//    (value object เล็กๆ ที่ไม่มีตัวตนแยก เช่น Scar, Percept, Modifier ฝังได้)
// 3. ทุกตารางเป็น Record<Id, T> → 1 ตาราง = 1 object store ใน IndexedDB
// 4. ทุก record ต้อง "อยู่ได้ด้วยตัวเอง" หลัง record ที่อ้างถึงถูก prune
//    (เช่น Memory เก็บ percepts ไว้เอง ไม่ต้องพึ่ง EventInstance)
// ============================================================================

declare const __brand: unique symbol;
export type Brand<T, K extends string> = T & { readonly [__brand]: K };

export type CharacterId = Brand<string, 'Character'>;
export type BodyPartId = Brand<string, 'BodyPart'>;
export type WoundId = Brand<string, 'Wound'>;
export type MemoryId = Brand<string, 'Memory'>;
export type TraitId = Brand<string, 'Trait'>;
export type FamilyNodeId = Brand<string, 'FamilyNode'>;
export type DynastyId = Brand<string, 'Dynasty'>;
export type HouseholdId = Brand<string, 'Household'>;
export type LegendId = Brand<string, 'Legend'>;
export type ItemId = Brand<string, 'Item'>;
export type EventInstanceId = Brand<string, 'EventInstance'>;
export type IntentId = Brand<string, 'Intent'>;

/** Content keys — มาจาก JSON จึงไม่ brand */
export type TagId = `${string}:${string}`; // "food:cucumber", "tool:kitchen_knife"
export type VarRef = `$${string}`;          // "$target_food" — ตัวแปรใน event def
export type PartDefId = string;             // "finger.index.l"
export type EventDefId = string;
export type TraitKindId = string;           // "phobia" | "aversion" | ... (ประกาศใน content)
export type IntentKindId = string;          // "befriend" | "court" (ประกาศใน intents.json)

export type Day = number;    // วันนับจาก epoch ของเกม
export type Unit = number;   // 0..1
export type Signed = number; // -1..1

export type Table<T> = Record<string, T>;

// ============================================================================
// Tag Ontology (content) — DAG ไม่ใช่ tree: มีดทำครัวเป็นทั้ง tool:sharp และ property:bladed
// ============================================================================

export type ClaimSlot = 'instrument' | 'target' | 'place' | 'adversary' | 'era_event';

export interface TagDef {
  id: TagId;
  parents: TagId[];
  label: { th: string; en?: string };
  /** ความสะดุดตา/สะดุดใจต่อสมองเด็ก (สีสด รูปทรงแปลก) → ยิ่งสูงยิ่งถูก "จำผิด" ว่าเป็นต้นเหตุ */
  salience?: Unit;
  /** ความยิ่งใหญ่เมื่อถูกเล่าเป็นตำนาน (-1 น่าอาย .. 1 วีรกรรม) */
  prestige?: Signed;
  /** ปมจิตใจห้าม generalize ขึ้นมาถึง tag นี้ (กลัว food:any = เล่นต่อไม่ได้) */
  generalizeStop?: boolean;
  /** เมื่อตำนานบิดเบือน tag นี้มักกลายเป็นอะไร (มีดทำครัว → ดาบ) */
  narrativeUpgrades?: TagId[];
  /** ถ้า tag นี้โผล่ในเรื่องเล่า ต้องเติม slot อื่นให้เข้าเค้า (ดาบ → ต้องมีคู่ต่อสู้) */
  narrativeImplies?: Partial<Record<ClaimSlot, TagId>>;
  /** id ใน lore/entries — หลักฐานทางประวัติศาสตร์ของสิ่งนี้ (ตรวจโดย npm run lore:check) */
  loreRefs?: string[];
}

// ============================================================================
// Anatomy — Def อยู่ใน content, State เก็บแบบ sparse (เฉพาะอวัยวะที่ "ไม่ปกติ")
// NPC ร่างกายครบ 100% มี bodyPartIds = [] → เซฟเล็กมาก
// ============================================================================

export type CapabilityId =
  | 'manipulation.fine' | 'manipulation.gross' | 'mobility'
  | 'sight' | 'hearing' | 'speech';

export type Visibility = 'face' | 'exposed' | 'covered' | 'internal';

export interface BodyPartDef {
  id: PartDefId;
  parent: PartDefId | null;
  label: { th: string };
  tags: TagId[];
  side?: 'l' | 'r';
  visibility: Visibility;
  vital: boolean;
  /** น้ำหนักในการถูกเลือกเมื่อสุ่มตำแหน่งบาดแผล */
  hitWeight: number;
  /** อวัยวะนี้มีส่วนต่อความสามารถใดเท่าไร (นิ้วชี้ = manipulation.fine 0.15) */
  capabilities: Partial<Record<CapabilityId, number>>;
}

export interface AnatomyTemplate {
  id: string;
  root: PartDefId;
  parts: Record<PartDefId, BodyPartDef>;
}

export type StatKey = CapabilityId | 'stress' | `skill:${string}` | `social:${string}`;

export interface Modifier {
  stat: StatKey;
  op: 'add' | 'mul';
  value: number;
  /** มีผลเฉพาะเมื่อ context ของเหตุการณ์มี tag เหล่านี้ (แผลหน้า → น่าเกรงขามเฉพาะ situation:combat) */
  when?: TagId[];
}

export type WoundKind = 'cut' | 'stab' | 'burn' | 'blunt' | 'fracture' | 'bite';
export type WoundStage = 'bleeding' | 'open' | 'infected' | 'festering' | 'healing';

/** แผลสด — entity ชั่วคราว ถูกลบเมื่อหาย แล้วทิ้งร่องรอยเป็น Scar / integrity ที่ลดลง */
export interface Wound {
  id: WoundId;
  characterId: CharacterId;
  partDefId: PartDefId;
  kind: WoundKind;
  severity: Unit;
  stage: WoundStage;
  inflictedDay: Day;
  stageSinceDay: Day;
  treatment: { quality: Unit; by: CharacterId | null; remedy: TagId | null } | null;
  complications: Array<'infected' | 'festered'>;
  sourceEventId: EventInstanceId | null;
  memoryId: MemoryId | null;
}

/** value object — ร่องรอยถาวร */
export interface Scar {
  kind: WoundKind | 'stump';
  severity: Unit;
  acquiredDay: Day;
  ageAtTime: number;
  originMemoryId: MemoryId | null;
  modifiers: Modifier[];
}

/** สถานะอวัยวะ (sparse) — id = `${characterId}/${partDefId}` เพื่อ lookup ได้โดยไม่ต้องมี index */
export interface BodyPart {
  id: BodyPartId;
  characterId: CharacterId;
  partDefId: PartDefId;
  integrity: Unit; // 1 = ปกติ, 0 = ใช้การไม่ได้
  status: 'intact' | 'impaired' | 'missing' | 'prosthetic';
  scars: Scar[];
}

export interface ScarRule {
  match: { kind?: Array<Scar['kind']>; visibility?: Visibility[]; partTag?: TagId; minSeverity?: Unit };
  modifiers: Modifier[];
}

// ============================================================================
// Character
// ============================================================================

export type Estate =
  | 'royal' | 'noble' | 'phrai_luang' | 'phrai_som' | 'that'
  | 'monk' | 'merchant' | 'foreigner';

export interface Personality {
  neuroticism: Unit;   // หวั่นไหว — ฝังใจง่าย, ปมลามกว้าง
  imagination: Unit;   // จินตนาการ — สมองเชื่อมโยงผิดๆ (misattribution) ง่าย
  boldness: Unit;      // ใจกล้า — แปลงความกลัวเป็นความหมกมุ่น (counter-phobic)
  agreeableness: Unit; // ว่านอนสอนง่าย — ซึมซับปมพ่อแม่ง่าย
  piety: Unit;         // ศรัทธา/ถือโชคลาง — ตีความเหตุร้ายเป็นลาง
  pride: Unit;         // ทะนงตัว — ชอบเสริมแต่งตำนานตระกูล
  resilience: Unit;    // ใจฟื้นเร็ว
}

export interface Character {
  id: CharacterId;
  familyNodeId: FamilyNodeId;
  dynastyId: DynastyId | null;
  householdId: HouseholdId | null;
  name: string;
  sex: 'm' | 'f';
  handedness: 'l' | 'r';
  birthDay: Day;
  deathDay: Day | null;
  deathCause: TagId | null;

  anatomyId: string;
  bodyPartIds: BodyPartId[]; // sparse
  woundIds: WoundId[];
  memoryIds: MemoryId[];
  traitIds: TraitId[];
  caregiverIds: CharacterId[]; // ผู้เลี้ยงดูจริง (แม่นม พี่เลี้ยง) — ช่องทาง social learning

  personality: Personality;
  skills: Record<string, number>; // 0..100
  stress: Unit;
  merit: number; // บุญ-บาปสะสม

  social: {
    estate: Estate;
    sakdina: number;
    title: string | null;          // บรรดาศักดิ์ — ไม่สืบทอดอัตโนมัติ
    patronId: CharacterId | null;  // มูลนาย
    wealth: number;                // เงินสด (ตำลึง)
    debt: number;
  };
  horoscope: { weekday: number; yearAnimal: number; omenTags: TagId[] };

  /** Level-of-detail: NPC ไกลตัวเก็บเฉพาะความทรงจำฝังใจ */
  lod: 'full' | 'light';

  /** วันแต่งงาน — นับปีสำหรับการมีบุตรและการแยกเรือน (optional: เซฟเก่าไม่มี) */
  marriedDay?: Day;
  /** วันที่คู่นี้จะแยกเรือนออกจากบ้านพ่อแม่ (ยกเว้นลูกที่อยู่ดูแลพ่อแม่) */
  moveOutDay?: Day;
  /**
   * คนนอกตระกูลที่ผู้เล่นรู้จัก (เพื่อนบ้าน คนต่างตำบล) — ไม่มีเรือน/ตระกูลในฉาก ครอบครัวของเขาไม่ได้จำลอง
   * wed: ออกเรือนไปกับคนนอกฉากแล้ว · หายไปเมื่อแต่งเข้าตระกูลผู้เล่น
   */
  local?: { distance: Distance; trade: string; wed?: true };
}

/** ระยะจากเรือนของผู้เล่น — กำหนดว่าความตั้งใจต่อคนนี้กินแรงงานที่บ้านแค่ไหน */
export type Distance = 'near' | 'town' | 'far';

// ============================================================================
// Memory — ความทรงจำเชิงเหตุผล (causal) แยก "สิ่งที่รับรู้" ออกจาก "สิ่งที่โทษ"
// ============================================================================

export type PerceptRole =
  | 'instrument' | 'agent' | 'target' | 'place' | 'environment' | 'witness' | 'sensation';

export interface Percept {
  tag: TagId;
  role: PerceptRole;
  salience: Unit;
  entityId?: CharacterId; // ถ้า percept เป็นคน (แม่ที่กรีดร้อง)
}

export interface Memory {
  id: MemoryId;
  ownerId: CharacterId;
  eventInstanceId: EventInstanceId | null; // อาจเป็น null หลัง prune event log
  eventDefId: EventDefId;
  day: Day;
  ageAtTime: number;
  valence: Signed;
  intensity: Unit;
  /** สิ่งที่เกิดขึ้น "จริง" ในมุมรับรู้ของตัวละคร */
  percepts: Percept[];
  /** สิ่งที่สมอง "โทษ" ว่าเป็นต้นเหตุ — กระจายน้ำหนัก, อาจผิด */
  attribution: Array<{ tag: TagId; role: PerceptRole; weight: Unit }>;
  fidelity: Unit;   // ลดตามเวลา; ใช้ตอนสร้างตำนาน/เล่าซ้ำ
  rehearsals: number;
  formative: boolean;
  notability: Unit; // ความน่าเล่าขาน → seed ของ Legend
  woundIds: WoundId[];
  spawnedTraitIds: TraitId[];
}

// ============================================================================
// Trait — Parameterized: Kind(target). ไม่มี trait hardcode
// "กลัวแตงกวา" = { kind: 'phobia', target: 'food:cucumber' }
// ============================================================================

export interface TraitKindDef {
  id: TraitKindId;
  label: { th: string };
  /** score = bias + Σ weight×personality (+ misattributionBias ถ้าปมมาจากการจำผิด) → softmax */
  bias: number;
  personalityWeights: Partial<Record<keyof Personality, number>>;
  misattributionBias?: number;
  /** แนวโน้มลามขึ้น ontology (phobia สูง, obsession ต่ำ) */
  generalize: Unit;
  /** โอกาสส่งต่อทางการเลี้ยงดู และความ "เห็นชัด" ต่อคนรอบตัว */
  heritability: Unit;
  visibility: Unit;
  /** หัวหน้าเรือนที่มีปมนี้แรงพอจะตั้งกฎในเรือน */
  imposesRule?: 'ban' | 'ritual';
  /** เมื่อส่งต่อรุ่นลูก kind อาจกลายพันธุ์เป็นอะไร */
  mutatesTo?: TraitKindId[];
}

export type TraitOrigin =
  | { type: 'experience'; memoryId: MemoryId }
  | { type: 'social'; fromNodeId: FamilyNodeId; fromKind: TraitKindId; fromTarget: TagId | null }
  | { type: 'taboo'; dynastyId: DynastyId; tabooId: string }
  | { type: 'innate'; source: 'horoscope' | 'temperament' };

export interface Trait {
  id: TraitId;
  ownerId: CharacterId;
  kind: TraitKindId;
  target: TagId | null;
  intensity: Unit;
  /** ฝังใต้สำนึก ยังไม่แสดงอาการ — "ตื่น" เมื่อเจอ trigger ครั้งแรก */
  latent: boolean;
  awareness: 'knows_cause' | 'misremembers' | 'unknown';
  origin: TraitOrigin;
  acquiredDay: Day;
  lastTriggeredDay: Day | null;
  triggerCount: number;
}

export type Phobia = Trait & { kind: 'phobia'; target: TagId };

// ============================================================================
// Household — หน่วยที่ "ปมกลายเป็นกฎ" (พ่อกลัวแตงกวา → ห้ามมีแตงกวาในเรือน)
// ============================================================================

export interface HouseholdRule {
  id: string;
  kind: 'ban' | 'ritual';
  target: TagId;
  sinceDay: Day;
  imposedBy: CharacterId;
  originTraitId: TraitId | null;
  /** เหตุผลที่ "บอกต่อ" — มักไม่ใช่เหตุผลจริง */
  statedReason: 'true_cause' | 'false_cause' | 'inauspicious';
}

export interface Household {
  id: HouseholdId;
  headId: CharacterId;
  memberIds: CharacterId[];
  dynastyId: DynastyId | null;
  rules: HouseholdRule[];
}

// ============================================================================
// Family / Dynasty — FamilyNode อยู่รอดหลัง Character ถูก prune (เหลือแค่ชื่อในผังตระกูล)
// ============================================================================

/** สถานะของแม่ มีผลต่อส่วนแบ่งมรดก (ตามแนวกฎหมายลักษณะมรดก — ปรับน้ำหนักใน content) */
export type Parentage = 'principal_wife' | 'minor_wife' | 'slave_wife' | 'adopted' | 'unknown';

export interface FamilyNode {
  id: FamilyNodeId;
  characterId: CharacterId | null; // null = pruned
  dynastyId: DynastyId | null;
  name: string;
  sex: 'm' | 'f';
  birthYear: number;
  deathYear: number | null;
  fatherId: FamilyNodeId | null;
  motherId: FamilyNodeId | null;
  spouseIds: FamilyNodeId[];
  childIds: FamilyNodeId[];
  parentage: Parentage;
  generation: number;
  /** snapshot ตอนตาย — ข้อมูลขั้นต่ำที่ยังต้องใช้หลัง Character ถูกลบ */
  summary: {
    estate: Estate;
    title: string | null;
    notableTraits: Array<{ kind: TraitKindId; target: TagId | null }>;
    scars: Array<{ partDefId: PartDefId; kind: Scar['kind'] }>;
    causeOfDeath: TagId | null;
  } | null;
  legendIds: LegendId[];
  pruneLevel: 0 | 1; // 0 = มี Character เต็ม, 1 = เหลือ node อย่างเดียว
}

export interface FamilyTaboo {
  id: string;
  kind: 'ban' | 'ritual';
  target: TagId;
  strength: Unit;
  originNodeId: FamilyNodeId;
  /** รุ่นปัจจุบันยังรู้ต้นเหตุจริงไหม */
  originKnown: boolean;
  sinceGeneration: number;
}

/** สายรองที่ถูกยุบเหลือบรรทัดเดียว */
export interface BranchSummary {
  rootNodeId: FamilyNodeId;
  label: string;
  memberCount: number;
  generations: number;
}

export interface Dynasty {
  id: DynastyId;
  name: string;
  founderNodeId: FamilyNodeId;
  headNodeId: FamilyNodeId;
  prestige: number;
  karma: number;
  faction: string | null; // ฝักฝ่ายในราชสำนัก — เป้าของการริบราชบาดาลตอนผลัดแผ่นดิน
  taboos: FamilyTaboo[];
  legendIds: LegendId[];
  branchSummaries: BranchSummary[];
}

// ============================================================================
// Legend — Unreliable family history: เก็บ truth (แช่แข็ง) คู่กับ current (บิดเบือนได้)
// ทั้งคู่เป็นโครงสร้าง slot ไม่ใช่ข้อความ → render ด้วย template, drift ด้วย ontology
// ============================================================================

export interface Claim {
  template: string; // key ใน content.claimTemplates
  subjectNodeId: FamilyNodeId;
  slots: Partial<Record<ClaimSlot, TagId>>;
  magnitude: number; // 1 = ตามจริง, 7 = "ฟันข้าศึกเจ็ดคน"
  heroism: Signed;
  supernatural: TagId[];
  year: number;
}

export interface Legend {
  id: LegendId;
  dynastyId: DynastyId;
  truth: Claim;
  current: Claim;
  generationsRetold: number;
  divergence: Unit;
  writtenRecord: boolean; // จดลงสมุดข่อยแล้ว → บิดเบือนช้าลง
  physicalEvidence: { partDefId: PartDefId; kind: Scar['kind'] } | null;
}

// ============================================================================
// Items / Relations
// ============================================================================

export interface Item {
  id: ItemId;
  tag: TagId;
  kind: 'land' | 'house' | 'gold' | 'heirloom' | 'manual';
  value: number;
  ownerCharacterId: CharacterId | null;
  ownerDynastyId: DynastyId | null;
  condition: Unit;
  hidden: boolean; // ฝังดิน/ซ่อน — รอดจากการปล้นตอนเสียกรุง
  teaches?: { skill: string; learnBonus: number }; // ตำราประจำตระกูล
}

/**
 * affection / awe คือความรู้สึกของ from ที่มีต่อ to (ส่วนใหญ่ลูก → พ่อแม่) — ดู systems/will.ts
 *  affection: รัก/ผูกพัน (-1 เกลียดชัง .. 1 รักมาก), awe: เกรง/ยำเกรง (0..1)
 *  acquaintance: from รู้จัก to แค่ไหน (0 แค่เคยเห็นหน้า .. 1 สนิท) — "คนที่รู้จัก" ของผู้เล่น
 */
export type RelationKind =
  | 'caregiver' | 'spouse' | 'patron' | 'friend' | 'rival' | 'gratitude' | 'grudge' | 'affection' | 'awe' | 'acquaintance';

export interface Relation {
  id: string;
  from: CharacterId;
  to: CharacterId;
  kind: RelationKind;
  strength: Signed;
  sinceDay: Day;
}

// ============================================================================
// Events
// ============================================================================

export interface RoleFilter {
  ageRange?: [number, number];
  relationToActor?: RelationKind | 'parent';
}

export interface PerceptTemplate {
  tag: TagId | VarRef;
  role: PerceptRole;
  salience: Unit;
  /** ผูก percept กับคนที่เล่น role นี้ (เช่น 'caregiver' → พยาน) */
  bindRole?: string;
}

export interface PartSelector {
  tag: TagId;
  side?: 'dominant' | 'nondominant' | 'any';
}

export type Condition =
  | { type: 'age'; min?: number; max?: number }
  | { type: 'capability'; capability: CapabilityId; min: Unit }
  | { type: 'estate'; in: Estate[] }
  /** มีคนผูกกับ role นี้ใน event (เช่น ยังมีคู่ครอง/พ่อแม่ที่มีชีวิต) */
  | { type: 'hasRole'; role: string };

export type Effect =
  | {
      op: 'wound'; role: string; part: PartSelector; kind: WoundKind;
      severity: [number, number]; treatedByRole?: string; treatmentQuality?: Unit;
    }
  | {
      op: 'trauma'; role: string; baseImpact: Unit;
      comfortRole?: string;
      /** ความตื่นตระหนกของพยาน = neuroticism ของคนใน role นี้ × witnessPanic */
      panicRole?: string; witnessPanic?: Unit;
    }
  | { op: 'stress'; role: string; delta: number }
  /** ความรู้สึกของ role ที่มีต่อ toward เปลี่ยน — ส่วนที่ติดลบ (ถูกดุ) แรงขึ้นตามความดุของ toward */
  | { op: 'bond'; role: string; toward: string; affection?: number; awe?: number }
  /** ต่อด้วย event ถัดไปทันที (ใช้ role/ตัวแปรชุดเดิม) ด้วยโอกาส chance */
  | { op: 'followUp'; event: EventDefId; chance: Unit }
  /** ตั้งชื่อคนใน role: input = ชื่อที่ผู้เล่นพิมพ์ (ไม่ส่งมา = ใช้ชื่อเดิม), pick = สุ่มจากคลังชื่อใหม่ */
  | { op: 'name'; role: string; by: 'input' | 'pick' }
  | { op: 'merit'; role: string; delta: number }
  /** ความตั้งใจที่ role กำลังทำอยู่: เดินหน้า/ถอยหลัง (progress) และโอกาสสำเร็จ (odds) */
  | { op: 'intent'; role: string; progress?: number; odds?: number }
  /** ความสัมพันธ์ของ role ต่อ toward: delta บวกเข้าค่าเดิม, atLeast ยกขึ้นอย่างน้อยเท่านี้ */
  | { op: 'relation'; role: string; toward: string; kind: RelationKind; delta?: number; atLeast?: number }
  /** role แต่งงานกับ with — ที่อยู่หลังแต่งตามธรรมเนียม (ดู wed ใน world.ts) */
  | { op: 'marry'; role: string; with: string }
  | { op: 'skill'; role: string; skill: string; delta: number }
  | { op: 'prestige'; role: string; delta: number };

/**
 * แรงต้านในใจตัวละครต่อตัวเลือก — บวกกันทุกข้อ (เฉพาะส่วนที่เป็นบวก)
 * ค่า ≥ will.strainAt: เลือกได้แต่ฝืนใจ (เครียด) · ≥ will.lockAt: ล็อก พร้อมบอกเหตุผล
 *  bond: ความรู้สึกที่มีต่อคนใน role (weight ติดลบ = ยิ่งเกลียดยิ่งต้าน)
 *  personality: invert = ใช้ (1 − ค่า) เช่น boldness ต่ำ → ขี้อาย
 */
export type Resist =
  | { source: 'bond'; role: string; axis: 'affection' | 'awe'; weight: number; reasonKey: string }
  | { source: 'personality'; trait: keyof Personality; invert?: boolean; weight: number; reasonKey: string };

export interface EventOption {
  id: string;
  textKey: string;
  tags?: Array<TagId | VarRef>;
  conditions?: Condition[];
  resist?: Resist[];
  /** 'name' = ผู้เล่นพิมพ์ชื่อเอง — UI ถามชื่อก่อนส่งตัวเลือกนี้ */
  input?: 'name';
  effects: Effect[];
  /** ตัวเลือกที่ระบบ inject เข้ามา (ไม่ได้อยู่ใน def) */
  injectedBy?: string;
  params?: Record<string, string>;
}

export interface GameEventDef {
  id: EventDefId;
  textKey: string;
  contextTags: Array<TagId | VarRef>;
  variables?: Record<string, { oneOf: TagId[] }>;
  roles: Record<string, RoleFilter>;
  /** weight 0 = ไม่สุ่มขึ้นเอง เกิดได้เฉพาะเป็น followUp ของ event อื่น */
  trigger: { ageRange?: [number, number]; estates?: Estate[]; weight: number; cooldownDays?: number };
  percepts: PerceptTemplate[];
  options: EventOption[];
}

/** Rule ที่ match ปม/ร่างกาย กับ context แล้ว inject ผลลัพธ์ — global, ไม่ผูกกับ event ใด */
export type InjectionMatch =
  | { type: 'trait'; kind: TraitKindId; minStrength: Unit }
  | { type: 'scar'; visibility: Visibility[]; minSeverity?: Unit }
  | { type: 'capability'; capability: CapabilityId; below: Unit };

export interface InjectionRule {
  id: string;
  match: InjectionMatch;
  requireContext?: TagId[];
  addOptions?: EventOption[];
  /** ล็อกตัวเลือกที่มี tag ตรงกับ target ของปม (กลัวของมีคม → ล็อก "ช่วยหั่นผัก") */
  lockOptionsMatchingTarget?: boolean;
  appendEffects?: Effect[];
}

export interface EventInstance {
  id: EventInstanceId;
  defId: EventDefId;
  day: Day;
  bindings: Record<string, CharacterId>;
  vars: Record<string, TagId>;
  resolvedTags: TagId[];
  optionId: string | null;
  injectedRuleIds: string[];
}

// ============================================================================
// Intent — ความตั้งใจระยะยาวต่อคนหนึ่งคน (ผูกมิตร เกี้ยว) ไม่ใช่การกระทำเล็กๆ ทีละครั้ง
// เลือกวิธีแล้วชีวิตประจำวันเปลี่ยน: ไปช่วยงานบ้านเขา = แรงงานหายจากเรือนตัวเองตามระยะทาง
// ครบเวลา → ทอยโอกาส → event สำเร็จ/ไม่สำเร็จ; ระหว่างทางมี event แทรก
// ============================================================================

export interface Intent {
  id: IntentId;
  kind: IntentKindId;
  approach: string;
  actorId: CharacterId;
  targetId: CharacterId;
  startDay: Day;
  /** 0..1 — เดินเดือนละ 1/months ครบ 1 แล้วทอยผล */
  progress: Unit;
  /** จำนวนเดือนที่ประเมินไว้ตอนเริ่ม */
  months: number;
  /** โอกาสที่ได้/เสียจาก event ระหว่างทาง */
  bonus: number;
}

export interface IntentApproachDef {
  id: string;
  textKey: string;
  /** ตามระยะทาง: labor = สัดส่วนแรงงานที่หายจากเรือน (1 = ไปอยู่ที่นั่นเลย), months = เวลาฐาน; null = ทำแบบนี้ไม่ได้ */
  by: Record<Distance, { labor: Unit; months: number } | null>;
  /** บวกโอกาสสำเร็จ */
  odds: number;
  /** ค่าใช้จ่ายครั้งเดียวตอนเริ่ม (ตำลึง) */
  cost?: number;
  minAge?: number;
  /** ต้องมีพ่อหรือแม่ที่ยังมีชีวิตไปพูดให้ — ฐานะของบ้านเรามีผลมาก รู้จักกันมาก่อนมีผลน้อย */
  formal?: boolean;
  /** ระหว่างไปช่วยงานได้ทักษะอาชีพของบ้านเขา เดือนละเท่านี้ × แรงงานที่ไป */
  learnTrade?: number;
}

export interface IntentDef {
  id: IntentKindId;
  textKey: string;
  /** befriend: ใครก็ได้ที่ยังไม่สนิท · court: ต่างเพศ ยังไม่มีคู่ ทั้งสองฝ่ายถึงวัย */
  target: 'befriend' | 'court';
  minAge: number;
  baseOdds: number;
  approaches: IntentApproachDef[];
  /** event ที่เปิดเมื่อครบเวลา — bindings: actor, target, elder (ถ้ามี) */
  success: EventDefId;
  failure: EventDefId;
  /** event แทรกระหว่างทาง (สุ่มเดือนละ balance.intent.midEventChance) */
  midEvents: Array<{ event: EventDefId; approaches?: string[]; needsElder?: boolean; minLabor?: number; maxAge?: number }>;
}

/** บ้านของคนนอกตระกูล — อาชีพกำหนดฐานะและทักษะที่ได้เมื่อไปช่วยงาน */
export interface TradeDef {
  id: string;
  label: { th: string };
  estate: Estate;
  skill: string;
  weight: number;
}

// ============================================================================
// History (Anti-snowball shocks)
// ============================================================================

export interface HistoricalEvent {
  tag: TagId;
  year: number;
  kind: 'war' | 'plague' | 'succession' | 'famine';
  shock: {
    /** สัดส่วนทรัพย์ที่ไม่ได้ซ่อนซึ่งสูญเสีย */
    wealthLoss: [Unit, Unit];
    deathRisk: Unit;
    /** ฝักฝ่ายที่โดนริบราชบาดาล */
    purgeFactions?: string[];
  };
}

// ============================================================================
// Balance (ทุกค่าปรับใน JSON ได้)
// ============================================================================

export interface Balance {
  epochYear: number;
  daysPerYear: number;
  trauma: {
    memoryThreshold: Unit;
    formativeThreshold: Unit;
    traitThreshold: Unit;
    secondTraitThreshold: Unit;
    causalWeight: Record<PerceptRole, number>;
    maxGeneralizeSteps: number;
    comfortFactor: Unit;
    /** โอกาสที่ปม "เพี้ยน" (โทษสิ่งที่ไม่ใช่ต้นเหตุ เช่น ฟักทอง) จะฝังจริง — ที่เหลือฝังกับต้นเหตุจริงแทน */
    misattributionKeep: Unit;
  };
  will: {
    strainAt: Unit;
    lockAt: Unit;
    /** ความเครียดที่เพิ่มต่อแรงต้าน 1.0 เมื่อฝืนใจเลือก */
    stressPerResist: number;
  };
  bond: {
    /** ค่าเริ่มต้นของลูกต่อพ่อแม่ — awe = aweBase + aweFromHarshness × (1 − agreeableness ของพ่อแม่) */
    affection: Signed;
    aweBase: Unit;
    aweFromHarshness: Unit;
  };
  wound: {
    infection: Record<WoundKind, Unit>;
    scarChance: Record<WoundKind, Unit>;
    healDaysBase: number;
    healDaysPerSeverity: number;
    rainySeason: [number, number]; // day-of-year
    festerLossChance: Unit;
  };
  social: {
    ruleThreshold: Unit;
    transmitBase: Unit;
    ruleTransmitBase: Unit;
    targetDriftChance: Unit;
    kindMutateChance: Unit;
    susceptibleAge: [number, number];
    /** ผู้ใหญ่ขู่เด็กด้วยผี (lore: psyche.frightening_children_with_ghosts) */
    ghostScareBase: Unit;
    ghostScareMaxAge: number;
  };
  legend: {
    baseDrift: number;
    writtenRecordDamp: Unit;
    maxOpsPerGeneration: number;
  };
  inheritance: {
    shareByParentage: Record<Parentage, number>;
    mainHeirBonus: number;
    funeralCostRate: Record<Estate, Unit>;
    funeralPrestigePerTamlueng: number;
    prestigeDecay: Unit;
    relationCarry: Partial<Record<RelationKind, Unit>>;
    tabooMinYears: number;
    tabooDecay: Unit;
    tabooForgetBelow: Unit;
    tabooMutateChance: Unit;
  };
  world: {
    eventsPerYear: number;
    oldAgeStart: number;
    oldAgeYearlyRisk: number; // ต่อปีที่เกิน oldAgeStart
    marriageAge: number;
    marriageAgeFemale: number;
    /** มีบุตรเมื่อแต่งงานได้กี่ปี */
    childAfterMarriageYears: number[];
    /** โอกาสที่ลูกของผู้เล่นพาหลานมาให้ผู้เล่นตั้งชื่อ */
    grandchildNamingChance: Unit;
    /** อยู่บ้านพ่อแม่ (ฝ่ายหญิงหรือฝ่ายชาย) กี่ปีก่อนแยกเรือน (lore: kinship.uxorilocal_then_neolocal_1680s) */
    stayYears: [number, number];
    /** โอกาสที่ลูกชายพาภรรยามาอยู่บ้านพ่อแม่ตัวเอง แทนไปอยู่บ้านฝ่ายหญิง (lore: kinship.residence_mixed_census) */
    patrilocalChance: Unit;
    /** เด็กชายไปเป็นเณรเรียนหนังสือที่วัด (lore: ritual.novice_schooling_1680s) */
    noviceAge: number;
    noviceChance: Unit;
  };
  intent: {
    /** ต่อเดือน: โอกาสมี event แทรก */
    midEventChance: Unit;
    /** ค่าแรงที่เรือนต้องจ้างคนแทนเดือนละเท่าไร (ตำลึง) เมื่อแรงงาน 1 คนหายไปทั้งเดือน ตามฐานะของเรือน */
    laborValue: Record<Estate, number>;
    /** ไม่อยู่ช่วยงานบ้าน → ความรักต่อพ่อแม่ในเรือนเดียวกันลดเดือนละเท่านี้ × แรงงานที่หาย (พ่อแม่บ่น) */
    awayAffectionPerMonth: number;
    /** รู้จักกันมากขึ้นเดือนละ × (0.5 + แรงงานที่ไปอยู่ด้วย) */
    familiarityPerMonth: number;
    estateGapPenalty: number;
    oddsRange: [Unit, Unit];
    /** ความตั้งใจที่ต้องใช้แรงงานเต็มตัว (ย้ายไปอยู่ใกล้เขา) ทำได้ตั้งแต่อายุเท่านี้ */
    relocateMinAge: number;
    /** ผู้ใหญ่ทาบทามคู่ให้ผู้เล่นที่ยังไม่แต่งงาน ไม่เกินอายุนี้ และเว้นกี่ปีหลังปฏิเสธ */
    arrangedMaxAge: number;
    arrangedEveryYears: number;
  };
  locals: {
    /** เริ่มรู้จักคนนอกบ้านตั้งแต่อายุ */
    startAge: number;
    /** จำนวนคนรู้จักนอกตระกูลสูงสุด: ตอนเด็ก (< 14) / ตอนโต */
    maxKnown: [number, number];
    /** เต็มแล้ว: โอกาสต่อปีที่คนที่ไม่ค่อยสนิทจะห่างหายไป (เปิดที่ให้คนใหม่) */
    fadeChance: Unit;
    /** คนรู้จักที่ยังไม่มีคู่ แต่งงานไปกับคนนอกฉาก ต่อปี */
    wedChance: Unit;
    distanceWeights: Record<Distance, number>;
    /** ผู้เล่นวัยหนุ่มสาวที่ยังไม่มีคู่ รู้จักคนต่างเพศมากกว่า */
    oppositeSexWhenSingle: Unit;
  };
  prune: {
    keepKinDistance: number;
    eventLogMaxAgeDays: number;
    lightMemoryKeep: number;
  };
}

/** generated จาก lore/ โดย npm run lore:compile */
export interface NamePool {
  generatedFrom: string[];
  /** invented: ชื่อที่ไม่มีเอกสารอ้าง (lore status 'invented') — ตัวสุ่มใช้รองจากชื่อที่มีหลักฐาน */
  names: Array<{ name: string; sex: 'm' | 'f' | null; estates: Estate[] | null; loreRef: string; invented?: true }>;
}

export interface ContentDB {
  names: NamePool;
  tags: Record<TagId, TagDef>;
  anatomies: Record<string, AnatomyTemplate>;
  scarRules: ScarRule[];
  traitKinds: Record<TraitKindId, TraitKindDef>;
  events: Record<EventDefId, GameEventDef>;
  injectionRules: InjectionRule[];
  claimTemplates: Record<string, ClaimTemplate>;
  history: HistoricalEvent[];
  intents: Record<IntentKindId, IntentDef>;
  trades: TradeDef[];
  balance: Balance;
}

export interface ClaimTemplate {
  base: string; // "{subject}ได้แผลเป็นที่{part}"
  fragments: Partial<Record<ClaimSlot | 'magnitude' | 'supernatural', string>>;
  order: Array<ClaimSlot | 'supernatural'>;
}

// ============================================================================
// GameState — root ที่เซฟลง IndexedDB (1 key = 1 object store)
// ============================================================================

export interface GameState {
  meta: {
    schemaVersion: number;
    seed: number;
    rngState: number;
    day: Day;
    nextSerial: number;
    playerCharacterId: CharacterId;
    playerDynastyId: DynastyId;
    /** ชื่อที่ผู้เล่นพิมพ์ตั้งเองในเซฟนี้ — เข้าตัวสุ่มชื่อของ NPC ที่เกิดทีหลังด้วย (optional: เซฟเก่าไม่มี) */
    customNames?: Array<{ name: string; sex: 'm' | 'f' }>;
  };
  characters: Table<Character>;
  bodyParts: Table<BodyPart>;
  wounds: Table<Wound>;
  memories: Table<Memory>;
  traits: Table<Trait>;
  households: Table<Household>;
  familyNodes: Table<FamilyNode>;
  dynasties: Table<Dynasty>;
  legends: Table<Legend>;
  items: Table<Item>;
  relations: Table<Relation>;
  eventLog: Table<EventInstance>;
  /** ความตั้งใจที่กำลังทำ (ตอนนี้มีแต่ของผู้เล่น คนละไม่เกิน 1) — เซฟเก่าไม่มีตารางนี้ โหลดแล้วได้ {} */
  intents: Table<Intent>;
}
