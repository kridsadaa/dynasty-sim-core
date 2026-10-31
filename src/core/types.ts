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
  /** pox = รอยไข้ทรพิษ (ไม่ได้มาจากบาดแผล) */
  kind: WoundKind | 'stump' | 'pox';
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
  /**
   * ร่างกายแต่กำเนิด (ซ่อน ผู้เล่นไม่เห็นตัวเลข): ค่ามาตรฐาน กลาง 0 ส่วนเบี่ยงเบน 1 — ต่ำ = ขี้โรค สูง = แข็งแรง
   * ได้จากพ่อแม่บางส่วน ปรับความเสี่ยงตายรายปี (systems/mortality.ts) ไม่มี = 0 (เซฟเก่า)
   */
  constitution?: number;
  /** เคยถูกทักว่าเลี้ยงยากแล้ว — event ขึ้นครั้งเดียว (lore: psyche.hard_to_raise_child) */
  hardToRaise?: true;
  /** เคยเป็นไข้ทรพิษแล้วรอด — ไม่เป็นซ้ำ (lore: health.smallpox_endemic) */
  hadSmallpox?: boolean;
  /** ก่อนวันนี้ไม่ตายด้วยโรค/ความชรา/โรคระบาด — ใช้กับตัวละครแรกของผู้เล่น (ความสะดวกของเกม ไม่ใช่ประวัติศาสตร์) */
  deathGraceUntil?: Day;
  /** วันที่คู่นี้จะแยกเรือนออกจากบ้านพ่อแม่ (ยกเว้นลูกที่อยู่ดูแลพ่อแม่) */
  moveOutDay?: Day;
  /**
   * คนนอกตระกูลที่ผู้เล่นรู้จัก (เพื่อนบ้าน คนต่างตำบล) — ไม่มีเรือน/ตระกูลในฉาก ครอบครัวของเขาไม่ได้จำลอง
   * wed: ออกเรือนไปกับคนนอกฉากแล้ว · หายไปเมื่อแต่งเข้าตระกูลผู้เล่น
   */
  local?: { distance: Distance; trade: string; wed?: true };

  // ---- ขั้นตอนแต่งงานที่ค้างอยู่ (ดู systems/marriage.ts) — มีแต่ของผู้เล่น ----
  /** หมั้นแล้ว (ขันหมากสามขัน) รอยกขันหมากใหญ่ไปแต่งตามวันนัด — ผิดนัดเสียขันหมาก (lore: kinship.betrothal_khanmak_three_seals) */
  betrothal?: { toId: CharacterId; weddingDay: Day; sinsot: number; called?: true };
  /** ไปช่วยงานบ้านพ่อตาแม่ยายชดใช้สินสอด/ค่าน้ำนมที่จ่ายไม่ครบ */
  service?: { hostId: CharacterId; untilDay: Day; labor: Unit };
  /**
   * พาลูกสาวเขาหนีมาอยู่ด้วยกัน — ตามตัวบทยังไม่เป็นผัวเมีย (ลักษณผัวเมีย ม.123–135) จนพ่อแม่ฝ่ายหญิงตามมา (dueDay)
   * แล้วจ่ายค่าน้ำนมค่าเลี้ยงดู + ค่าปรับ (amount) แต่งตามประเพณี หรือส่งตัวคืน (lore: kinship.elopement_three_seals)
   */
  eloped?: { withId: CharacterId; sinceDay: Day; amount: number; dueDay: Day; called?: true };
  /**
   * ตำแหน่งราชการ (ดู systems/career.ts) — ชื่อตำแหน่งจริงอยู่ใน social.title, ศักดินาใน social.sakdina
   * favor: ความโปรดปรานของเจ้ากรม/ในหลวง (-1..1) ขึ้นจากงาน ลงจากความผิดและการถูกฟ้อง ค่อยๆ คลายกลับหา 0
   * name: ราชทินนามที่ได้ (ใช้ซ้ำตอนเลื่อนจากหมื่นเป็นขุนชื่อเดียวกัน)
   */
  office?: { postId: string; name?: string; sinceDay: Day; favor: Signed };
  /**
   * งานบ้านต่อหมวด (ดู systems/chores.ts): joined = เคยตกลงเข้าไปช่วยแล้ว (ครั้งต่อไปไม่ถามซ้ำ ข้ามไปหัดขั้นใหม่),
   * tasks = ขั้นที่หัดได้แล้ว, askAfter = ไม่ยอมช่วย — จะถูกเรียกอีกหลังวันนี้
   */
  chores?: Record<string, { joined: boolean; tasks: string[]; askAfter?: Day }>;
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
    /** บุญตอนตาย รวมบุญจากงานศพ (เซฟเก่าไม่มี) */
    merit?: number;
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
  /** รุ่นของทายาทใน handover ล่าสุดที่เล่าตำนานต่อ/ข้อห้ามเสื่อมแล้ว — handover ซ้ำในรุ่นเดียวกันไม่บิดเบือนซ้ำ (เซฟเก่าไม่มี) */
  agedGeneration?: number;
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
  | { type: 'hasRole'; role: string }
  /** role = เช็กคนใน role นั้นแทน actor */
  | { type: 'sex'; is: 'm' | 'f'; role?: string }
  /** เงินพอจ่ายสินสอดที่ตกลงไว้ / ค่าน้ำนมที่ถูกทวง (เงินตัวเองหรือพ่อแม่ในเรือนเดียวกัน) */
  | { type: 'canPay'; what: 'sinsot' | 'elope' }
  /** มีตำแหน่งราชการระดับ minRank..maxRank (0 = มหาดเล็ก) */
  | { type: 'office'; minRank?: number; maxRank?: number };

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
  /** role แต่งงานกับ with — ที่อยู่หลังแต่งตามธรรมเนียม (ดู wed ใน factory.ts) */
  | { op: 'marry'; role: string; with: string }
  /** ขั้นตอนแต่งงานของ role กับ with (สู่ขอ หมั้น แต่ง หนีตามกัน ค่าน้ำนม) — ดู systems/marriage.ts */
  | { op: 'marriage'; role: string; with: string; step: MarriageStep }
  /** ราชการ: enter = ถวายตัวเป็นมหาดเล็ก, promote/demote = เลื่อน/ลดหนึ่งขั้น, dismiss = ถอดจากราชการ — ดู systems/career.ts */
  | { op: 'career'; role: string; action: 'enter' | 'promote' | 'demote' | 'dismiss' }
  /** ความโปรดปรานในราชการ */
  | { op: 'favor'; role: string; delta: number }
  /** เงิน: delta ตำลึง และ/หรือ perSakdina × ศักดินาของคนนั้น (ปรับไหมตามบรรดาศักดิ์) */
  | { op: 'wealth'; role: string; delta?: number; perSakdina?: number }
  /**
   * งานบ้าน (หมวดและขั้นจากตัวแปร $chore / $task ของ event): join = ตกลงช่วยครั้งแรก teacher สอนขั้นแรก,
   * learn = หัดขั้นใหม่ได้ (factor คูณทักษะที่ได้), decline = ไม่ช่วย — ดู systems/chores.ts
   */
  | { op: 'chore'; role: string; action: 'join' | 'learn' | 'decline'; teacher?: string; factor?: number }
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
  | { source: 'personality'; trait: keyof Personality; invert?: boolean; weight: number; reasonKey: string }
  /** ความคาดหวังตามเพศ (ลูกผู้หญิงปฏิเสธงานครัวยากกว่า) — ค่าต่อเพศโดยตรง */
  | { source: 'sex'; f?: number; m?: number; reasonKey: string };

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
  trigger: {
    ageRange?: [number, number]; estates?: Estate[]; weight: number; cooldownDays?: number;
    /** เกิดเฉพาะคนที่รับราชการอยู่ในระดับนี้ (0 = มหาดเล็ก) */
    office?: { minRank?: number; maxRank?: number };
  };
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
  /** event สำเร็จของวิธีนี้ (แทน IntentDef.success) — ฝากผู้ใหญ่ทาบทามสำเร็จ = ผู้ใหญ่ตกลงกันแล้ว */
  success?: EventDefId;
}

