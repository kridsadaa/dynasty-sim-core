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
  /** ผู้เล่นถูกถามเรื่องรักษาแผลนี้แล้ว (body.wound_infected) — กันถามซ้ำ */
  consulted?: boolean;
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
  /** ถูกเสนอให้ปลูกฝีแล้ว (health.inoculation) — เสนอครั้งเดียวต่อเด็ก */
  inoculationOffered?: boolean;
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
  /** deptId: กรมที่สังกัด — ไม่มี = ยังเป็นมหาดเล็ก (หรือเซฟเก่า = กรมแรก) */
  office?: { postId: string; deptId?: string; name?: string; sinceDay: Day; favor: Signed };
  /** ตำแหน่งที่หมดไปเพราะราชสำนักล่ม (เสียกรุง 2310) — แผ่นดินใหม่อาจให้คงยศเดิม (career.recall) */
  /** ถูกลดจนหลุดจากราชการเพราะความผิด — ไม่ฝากตัวเข้ากรมเองได้จนกว่าจะได้รับอภัย/ผลัดแผ่นดิน/ครบ disgraceYears (career.ts) */
  disgrace?: { year: number; deptId?: string };
  formerOffice?: { postId: string; deptId?: string; name?: string; title: string | null };
  /** ปีที่บวชเรียน (อย่างน้อยหนึ่งพรรษาแล้วลาสิกขา) — ไม่มี = ยังไม่บวช */
  ordainedYear?: number;
  /** minor = เมียกลางนอก (เมียน้อย) — ลูกเป็นบุตรภรรยาน้อย; ไม่มี = เมียหลวง/ไม่ใช่เมียใคร */
  wifeRank?: 'minor';
  /** วันครบกำหนดคลอด (ถ้ากำลังตั้งครรภ์) */
  pregnantUntilDay?: Day;
  /** ตั้งครรภ์อยู่ (systems/world.ts deliverBirths): คนในตระกูลฝั่งไหน คู่คือใคร คลอดวันไหน */
  pregnancy?: { memberId: CharacterId; partnerId: CharacterId; dueDay: Day };
  /**
   * งานบุญที่ทำเหมือนเดิมจนเป็นนิสัย (ดู systems/festivals.ts) ต่อ event: เลือกแบบเดิมติดกัน streak ครั้ง
   * ครั้งต่อไปทำเองไม่ถามจนถึง until — ข้ามช่วงวัย (stage) หรือคนที่เกี่ยวข้องเปลี่ยน (with) ก็ถามใหม่
   */
  habits?: Record<string, { optionId: string; streak: number; stage: string; with: string; until?: Day }>;
  /** วันที่ทำแต่ละอย่างจากเมนูตัวละครครั้งล่าสุด — key "<action>@<characterId>" (systems/interactions.ts) */
  lastActs?: Record<string, Day>;
  /** ผัวมาค้างด้วย/ได้รับการเอาใจ — ก่อนวันนี้มีลูกง่ายขึ้น (conceives) */
  favoredUntil?: Day;
  /** วันที่ถามหาคู่ครั้งล่าสุด (systems/matchmaking.ts) */
  matchSearchDay?: Day;
  /**
   * ประวัติการเลือกที่ไม่ถูกล้าง (eventLog ถูกตัดทิ้งเมื่อเก่า) — นับต่อ "event", "event.option",
   * "event@คน" และ "event.option@คน" (คนใน role อื่นนอกจาก actor) ดู Condition 'seen'
   */
  seen?: Record<string, number>;
  /** ปีที่โกนจุก (lore: ritual.topknot_cutting) */
  topknotCutYear?: number;
  /** ปีที่ป่วยหนักล่าสุด (event family.parent_illness) — ไม่ถามซ้ำในปีเดียวกัน */
  illYear?: number;
  /** ลูกที่ไม่ได้รักษาไข้คนนี้ — ไม่ได้ส่วนมรดกจากคนนี้ (lore: social.nursing_cremation_condition) */
  neglectedBy?: CharacterId[];
  /**
   * งานบ้านต่อหมวด (ดู systems/chores.ts): joined = เคยตกลงเข้าไปช่วยแล้ว (ครั้งต่อไปไม่ถามซ้ำ ข้ามไปหัดขั้นใหม่),
   * tasks = ขั้นที่หัดได้แล้ว, askAfter = ไม่ยอมช่วย — จะถูกเรียกอีกหลังวันนี้
   */
  chores?: Record<string, { joined: boolean; tasks: string[]; askAfter?: Day }>;
  /** สายวิชาที่กำลังฝึกยามว่าง (ดู systems/skills.ts) */
  focus?: SkillTrackId;
  /** แต้มความชำนาญสะสมต่อสายวิชา (0..100 ครบ 100 ปลดล็อกขั้นถัดไปได้) */
  skillXp?: Partial<Record<SkillTrackId, number>>;
  /** ขั้นวิชาที่ปลดล็อกแล้ว (เช่น 'martial_1', 'diplomacy_2') */
  perks?: string[];
}