/**
 * propose: ให้ผู้ใหญ่ยกขันหมากไปสู่ขอ (ผู้ใหญ่ฝ่ายหญิงอาจไม่ยอม) · betroth: ผู้ใหญ่ตกลงกันแล้ว นัดวันแต่ง
 * wed / wedService: ถึงวันนัด จ่ายสินสอดเต็ม / จ่ายบางส่วนแล้วไปช่วยงานบ้านพ่อตาแม่ยายแทน · breakOff: ผิดนัด
 * elope: พาหนีมาอยู่ด้วยกัน (ยังไม่เป็นผัวเมีย) · ตอนพ่อแม่ฝ่ายหญิงตามมา: settleElope (จ่ายครบแล้วแต่ง)
 * / serveElope (จ่ายบางส่วน ช่วยงานบ้านเขา แล้วแต่ง) / returnBride (ส่งตัวคืน เสียค่าปรับ)
 */
export type MarriageStep =
  | 'propose' | 'betroth' | 'wed' | 'wedService' | 'breakOff' | 'elope' | 'settleElope' | 'serveElope' | 'returnBride';

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

/** ตำแหน่งในกรม — บันไดจากทำเนียบศักดินา (lore: social.patrol_department_ladder, social.royal_pages_1680s) */
export interface OfficePostDef {
  id: string;
  rank: number;
  label: { th: string };
  /** ชื่อตำแหน่งที่ได้ — {name} = ราชทินนาม; ไม่มี = ใช้ label (มหาดเล็กไม่มีบรรดาศักดิ์) */
  title?: string;
  sakdina: number;
  /** อยู่ในตำแหน่งอย่างน้อยกี่ปีจึงเลื่อนได้ */
  minYears: number;
  /** มีคนเดียวในกรม — เลื่อนได้เมื่อตำแหน่งว่าง (สุ่ม) */
  unique?: boolean;
  loreRefs?: string[];
}