export type SkillTrackId = 'martial' | 'diplomacy' | 'stewardship' | 'learning';
export type LegacyTrackId = 'court' | 'warrior' | 'wealth' | 'kin' | 'wisdom';
export type SlaveTask = 'farm' | 'house' | 'guard';

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
  /** บ่าวไพร่ (systems/servants.ts) — loyalty 0..1 ใจของทาสต่อนาย · เซฟเก่าไม่มี = ยังไม่มีใคร */
  retainers?: { that: number; phrai: number; loyalty: Unit };
  /** หัวเรือน/แม่เรือนเลือกว่าจะเลี้ยงดูทาสอย่างไร — ไม่มี = ตามสมควร */
  care?: SlaveCare;
  /** ระดับขนาดเรือน (1..4) กำหนดความจุคนในเรือน */
  tier?: number;
  /** จำนวนแปลงที่นาและสวนของเรือน */
  land?: number;
  /** งานหลักที่มอบหมายให้ทาสทำ (ทำนาสวน / รับใช้ในเรือน / เฝ้ายามคุ้มเรือน) */
  slaveTask?: SlaveTask;
  /** วันที่ปล่อยทาสครั้งล่าสุด — จำกัดการเก็บบุญจากการปล่อยทาสและกันการซื้อทาสคืนอัตโนมัติทันที */
  lastFreedDay?: number;
}

export type SlaveCare = 'stingy' | 'normal' | 'generous';

// ============================================================================
// Family / Dynasty — FamilyNode อยู่รอดหลัง Character ถูก prune (เหลือแค่ชื่อในผังตระกูล)
// ============================================================================

/** สถานะของแม่ มีผลต่อส่วนแบ่งมรดก (ตามแนวกฎหมายลักษณะมรดก — ปรับน้ำหนักใน content) */
/** ญาติที่รับมรดกเมื่อผู้ตายไม่มีบุตรที่ยังมีชีวิต (lore: social.inheritance_kin_shares) */
export type KinRelation =
  | 'grandchild' | 'greatGrandchild' | 'fullSibling' | 'paternalHalfSibling' | 'maternalHalfSibling'
  | 'nibling' | 'grandNibling' | 'grandparent' | 'uncleAunt' | 'cousin';

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
  /** ปีที่แยกไปอยู่ที่อื่นทั้งที่ยังมีชีวิต (prune: driftKinDistance) — ไม่มี = ตายในฉาก */
  driftedYear?: number;
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
  /** ชื่อต้นสายที่รวมอยู่ในบรรทัดนี้ (ลูกหลายคนของคนเดียวกันรวมเป็นบรรทัดเดียว) — เซฟเก่าไม่มี */
  names?: string[];
  /** มีคนในสายที่แยกไปอยู่ที่อื่นทั้งที่ยังมีชีวิต */
  drifted?: boolean;
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
  /** ผู้นำตระกูลแต่ละคนตามลำดับ — ใช้ในหน้าสรุปตอนจบ (เซฟเก่าไม่มี / มีแค่ช่วงหลัง) */
  headHistory?: Array<{ nodeId: FamilyNodeId; name: string; fromYear: number }>;
  /** รุ่นของทายาทใน handover ล่าสุดที่เล่าตำนานต่อ/ข้อห้ามเสื่อมแล้ว — handover ซ้ำในรุ่นเดียวกันไม่บิดเบือนซ้ำ (เซฟเก่าไม่มี) */
  agedGeneration?: number;
  /** มรดกตระกูลที่ปลดล็อกแล้ว (สายละ 0..4 ขั้น สืบทอดถาวรทุกรุ่น) */
  legacies?: Partial<Record<LegacyTrackId, number>>;
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
  /** ปีที่มีคนทันเห็นเล่าเรื่องจริงให้ผู้เล่นฟัง (event ความลับตำนานแตก) — เกิดได้ครั้งเดียวต่อเรื่อง */
  truthToldYear?: number;
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
  /** elder_acquaintance = คนนอกอายุ 50 ขึ้นไปที่ actor รู้จักพอสมควร (เช่น ผู้ใหญ่ที่เคยไหว้ที่วัด) */
  relationToActor?: RelationKind | 'parent' | 'elder_acquaintance';
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
  /** มีเงินที่ใช้ได้ (ตัวเอง + เรือน) อย่างน้อย min ตำลึง */
  | { type: 'purse'; min: number }
  /** เป็นหัวเรือนของเรือนที่อยู่ */
  | { type: 'householdHead' }
  /** ยังอยู่ในกรุง (ไม่ได้พาตัวออกไปตอนศึกพม่า) */
  | { type: 'inCity' }
  /** เตรียมรับศึกสะสมถึง min (meta.war.prep) */
  | { type: 'warPrep'; min: number }
  /** มีตำแหน่งราชการระดับ minRank..maxRank (0 = มหาดเล็ก) */
  | { type: 'office'; minRank?: number; maxRank?: number }
  /** ทักษะอย่างน้อย min (เช่น อ่านออกเขียนได้ literacy) */
  | { type: 'skill'; skill: string; min: number }
  /** ความหนักใจของ actor อยู่ในช่วงนี้ (0..1) */
  | { type: 'stress'; min?: number; max?: number }
  /**
   * เคยเลือกใน event นี้มาแล้วกี่ครั้ง (Character.seen) — option: นับเฉพาะตัวเลือกนั้น, withRole: นับเฉพาะครั้งที่คนใน role
   * นั้นเป็นคนเดียวกับครั้งนี้ — max 0 = ยังไม่เคย (event ครั้งเดียว / ครั้งเดียวต่อคน)
   */
  | { type: 'seen'; event: EventDefId; option?: string; withRole?: string; min?: number; max?: number };

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
  /** end: เลิกความตั้งใจนั้นเลย (เกี้ยวแล้วพูดผิดร้ายแรง) */
  | { op: 'intent'; role: string; progress?: number; odds?: number; end?: boolean }
  /** ความสัมพันธ์ของ role ต่อ toward: delta บวกเข้าค่าเดิม, atLeast ยกขึ้นอย่างน้อยเท่านี้ */
  | { op: 'relation'; role: string; toward: string; kind: RelationKind; delta?: number; atLeast?: number }
  /** role แต่งงานกับ with — ที่อยู่หลังแต่งตามธรรมเนียม (ดู wed ใน factory.ts) */
  | { op: 'marry'; role: string; with: string }
  /** ขั้นตอนแต่งงานของ role กับ with (สู่ขอ หมั้น แต่ง หนีตามกัน ค่าน้ำนม) — ดู systems/marriage.ts */
  | { op: 'marriage'; role: string; with: string; step: MarriageStep }
  /**
   * ราชการ: enter = ถวายตัวเป็นมหาดเล็ก, assign = พ้นมหาดเล็กไปสังกัดกรม dept แล้วเลื่อนหนึ่งขั้น,
   * promote/demote = เลื่อน/ลดหนึ่งขั้น, dismiss = ถอดจากราชการ — ดู systems/career.ts
   */
  | { op: 'career'; role: string; action: 'enter' | 'assign' | 'enter_dept' | 'promote' | 'demote' | 'dismiss' | 'restore' | 'decline'; dept?: string }
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
  /** บวชเรียนหนึ่งพรรษาแล้วสึก — จด Character.ordainedYear */
  | { op: 'ordain'; role: string }
  /**
   * ตำนานในตัวแปร $legend ของ event: reveal = เล่าเรื่องจริงให้ลูกหลาน (ตำนานกลับเป็นความจริง บารมีที่เคยได้จากการเสริมแต่งหายไป),
   * record = reveal แล้วจดลงสมุดข่อย, keep = ปล่อยไว้อย่างเดิม
   */
  | { op: 'legend'; role: string; action: 'reveal' | 'record' | 'keep' }
  /** role (ผู้ชาย) รับ with เป็นเมียน้อย — ดู systems/wives.ts */
  | { op: 'takeWife'; role: string; with: string }
  /** role ตาย (ลอบฆ่า) — เฉพาะคนนอกตระกูล คนในตระกูลต้องผ่านการแบ่งมรดก จึงไม่ใช้ op นี้ */
  /** ปกติฆ่าได้เฉพาะคนนอกตระกูล (local) — allowKin ให้ตายได้ทุกคน รวมผู้เล่น (ผลพลาดของตัวเลือกเสี่ยง) */
  /** chance = โอกาสตายเมื่อ effect นี้ทำงาน (ไม่ใส่ = ตายแน่) — ใช้คู่ allowKin ใน risk.fail ของตัวเลือกเสี่ยง (ดู docs/design-choice-risk.md) */
  | { op: 'kill'; role: string; cause: TagId; allowKin?: boolean; chance?: Unit }
  /** รักษาแผลที่กำลังอักเสบ (infected/festering) ของ role — quality สูงสุดที่เคยได้ใช้; ดู body.wound_infected */
  | { op: 'treat'; role: string; quality: Unit }
  /** ปลูกฝีให้ role: ไม่เป็นไข้ทรพิษอีก (hadSmallpox) โดยไม่มีแผลเป็น — ดู health.inoculation */
  | { op: 'inoculate'; role: string }
  /** role สั่งลอบฆ่าสำเร็จ → ญาติเหยื่อสืบรู้และตามล้างแค้น 1–3 ปีต่อมา (event feud.revenge, ผ่าน meta.feuds) */
  | { op: 'feud'; role: string }
  /** เตรียมรับโรคระบาดที่จะมาปีหน้า (plague.news): ผลต่อโอกาสตายของคนในเรือนของ role ตอน applyHistoricalShocks (balance.plague.deathMult) */
  | { op: 'plague'; role: string; kind: 'flee' | 'home' | 'merit' }
  /** role หย่ากับ with: แบ่งลูกตามลำดับเกิด เมียได้ส่วนหนึ่งของเงิน */
  | { op: 'divorce'; role: string; with: string }
  /** โกนจุกคนใน role แล้ว (หรือปล่อยผ่าน) */
  | { op: 'topknot'; role: string }
  /** role ดูแล toward ที่ป่วยหนักหรือไม่ — neglected = ไม่ได้รักษาไข้ */
  | { op: 'nurse'; role: string; toward: string; neglected: boolean }
  | { op: 'prestige'; role: string; delta: number }
  /** ศึกพม่า 2308–2310 (docs/design-war-2308.md): prep = เตรียมตัวรับศึก (เก็บข้าว ของมีค่า) สะสมใน meta.war */
  | { op: 'war'; role: string; action: 'prep'; delta: number }
  /** ย้ายเงินสด fraction ของเงินที่ใช้ได้ไปเป็นไหทองซ่อน (systems/war.ts) */
  | { op: 'war'; role: string; action: 'bury'; fraction: Unit }
  /** ปักหลักอยู่ในกรุง */
  | { op: 'war'; role: string; action: 'stay' }
  /** ออกจากกรุง: ทิศ + พาใคร (all = ทั้งเรือน, nuclear = คู่ครองและลูกในเรือน, alone = ไปคนเดียว) */
  | { op: 'war'; role: string; action: 'leave'; dir: 'east' | 'forest' | 'camp'; party: 'all' | 'nuclear' | 'alone' }
  /** ตามพระยาตากฝ่าวงล้อมออกไปทางตะวันออกคนเดียว — ตระกูลนับเป็นฝ่ายพระเจ้าตากแต่เนิ่น (ได้ความโปรดปรานในราชการ 2311–2324) */
  | { op: 'war'; role: string; action: 'taksin' };