export interface OfficesDef {
  department: { label: { th: string }; loreRefs?: string[] };
  posts: OfficePostDef[];
  /** ราชทินนามของหมื่น/ขุนในกรม — คู่เดียวกันทั้งสองระดับ */
  names: string[];
}

/** งานบ้านขั้นหนึ่ง — ไล่ตามทักษะและอายุ (lore: kinship.child_chores_by_strength) */
export interface ChoreTaskDef {
  id: string;
  /** tag ป้ายชื่องาน (task:*) — ใช้แสดงในข้อความ */
  tag: TagId;
  minSkill: number;
  minAge: number;
  gain: number;
  /** event เฉพาะของขั้นนี้ (เช่นหั่นผัก = จับมีด อาจโดนบาด) แทน chore.learn */
  event?: EventDefId;
  /** บุญที่ได้เมื่อหัดขั้นนี้ (ใส่บาตร) */
  merit?: number;
}

export interface ChoreDomainDef {
  id: string;
  tag: TagId;
  skill: string;
  /** โอกาสที่ถูกเรียกไปช่วยงานหมวดนี้ ตามเพศ */
  weight: { f: number; m: number };
  /** แรงคาดหวังตามเพศ: สูง = ปฏิเสธยาก และคนว่านอนสอนง่ายเข้าไปช่วยเอง */
  expect: { f: number; m: number };
  tasks: ChoreTaskDef[];
  /** ทำซ้ำหลังหัดครบแล้วได้บุญทีละเท่านี้ (งานบุญ) */
  practiceMerit?: number;
  loreRefs?: string[];
}