/**
 * แรงต้านในใจตัวละครต่อตัวเลือก — บวกกันทุกข้อ (เฉพาะส่วนที่เป็นบวก)
 * ค่า ≥ will.strainAt: เลือกได้แต่ฝืนใจ (เครียด) · ≥ will.lockAt: ล็อก พร้อมบอกเหตุผล
 *  bond: ความรู้สึกที่มีต่อคนใน role (weight ติดลบ = ยิ่งเกลียดยิ่งต้าน)
 *  personality: invert = ใช้ (1 − ค่า) เช่น boldness ต่ำ → ขี้อาย
 */
export type Resist =
  | { source: 'bond'; role: string; axis: 'affection' | 'awe'; weight: number; reasonKey: string }
  /** role: ดูนิสัยของคนใน role นั้นแทน actor (ใน risk เท่านั้น — เช่น คนที่เกี้ยวชอบเรื่องบุญไหม) */
  | { source: 'personality'; trait: keyof Personality; invert?: boolean; weight: number; reasonKey: string; role?: string }
  /** ความคาดหวังตามเพศ (ลูกผู้หญิงปฏิเสธงานครัวยากกว่า) — ค่าต่อเพศโดยตรง */
  | { source: 'sex'; f?: number; m?: number; reasonKey: string }
  /** ทักษะของ actor (0..100 → 0..1) เช่น การพูดจา — ใน risk ใส่ weight ติดลบ ทักษะสูงพลาดน้อยลง */
  | { source: 'skill'; skill: string; weight: number; reasonKey: string }
  /** ความหนักใจของ actor (0..1) — ใจไม่อยู่กับตัว ทำเรื่องที่ต้องตั้งสติได้ยากขึ้น */
  | { source: 'stress'; weight: number; reasonKey: string };

/**
 * โอกาสพลาด = base + Σ (ค่าปัจจัย 0..1 × weight) ตัดไว้ที่ 5–95% — weight ติดลบ = ช่วยให้สำเร็จ
 * ตัวเลขทั้งหมดเป็นค่าของเกม ไม่ได้มาจากเอกสาร
 */
export interface OptionRisk {
  base: number;
  factors?: Resist[];
  /** ข้อความใต้ตัวเลือก เช่น "อาจถูกจับได้" — ระบบต่อท้ายด้วยโอกาสราวๆ */
  hintKey: string;
  /** บรรทัดในบันทึกเมื่อสำเร็จ (ไม่ใส่ = ไม่มีบรรทัดเพิ่ม) */
  successKey?: string;
  fail: { textKey: string; effects: Effect[] };
}

export interface EventOption {
  id: string;
  textKey: string;
  tags?: Array<TagId | VarRef>;
  conditions?: Condition[];
  resist?: Resist[];
  /** ทำแล้วอาจไม่สำเร็จ — ทอยตอนเลือก พลาดแล้วใช้ fail.effects แทน effects */
  risk?: OptionRisk;
  /** 'name' = ผู้เล่นพิมพ์ชื่อเอง — UI ถามชื่อก่อนส่งตัวเลือกนี้ */
  input?: 'name';
  /** บทตอบ/ฉากต่อของตัวเลือกที่ไม่เสี่ยง (ใช้แทน risk.successKey) — แสดงเป็นบรรทัดผลเหมือน outcome */
  replyKey?: string;
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
    office?: { minRank?: number; maxRank?: number; dept?: string };
    /** เงื่อนไขที่ต้องผ่านก่อนเกิด (ตรวจกับ actor หลังได้คนครบทุก role) — ใช้ทำสายเรื่องและ event ครั้งเดียว */
    requires?: Condition[];
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
  /** วิธีนี้ทำได้แต่เพศนี้ (เช่น ไปช่วยงานบ้านฝ่ายหญิงเป็นธรรมเนียมของชาย) */
  sex?: 'm' | 'f';
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
  midEvents: Array<{ event: EventDefId; approaches?: string[]; needsElder?: boolean; minLabor?: number; maxAge?: number; /** เกิดเฉพาะตอนผู้เกี้ยวมีเมียอยู่แล้ว */ married?: boolean }>;
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
  /** ราชทินนามของขั้นนี้ — ไม่มี = ใช้ names ของกรม; ชื่อเดิมอยู่ในรายการของขั้นถัดไป → ใช้ชื่อเดิมต่อ */
  names?: string[];
  loreRefs?: string[];
}