export interface ChoresDef {
  domains: ChoreDomainDef[];
  skillLabels: Record<string, string>;
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
    /** ความเสี่ยงตายแยกเพศ (แทน deathRisk) — อหิวาต์ 2363 ผู้หญิงตายมากกว่า */
    deathRiskBySex?: { m: Unit; f: Unit };
    /** โรคระบาด/ข้าวยาก: ตายได้ทุกคนในฉาก (คนนอกด้วย) ไม่ใช่แค่คนในตระกูล */
    everyone?: boolean;
    /** ฝักฝ่ายที่โดนริบราชบาดาล */
    purgeFactions?: string[];
  };
}

// ============================================================================
// Balance (ทุกค่าปรับใน JSON ได้)
// ============================================================================

export interface Balance {
  epochYear: number;
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
    rainySeason: [number, number]; // วันที่เท่าไรของปีสุริยคติ (0 = 1 ม.ค.)
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
  /**
   * ความเสี่ยงตายรายปีตามอายุ (systems/mortality.ts) — ทอยทุก 1 ม.ค. ด้วยอายุของปีที่เพิ่งผ่านไป
   * ทิศทางจาก lore หมวด health; ตัวเลขเป็นของเกม ปรับให้ตารางชีพใน sim:check อยู่ในเป้า
   */
  mortality: {
    /** ขวบปีแรก (lore: health.children_dying_young — ทะเบียนทศวรรษ 2470 ทารกตายราว 1 ใน 4–3) */
    infant: Unit;
    /** อายุ 1–4 ต่อปี */
    young: Unit;
    /** อายุ 5–14 ต่อปี */
    child: Unit;
    /** อายุ 15 ถึง oldFrom ต่อปี: ไข้ โรคบิด (lore: health.longevity_old_age) */
    adult: Unit;
    /** ตั้งแต่อายุนี้ความเสี่ยงเพิ่มเท่าตัวทุก oldDoublingYears ปี เริ่มจาก oldBase */
    oldFrom: number;
    oldBase: Unit;
    oldDoublingYears: number;
    /** อายุตั้งแต่นี้ขึ้นไปนับว่าตายเพราะชรา (ต่ำกว่านี้ = ป่วยตาย) */
    oldAgeCause: number;
    /**
     * ไข้ทรพิษ (lore: health.smallpox_endemic): ระบาดหนักปีละกี่ส่วน; ปีนั้นเด็กอายุต่ำกว่า 15 ที่ยังไม่เคยเป็นติดเท่าไร
     * ติดแล้วตายเท่าไร รอดแล้วมีรอยบนหน้าเท่าไร — รอดแล้วไม่เป็นซ้ำ; ตัวเลขเป็นของเกม
     */
    smallpoxYearChance: Unit;
    smallpoxAttack: Unit;
    smallpoxFatality: Unit;
    smallpoxScarChance: Unit;
  };
  /**
   * ร่างกายแต่กำเนิด (Character.constitution) — ตัวเลขเป็นของเกม ไม่มีหลักฐานสมัยนั้น
   * ลูก = inherit × ค่าเฉลี่ยพ่อแม่ + ส่วนสุ่ม (ปรับให้ทั้งประชากรยังกระจาย 0 ± 1 ทุกรุ่น ไม่แข็งแรงขึ้นเรื่อยๆ)
   */
  constitution: {
    inherit: number;
    /** ความเสี่ยงตาย × e^(−riskPerSD × ค่า) หารค่าเฉลี่ยของตัวคูณ → อัตราตายรวมของเด็กแรกเกิดเท่าเดิม */
    riskPerSD: number;
    /** ลูกผู้เล่นที่ค่าต่ำกว่านี้ ถูกทักว่าเลี้ยงยากเมื่ออายุ hardToRaiseAge */
    hardToRaiseBelow: number;
    hardToRaiseAge: number;
  };
  world: {
    eventsPerYear: number;
    /**
     * ช่วงอายุออกเรือนตามเพศ — แต่ละปีในช่วงมีโอกาสเท่ากัน (lore: kinship.marry_young_1680s)
     * ตัวเลขเป็นของเกม: ลา ลูแบร์บอกแค่ว่าแต่งกันอายุน้อยมาก
     */
    marriageAge: { f: [number, number]; m: [number, number] };
    /** ส่วนที่ครบช่วงอายุแล้วไม่ออกเรือนเลยตลอดชีวิต */
    neverMarryChance: Unit;
    /**
     * การมีบุตร (lore: health.population_stationary): ให้นมลูก 2–3 ปีจึงเว้นอย่างน้อย minGapYears หลังลูกคนก่อน
     * แล้วมีโอกาสปีละ yearlyChance จนแม่อายุ maxMotherAge — ตัวเลขเป็นของเกม ตั้งให้แต่ละรุ่นราวคงที่เมื่อรวมเด็กตาย
     */
    births: { minGapYears: number; yearlyChance: Unit; maxMotherAge: number };
    /** แม่ตายตอนคลอดต่อการคลอดหนึ่งครั้ง (lore: health.childbirth_deaths — ไม่มีอัตราในเอกสาร ตัวเลขเป็นของเกม) */
    childbirthDeathRisk: Unit;
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
  /** งานบ้านของเด็ก — ตัวเลขเป็นของเกม */
  chores: {
    ageRange: [number, number];
    /** ต่อปี: ครั้งที่ถูกเรียกไปช่วยงาน */
    sessionsPerYear: number;
    /** แนวโน้มนิสัยถึงค่านี้ → ทำเองโดยไม่ถามผู้เล่น / ต่ำกว่า autoNoAt → ไม่สนใจและไม่มีใครบังคับ */
    autoYesAt: number;
    autoNoAt: number;
    /** ไม่ยอมช่วยแล้วกี่ปีจึงถูกเรียกอีก */
    askAgainYears: number;
    /** ทำงานที่หัดได้แล้วซ้ำ — ทักษะเพิ่มทีละเท่านี้ (เงียบ ไม่ขึ้น log) */
    practiceGain: number;
    /** วัยรุ่นที่ยังไม่มีคู่ ไปเที่ยวพายเรือเก็บดอกบัวเอง — ช่วงอายุ และครั้งต่อปี */
    outingAge: [number, number];
    outingsPerYear: number;
  };
  /**
   * งานบุญ/งานประจำปีของผู้เล่น — เดือนและวันพระตามปฏิทินจันทรคติ (core/calendar.ts)
   * (lore: ritual.holy_days_1680s, ritual.temple_festival_1680s, ritual.floating_lanterns_1680s, ritual.fifth_month_bathing_1680s)
   */
  festivals: {
    minAge: number;
    /** ต่อปี: วันพระที่ขึ้นเป็น event (จากวันเพ็ญและวันดับราว 25 วัน) */
    holyDaysPerYear: number;
    templeFairsPerYear: number;
    /** งานวัดเฉพาะหน้าแล้ง: เดือนจันทรคติแรก..สุดท้าย (1 = เดือนอ้าย) */
    fairMonths: [number, number];
    lanternMonth: number;
    lanternChance: number;
    bathingMonth: number;
    bathingChance: number;
    /** ช่วงอายุที่อาจมีคนต่างเพศที่ยังไม่มีคู่ในงาน (แอบมอง ชวนไปลอยโคม) */
    peerAge: [number, number];
  };
  /** ราชการ — ตัวเลขทั้งหมดเป็นค่าของเกม (lore: social.officers_no_salary_1680s, social.court_punishments_1680s) */
  career: {
    /** ลูกขุนนางชายถวายตัวเป็นมหาดเล็กได้ช่วงอายุนี้ */
    entryAge: [number, number];
    /** มหาดเล็กแก่สุดไม่ถึง 25 — ถึงอายุนี้ได้ตำแหน่งในกรมหรือพ้นจากราชการ */
    pageMaxAge: number;
    /** ต่อปี: โอกาสที่พ่อแม่จะพาไปถวายตัว */
    entryChance: Unit;
    /** สัดส่วนแรงงานที่หายจากเรือนเพราะเข้าเวรในวัง */
    dutyLabor: Unit;
    /** ไม่มีเบี้ยหวัด — ของกำนัล/ส่วยตามตำแหน่งต่อปี ต่อศักดินา 1 (ตำลึง) */
    incomePerSakdina: number;
    /** ความโปรดปรานคลายกลับหา 0 ทุกปี (คูณ) */
    favorDecay: Unit;
    promoteAt: number;
    punishAt: number;
    /** ตำแหน่งเจ้ากรมว่างในปีหนึ่งๆ */
    uniqueVacancyChance: Unit;
    /** บารมีตระกูลที่ได้ต่อขั้นเมื่อเลื่อน */
    promotePrestige: number;
  };
  /** ตัวเลขเงินเป็นค่าของเกม ไม่ใช่ราคาจริงในเอกสาร (lore มีแค่เพดาน 100 ชั่งของลา ลูแบร์) */
  marriage: {
    /** สินสอดตามฐานะของฝ่ายหญิง (ตำลึง) */
    sinsotByEstate: Record<Estate, number>;
    /** ฝ่ายชายฐานะต่ำกว่า → ผู้ใหญ่ฝ่ายหญิงเรียกมากขึ้น */
    marryUpFactor: number;
    /** ขันหมากสามขันตอนไปสู่ขอ — ผิดนัดแล้วเอาคืนไม่ได้ */
    khanmak: number;
    betrothalMonths: [number, number];
    /** โอกาสที่ผู้ใหญ่ฝ่ายหญิงยอมยกให้ (ก่อนปรับตามฐานะและความคุ้นเคย) */
    consentBase: Unit;
    /** ผ่อนด้วยแรงงาน: จ่ายก่อนส่วนนี้ แล้วไปช่วยงานบ้านพ่อตาแม่ยาย serviceMonths เดือน ด้วยแรงงาน serviceLabor */
    servicePays: Unit;
    serviceMonths: number;
    serviceLabor: Unit;
    /** หนีตามกันแล้วกี่เดือนพ่อแม่ฝ่ายหญิงจึงตามมา */
    claimAfterMonths: number;
    /** ค่าน้ำนมค่าเลี้ยงดู + ค่าปรับที่ฝ่ายหญิงเรียก เทียบกับสินสอด — ส่งตัวคืนเสียครึ่งเดียว (ชายช่วยออกกึ่งหนึ่ง ม.139) */
    elopeClaimFactor: number;
    /** บารมีตระกูลที่เสียเมื่อหนีตามกัน ตามฐานะของคนหนี — ขุนนางเสียหน้ามากกว่าไพร่ */
    elopePrestige: Record<Estate, number>;
    /** ความรักต่อพ่อแม่ตัวเองที่ลดเมื่อหนีตามกัน (พ่อแม่โกรธ) */
    elopeAffection: number;
    breakOffPrestige: number;
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
  /**
   * ชื่อเดียวกันที่พบในหลายรายการ lore รวมเป็นแถวเดียว: estates = ยูเนียน (null = ทุกชนชั้น), loreRefs = ทุกแหล่ง
   * invented: ทุกแหล่งเป็นชื่อที่แต่งขึ้น (lore status 'invented') — ตัวสุ่มใช้รองจากชื่อที่มีหลักฐาน
   */
  names: Array<{ name: string; sex: 'm' | 'f' | null; estates: Estate[] | null; loreRefs: string[]; invented?: true }>;
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
  offices: OfficesDef;
  chores: ChoresDef;
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