export interface DepartmentDef {
  id: string;
  label: { th: string };
  loreRefs?: string[];
  /** ต้องมีคุณสมบัตินี้ถึงเลือกกรมนี้ได้ตอนพ้นมหาดเล็ก (เช่น อ่านออกเขียนได้) */
  requires?: Condition[];
  /** สายวิชาที่ช่วยให้เลื่อนยศในกรมนี้ (career.skillFavorPerTier) — ไม่ระบุ = diplomacy; จับคู่เองของเกม ไม่ใช่ข้อมูลประวัติศาสตร์ */
  skillTrack?: SkillTrackId;
  /** ขั้น 0 = มหาดเล็ก (เหมือนกันทุกกรม — ยังไม่สังกัดกรม) */
  posts: OfficePostDef[];
  /** ราชทินนามของหมื่น/ขุนในกรมที่ใช้ชุดเดียวกันทั้งสองระดับ (กรมกองกระเวน) */
  names: string[];
}

export interface OfficesDef {
  /** กรมแรกเป็นค่าตั้งต้นของเซฟเก่าที่ยังไม่มี office.deptId */
  departments: DepartmentDef[];
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

/** วันที่ (นับจาก 1 ม.ค. = 0) ของปีหนึ่ง ที่ผู้เล่นอายุถึง minAge จะได้ event นี้ — ไม่ซ้ำเพราะวันตรงครั้งเดียวต่อปี */
export interface HistoryEventSchedule {
  year: number;
  day: number;
  event: EventDefId;
  minAge?: number;
}

/** เหตุการณ์ในสำรับเรื่องสมมติหลัง 2400 (rules.json › fiction.deck) — เหมือน HistoricalEvent แต่ไม่ผูกปี และมีบรรทัดเล่าเรื่อง */
export type FictionEntry = Omit<HistoricalEvent, 'year'> & { note?: string };

export interface FictionRules {
  /** ปีแรกที่เข้าสู่ยุคสมมติ */
  startYear: number;
  /** จั่วเหตุการณ์ทุกกี่ปี (สุ่มในช่วงนี้) */
  gap: [number, number];
  deck: FictionEntry[];
}

export interface HistoricalEvent {
  tag: TagId;
  year: number;
  /** boon = ปีดี (ทรัพย์เพิ่ม ใจเบาลง) — มีเฉพาะเหตุการณ์สมมติหลัง 2400 */
  kind: 'war' | 'plague' | 'succession' | 'famine' | 'boon';
  /** กี่ปีที่ป้าย "สภาวะบ้านเมือง" ค้างบน UI นับจาก year (ไม่ระบุ = 1 ปี) — ไม่มีผลต่อ shock */
  lasts?: number;
  shock: {
    /** สัดส่วนทรัพย์ที่ไม่ได้ซ่อนซึ่งสูญเสีย */
    wealthLoss: [Unit, Unit];
    deathRisk: Unit;
    /** ความเสี่ยงตายแยกเพศ (แทน deathRisk) — อหิวาต์ 2363 ผู้หญิงตายมากกว่า */
    deathRiskBySex?: { m: Unit; f: Unit };
    /** ความเสี่ยงถูกกวาดต้อนไปเป็นเชลย (ทอยหลังทอยตายรอบเดียวกัน) — ผู้ถูกกวาดต้อนหายจากเกมด้วย deathCause history:captive_after_fall (เสียกรุง 2310) */
    captureRisk?: Unit;
    /** โรคระบาด/ข้าวยาก: ตายได้ทุกคนในฉาก (คนนอกด้วย) ไม่ใช่แค่คนในตระกูล */
    everyone?: boolean;
    /** ฝักฝ่ายที่โดนริบราชบาดาล */
    purgeFactions?: string[];
    /** ตระกูลในฝักฝ่ายนั้นโดนจริงด้วยโอกาสนี้ (ไม่ระบุ = ทุกตระกูล) — การกวาดล้างจริงมักแคบกว่าทั้งฝ่าย */
    purgeChance?: Unit;
    /** ความเสี่ยงตายเฉพาะคนอายุช่วงนี้ (ศึก: ชายในวัยถูกเกณฑ์) — ไม่ระบุ = ทุกวัย */
    ages?: [number, number];
    /** ราชสำนักล่ม — ทุกคนที่มีตำแหน่งราชการหมดตำแหน่ง (เสียกรุง 2310) */
    endsOffices?: boolean;
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
  /** ตัวคูณโอกาสตายจากโรคระบาดของคนในเรือนผู้เล่น ตามที่เตรียมตัว (ของเกม ไม่ใช่ข้อมูลประวัติศาสตร์) */
  plague: { deathMult: Record<'flee' | 'home' | 'merit', Unit> };
  wound: {
    infection: Record<WoundKind, Unit>;
    scarChance: Record<WoundKind, Unit>;
    healDaysBase: number;
    healDaysPerSeverity: number;
    rainySeason: [number, number]; // วันที่เท่าไรของปีสุริยคติ (0 = 1 ม.ค.)
    festerLossChance: Unit;
    /** แผลหนองเน่า (festering) ของผู้เล่น: โอกาสตายพื้นฐาน × (0.5 + ความรุนแรง) × (1 − festerDeathTreatCut × คุณภาพการรักษา) — เฉพาะผู้เล่น (docs/design-choice-risk.md 1d) */
    festerDeathChance: Unit;
    festerDeathTreatCut: Unit;
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
    /** ต่อปี: โอกาสที่ญาติซึ่งทันเห็นเรื่องจริงจะเล่าให้ผู้เล่นฟัง (ความลับตำนานแตก) */
    truthChance: Unit;
    /** ตำนานต้องคลาดจากความจริงอย่างน้อยเท่านี้ถึงจะเป็น "ความลับ" */
    truthMinDivergence: Unit;
  };
  inheritance: {
    shareByParentage: Record<Parentage, number>;
    /** น้ำหนักของญาติเมื่อผู้ตายไม่มีบุตรที่ยังมีชีวิต (lore: social.inheritance_kin_shares, social.estate_without_heirs) */
    kinShares: Record<KinRelation, number>;
    mainHeirBonus: number;
    funeralCostRate: Record<Estate, Unit>;
    funeralPrestigePerTamlueng: number;
    /** ตายจากการกระทำกล้าที่ผู้เล่นเลือกเอง (จมน้ำตอนช่วยคน ถูกฟันตอนนำจับโจร) → ตระกูลได้บารมีเพิ่มตอนส่งต่อ (docs/design-choice-risk.md ข้อ 5) */
    heroicDeathCauses: TagId[];
    heroicDeathPrestige: number;
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
    /** ตัวคูณลูกเต๋ารายปีของผู้เล่นอายุ 15 ขึ้นไป — ชดเชยความเสี่ยงที่ผูกกับตัวเลือก (docs/design-choice-risk.md ข้อ 5); 1 = ไม่ปรับ */
    playerAdultScale: number;
    /** ปีแรกที่มีการปลูกฝีให้ราษฎร (lore health.smallpox_endemic: 2381–82 หมอหลวงเรียนปลูกฝี) */
    inoculationFrom: number;
    /** ความหนักใจของผู้เล่นเกินค่านี้เพิ่มความเสี่ยงตายรายปี ×(1 + stressSlope × ส่วนที่เกิน) */
    stressFrom: Unit;
    stressSlope: number;
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
    /** น้ำหนักของ event คูณค่านี้ทุกครั้งที่เคยเกิดกับคนนี้ในบันทึก (กันเรื่องเดิมวนซ้ำ) */
    repeatDamp: Unit;
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
    /** dueDays: ตั้งครรภ์ตอนต้นปีแล้วคลอดหลังจากนั้นกี่วัน (สุ่มในช่วงนี้) */
    births: { minGapYears: number; yearlyChance: Unit; maxMotherAge: number; dueDays: [number, number] };
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
    /** เลือกแบบเดิมติดกันกี่ครั้งจึงเป็นนิสัย แล้วทำเองไปกี่ปีก่อนถามใหม่ */
    habitStreak: number;
    habitYears: number;
    /** วันพระที่ผ่านเงื่อนไขสายเรื่องวัดแล้ว มีโอกาสเท่านี้ที่จะเป็นวันที่พาไปไหว้ผู้ใหญ่ */
    elderGreetChance: Unit;
  };
  /** ราชการ — ตัวเลขทั้งหมดเป็นค่าของเกม (lore: social.officers_no_salary_1680s, social.court_punishments_1680s) */
  /** เมียน้อยและการหย่า (lore: social.wife_categories, kinship.inheritance_divorce_1680s) — ตัวเลขเป็นของเกม */
  /** เมนูตัวละคร (systems/interactions.ts) — ค่าของเกม */
  interactions: {
    giftCost: number; giftDays: number; giftGratitude: number;
    visitDays: number; visitAffection: number; visitJealousy: number; favoredBirthFactor: number;
    minorWifeFamiliarity: Unit; slaveConcubineHurt: number;
    /** ต่อปี: โอกาสที่เมียหลวงกีดกันเมียน้อย (คูณเพิ่มถ้าเมียน้อยเป็นทาส) */
    jealousyChance: Unit; jealousySlaveFactor: number;
    /** ไปค้างเรือนเมียที่ความรักต่อผู้เล่นต่ำกว่านี้ (0..1) → ขึ้น event เมียน้อยใจ */
    visitColdAt: Unit;
  };
  /** ปุ่มหาคู่ (systems/matchmaking.ts) — ค่าของเกม */
  /** บ่าวไพร่ในเรือน (systems/servants.ts) — ค่าของเกม */
  servants: {
    estates: Estate[]; wealthPerSlave: number; maxSlaves: number; sakdinaPerPhrai: number; maxPhrai: number;
    /** ค่ากินอยู่ต่อคนในเรือนต่อปี ตามชนชั้นของหัวเรือน */
    memberUpkeep: Partial<Record<Estate, number>>;
    /** เงินที่ทาสหนึ่งคนหาได้ต่อปีเมื่อทำงานเต็มมือ · ของกำนัลจากไพร่ในสังกัดต่อคนต่อปี · ค่าไถ่ทาสใหม่ */
    slaveYield: number; phraiGift: number; slavePrice: number;
    /** โอกาสหนีต่อปีของทาสที่ใจกลางๆ · ใจทาสเข้าหาระดับของการดูแลปีละสัดส่วนนี้ */
    fleeBase: Unit; loyaltyDrift: Unit;
    /** ต่อทาสต่อปี: ค่าเลี้ยงดู ตัวคูณงาน โอกาสป่วยตาย ระดับใจที่เข้าหา บุญและบารมีที่ได้ */
    care: Record<SlaveCare, { cost: number; work: number; death: Unit; loyalty: Unit; merit: number; prestige: number }>;
  };
  matchmaking: { candidates: number; searchDays: number; sameEstateShare: Unit; maxWives: number };
  wives: {
    /** ผู้เล่นชายอายุช่วงนี้ที่มีเงินอย่างน้อย minWealth อาจมีคนเสนอเมียน้อย (ปีละ chance) */
    age: [number, number];
    minWealth: number;
    chance: Unit;
    /** อายุของหญิงที่ถูกเสนอ */
    wifeAge: [number, number];
    /** เมียที่ affection ต่อผู้เล่น ≤ divorceAt ขอแยกทาง (ปีละ divorceChance) */
    divorceAt: number;
    divorceChance: Unit;
    /** ส่วนของเงินผู้เล่นที่เมียได้ไปตอนหย่า (แทน "คืนสิน" เพราะเกมไม่ได้เก็บสินเดิมของเมีย) */
    wealthShare: Unit;
  };
  /** event วัยผู้ใหญ่/ชรา (systems/lifeEvents.ts) — ตัวเลขเป็นของเกม */
  life: {
    /** โกนจุกตอนอายุเหล่านี้ (lore: ritual.topknot_cutting ว่า 11 หรือ 13) */
    topknotAges: number[];
    adultAge: number;
    /** พ่อแม่อายุถึงนี้อาจป่วยหนัก ปีละ illnessChance */
    illnessAge: number;
    illnessChance: Unit;
    /** ผู้เล่นอายุถึงนี้อาจไปถือศีล ปีละ preceptsChance */
    elderAge: number;
    preceptsChance: Unit;
    /** ต่อปี: ผู้เล่นอายุถึง drownAge เจอคนตกน้ำใกล้ตัว */
    drownChance: Unit; drownAge: number;
    /** ญาติในฉาก (ไม่ใช่ผู้เล่น) ได้บุญปีละ piety × meritPerYear — ตั้งแต่ elderAge คูณ elderMeritFactor */
    meritPerYear: number;
    elderMeritFactor: number;
    /** ความหนักใจของทุกคนคลายลงปีละสัดส่วนนี้ เข้าหา neuroticism × stressRest */
    stressRecovery: Unit;
    stressRest: Unit;
    /** ญาติใกล้ชิด (คู่ครอง พ่อแม่ ลูก) ตายในปีที่ผ่านมา → หนักใจขึ้น griefStress × (0.5 + neuroticism) */
    griefStress: Unit;
    /** ผู้เล่นรู้สึกถึงการสูญเสียตามความรัก (affection ÷ ค่ากลาง) และเมียที่ความรักต่ำกว่า visitColdAt ปีละ coldWifeStress ต่อคน (สูงสุด 2 คน) */
    coldWifeStress: Unit;
    /** ผู้เล่นหนักใจจากคนตายน้อยกว่าญาติคนอื่นตามส่วนนี้ (ผู้เล่นมีงานศพให้เลือกรับมือ และเกมต้องเล่นต่อได้) */
    playerGriefFactor: Unit;
    /** เหตุการณ์บ้านเมืองทำคนในตระกูลหนักใจ ตามชนิด × (0.5 + neuroticism) */
    historyStress: Record<'war' | 'plague' | 'famine' | 'succession' | 'boon', Unit>;
  };
  /** บวชเรียน (lore: ritual.ordination) — ตัวเลขเป็นของเกม */
  ordination: {
    /** ผู้ชายที่ยังไม่แต่งงานบวชในช่วงอายุนี้ (ผู้เล่นถูกถามทุกปีในช่วงนี้จนบวชหรือพ้นช่วง) — lore ว่าราว 21 แต่ต้องบวชก่อนแต่ง และผู้ชายแต่งตั้งแต่ 18 */
    age: [number, number];
    /** ต่อปี: โอกาสที่ผู้ใหญ่จะเอ่ยเรื่องบวชกับผู้เล่น */
    playerChance: Unit;
    /** ญาติผู้ชายในตระกูล (ไม่ใช่ผู้เล่น) บวชเมื่ออายุ age[0] + 1 */
    npcChance: Unit;
    /** บวชแล้วอ่านออกเขียนได้อย่างน้อยเท่านี้ (literacy) */
    literacy: number;
  };
  career: {
    /** ลูกขุนนางชายถวายตัวเป็นมหาดเล็กได้ช่วงอายุนี้ */
    entryAge: [number, number];
    /** ผู้ใหญ่ที่ยังไม่มีตำแหน่งฝากตัวเข้ากรมโดยตรงได้ในช่วงอายุนี้ ปีละ lateEntryChance */
    lateEntryAge: [number, number]; lateEntryChance: Unit;
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
    /** ความโปรดปรานที่ได้เพิ่มทุกปีจากขุนนางผู้ใหญ่ที่ฝากตัวไว้ */
    patronFavor: number;
    /** ความโปรดปรานที่ได้เพิ่มทุกปีต่อขั้นวิชาที่ปลดล็อกในสายที่เกี่ยวกับกรม (0–4 ขั้น) */
    skillFavorPerTier: number;
    /**
     * ตระกูลได้ฝักฝ่ายเมื่อผู้เล่นรับราชการในช่วงปีนี้ (รวมปีปลาย) — เช่น รับราชการกรุงธนบุรี → ฝ่ายพระเจ้าตาก
     * ฝักฝ่ายมีผลตอน shock ที่ purgeFactions ระบุ แล้วหมดไปหลังจากนั้น
     */
    factionByEra: Array<{ from: number; to: number; faction: string }>;
    /** หลังราชสำนักล่ม: ผู้ที่เคยมีตำแหน่งถูกเรียกเข้ารับราชการคงยศเดิมในปีช่วงนี้ (lore: event.fall_of_ayutthaya_2310) */
    recallYears: [number, number];
    /** ถูกถอดเพราะความผิดแล้ว: ต้องรอครบกี่ปีจึงยื่นเข้ารับราชการเองได้อีก; มีผู้ใหญ่ที่ฝากตัวไว้ช่วยกราบทูลขออภัยโทษปีละ pardonChance (ตัวเลขของเกม ไม่มีหลักฐานใน lore — invented) */
    disgraceYears: number; pardonChance: Unit;
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
    /**
     * ญาติที่ยังมีชีวิตแต่ห่างจากผู้เล่นเกินนี้ (นับขั้นในผังตระกูล) แยกไปอยู่ที่อื่น — ออกจากการจำลอง เหลือแต่ชื่อในผัง
     * ต้องมากกว่า 2 × ระยะของทายาทที่ไกลที่สุด (หลาน ลูกของพี่น้อง = 3) ไม่งั้นญาติใกล้ของทายาทคนใหม่อาจแยกไปแล้ว
     */
    driftKinDistance: number;
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
  /** event ที่ส่งให้ผู้เล่นในวันที่กำหนดของปีประวัติศาสตร์ (ต่างจาก history ที่เป็น shock) */
  historyEvents: HistoryEventSchedule[];
  /** สำรับเหตุการณ์สมมติหลังปีจบของเรื่อง (ไม่มี = ไม่มีโหมดเล่นต่อ) */
  fiction?: FictionRules;
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
    /** เรื่องจบเมื่อถึง 1 ม.ค. ปีนี้ — ฉากเริ่มเป็นคนกำหนด (เซฟเก่าไม่มี → END_YEAR ใน scenario.ts) */
    endYear?: number;
    /** โหมดเล่นต่อหลัง 2400: ปีนัดจั่วเหตุการณ์ถัดไป สำรับที่เหลือ และที่จั่วไปล่าสุด (เซฟเก่าไม่มี) */
    fiction?: { next: number; bag: string[]; recent: Array<{ tag: string; year: number }> };
    /** สถานะศึกพม่า 2308–2310 — ไม่มี = ยังไม่เริ่ม/ยังไม่ได้ตัดสินใจอะไร (เซฟเก่าไม่มี) */
    /** การเตรียมรับโรคระบาดปี year (ตั้งโดย op plague ปีก่อน) — ใช้ครั้งเดียวแล้วลบ */
    /** ผู้ที่สั่งลอบฆ่าสำเร็จแล้วรอวันถูกล้างแค้น — feud.revenge ออกให้เฉพาะผู้เล่นคนเดิม (ผู้สืบไม่ต้องรับกรรม) */
    feuds?: Array<{ actorId: CharacterId; dueDay: number }>;
    plague?: { year: number; kind: 'flee' | 'home' | 'merit'; householdId: Character['householdId'] };
    war?: { prep: number; stance?: 'stay' | 'leave'; dir?: 'east' | 'forest' | 'camp'; party?: CharacterId[]; taksin?: boolean };
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
