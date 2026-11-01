import { daysInYear, yearsToDays } from '../core/calendar';
import { dayOfYear, isAlive, must, newId, yearOf, yearsBetween, yearStart, type Ctx } from '../core/ctx';
import type {
  Character, Day, Dynasty, DynastyId, Estate, FamilyNode, GameState, Household, HouseholdId, Parentage, Personality,
} from '../core/types';

export function emptyState(seed: number): GameState {
  return {
    meta: {
      schemaVersion: 2, // ต้องตรงกับ CURRENT_SCHEMA ใน engine/persistence.ts
      seed, rngState: seed, day: 0, nextSerial: 1,
      playerCharacterId: '' as Character['id'], playerDynastyId: '' as DynastyId,
    },
    characters: {}, bodyParts: {}, wounds: {}, memories: {}, traits: {}, households: {},
    familyNodes: {}, dynasties: {}, legends: {}, items: {}, relations: {}, eventLog: {}, intents: {},
  };
}

export interface SpawnOpts {
  name: string;
  sex: 'm' | 'f';
  birthYear: number;
  estate: Estate;
  personality?: Partial<Personality>;
  father?: Character;
  mother?: Character;
  parentage?: Parentage;
  dynastyId?: DynastyId | null;
  householdId?: HouseholdId | null;
  wealth?: number;
}

/**
 * วันเกิดตาม birthYear ที่ผู้เรียกส่งมา
 *   เกิดปีนี้: วันเกิดต้องไม่เลยวันนี้ → เด็กเกิดใหม่ไม่มีวันเกิดในอนาคต (อายุ -1)
 *   ปีก่อนๆ: ผู้เรียกหมายถึง "อายุ ปีนี้ − birthYear ณ วันนี้" (คู่ครอง/คนรู้จักสร้างด้วย ปีนี้ − อายุ, ฉากเริ่มเกม)
 *     → สุ่มในช่วงหนึ่งปีที่ให้อายุนั้นพอดี ปีเกิดจริงจึงอาจเป็น birthYear − 1
 *     สุ่มแค่ในปี birthYear ถึงวันนี้ → สร้างตอนต้นปี (ฉากเริ่มเกม) เกิดวันแรกของปีเหมือนกันหมด
 *     สุ่มทั้งปี birthYear → ส่วนใหญ่ยังไม่ถึงวันเกิด อายุขาดไปหนึ่งปี
 *   ปีหน้าขึ้นไป: สุ่มทั้งปี
 */
function birthDayFor(ctx: Ctx, birthYear: number): Day {
  const now = ctx.state.meta.day;
  const thisYear = yearOf(ctx, now);
  const roll = (span: number) => Math.floor(ctx.rng.range(0, span));
  if (birthYear > thisYear) return yearStart(ctx, birthYear) + roll(daysInYear(birthYear));
  if (birthYear === thisYear) return yearStart(ctx, birthYear) + roll(dayOfYear(ctx, now) + 1);
  const age = thisYear - birthYear;
  // วันที่เดียวกับวันนี้ในปี birthYear คือวันเกิดช้าสุดที่ยังอายุครบ — ถอยได้ไม่เกินหนึ่งปีจากวันนั้น
  let day = yearStart(ctx, birthYear) + Math.min(dayOfYear(ctx, now), daysInYear(birthYear) - 1) - roll(daysInYear(birthYear - 1));
  // 29 ก.พ. ทำให้คลาดได้หนึ่งวัน
  while (yearsBetween(ctx, day, now) > age) day++;
  while (yearsBetween(ctx, day, now) < age) day--;
  return day;
}

/**
 * ชื่อในข้อความที่ผู้เล่นอ่าน: ต่อท้ายปีเกิดเมื่อมีคนอื่นในผังตระกูลชื่อเดียวกัน
 * (ญาติใกล้ชิดไม่ซ้ำชื่อกันอยู่แล้ว แต่ญาติห่างหรือคนที่ตายไปแล้วซ้ำได้)
 */
export function displayName(ctx: Ctx, who: Character | FamilyNode): string {
  const node = 'familyNodeId' in who ? ctx.state.familyNodes[who.familyNodeId] : who;
  if (!node) return who.name;
  const twin = Object.values(ctx.state.familyNodes).some((n) => n.id !== node.id && n.name === node.name && n.dynastyId === node.dynastyId);
  return twin ? `${node.name} (เกิด ${node.birthYear})` : node.name;
}

export function spawnCharacter(ctx: Ctx, o: SpawnOpts): Character {
  const B = ctx.content.balance;
  const birthDay = birthDayFor(ctx, o.birthYear);
  const birthYear = yearOf(ctx, birthDay);
  const rnd = () => Math.round(ctx.rng.range(0.15, 0.85) * 100) / 100;
  const p: Personality = {
    neuroticism: rnd(), imagination: rnd(), boldness: rnd(), agreeableness: rnd(),
    piety: rnd(), pride: rnd(), resilience: rnd(), ...o.personality,
  };
  const fatherNode = o.father ? ctx.state.familyNodes[o.father.familyNodeId] : undefined;
  const motherNode = o.mother ? ctx.state.familyNodes[o.mother.familyNodeId] : undefined;
  // นับญาติทั้งสองฝ่าย (lore: kinship.*): ลูกของลูกสาวกับเขยคนนอกยังเป็นคนของตระกูล
  const dynastyId = o.dynastyId ?? o.father?.dynastyId ?? o.mother?.dynastyId ?? null;

  const node: FamilyNode = {
    id: newId(ctx, 'fam'),
    characterId: null,
    dynastyId,
    name: o.name,
    sex: o.sex,
    birthYear,
    deathYear: null,
    fatherId: fatherNode?.id ?? null,
    motherId: motherNode?.id ?? null,
    spouseIds: [],
    childIds: [],
    parentage: o.parentage ?? (fatherNode ? 'principal_wife' : 'unknown'),
    // ใช้รุ่นที่ลึกกว่าของพ่อ/แม่ — เขยคนนอกเป็นรุ่น 0 ถ้าใช้ของพ่ออย่างเดียว ลูกของลูกสาวจะรุ่นผิด
    generation: Math.max(fatherNode?.generation ?? -1, motherNode?.generation ?? -1) + 1,
    summary: null,
    legendIds: [],
    pruneLevel: 0,
  };
  const ch: Character = {
    id: newId(ctx, 'chr'),
    familyNodeId: node.id,
    dynastyId,
    householdId: o.householdId ?? o.mother?.householdId ?? o.father?.householdId ?? null,
    name: o.name,
    sex: o.sex,
    handedness: ctx.rng.chance(0.1) ? 'l' : 'r',
    birthDay,
    deathDay: null,
    deathCause: null,
    anatomyId: 'human',
    bodyPartIds: [], woundIds: [], memoryIds: [], traitIds: [],
    caregiverIds: [o.mother?.id, o.father?.id].filter((x): x is Character['id'] => !!x),
    personality: p,
    skills: {},
    stress: 0,
    merit: 0,
    social: { estate: o.estate, sakdina: 0, title: null, patronId: null, wealth: o.wealth ?? 0, debt: 0 },
    horoscope: { weekday: Math.floor(ctx.rng.range(0, 7)), yearAnimal: (birthYear - 2280 + 12) % 12, omenTags: [] },
    lod: 'full',
    constitution: inheritConstitution(ctx, o.father, o.mother),
  };
  node.characterId = ch.id;
  ctx.state.familyNodes[node.id] = node;
  ctx.state.characters[ch.id] = ch;
  fatherNode?.childIds.push(node.id);
  motherNode?.childIds.push(node.id);
  if (ch.householdId) ctx.state.households[ch.householdId]?.memberIds.push(ch.id);
  return ch;
}

/**
 * ร่างกายแต่กำเนิด: คนนอก/คนรุ่นแรกสุ่มจากประชากร ลูกได้ค่าเฉลี่ยพ่อแม่บางส่วน (ฝ่ายที่ไม่รู้ = 0)
 * ค่าเฉลี่ยพ่อแม่กระจาย ±√½ → ส่วนสุ่ม √(1 − b²/2) ทำให้ลูกยังกระจาย ±1 เท่าประชากร
 */
function inheritConstitution(ctx: Ctx, father: Character | undefined, mother: Character | undefined): number {
  const b = father || mother ? ctx.content.balance.constitution.inherit : 0;
  const mid = ((father?.constitution ?? 0) + (mother?.constitution ?? 0)) / 2;
  return Math.round((b * mid + Math.sqrt(1 - (b * b) / 2) * ctx.rng.normal()) * 100) / 100;
}

/** ชื่อชั่วคราวจนกว่า lore จะมีรายชื่อพอ — ไม่ได้มาจากเอกสาร */
const PLACEHOLDER_NAMES = ['ทอง', 'เงิน', 'บุญ', 'สุข', 'มั่น', 'เจิม', 'ปาน', 'อ่อน'];

/** คนที่ตายไปไม่เกินกี่ปียังนับว่า "ชื่อนี้มีคนใช้อยู่" — คนยังจำได้ เล่าเรื่องแล้วสับสน */
const RECENT_DEAD_YEARS = 30;

/**
 * ชื่อที่คนในตระกูลใช้อยู่ → จำนวนคน: ทุกคนที่ยังมีชีวิต (รวมคู่ครองที่แต่งเข้ามา) และคนที่ตายไม่นาน
 * ใช้เป็นตัวลงโทษแบบนุ่ม — pool ชื่อยังเล็ก กันเด็ดขาดไม่ได้
 */
export function namesInUse(ctx: Ctx, dynastyId: DynastyId | null, year: number): Map<string, number> {
  const out = new Map<string, number>();
  if (!dynastyId) return out;
  const nodes = ctx.state.familyNodes;
  for (const n of Object.values(nodes)) {
    const inDynasty = n.dynastyId === dynastyId || n.spouseIds.some((s) => nodes[s]?.dynastyId === dynastyId);
    if (!inDynasty || (n.deathYear !== null && year - n.deathYear > RECENT_DEAD_YEARS)) continue;
    out.set(n.name, (out.get(n.name) ?? 0) + 1);
  }
  return out;
}

/**
 * สุ่มชื่อจาก names.json (compile จาก lore) ตามเพศ/ชนชั้น
 * - avoid: ห้ามเด็ดขาด (พ่อแม่ พี่น้อง คู่ครอง)
 * - inUse: เลือกชื่อที่คนในตระกูลใช้น้อยที่สุดก่อน (ดู namesInUse)
 *   ใช้เท่ากัน → ชื่อที่มีเอกสาร (attested) ก่อนชื่อที่แต่ง (invented)
 * ถ้าไม่มีที่ตรงเลยใช้ชื่อชั่วคราว
 */
export function pickName(
  ctx: Ctx, sex: 'm' | 'f', estate: Estate, avoid: ReadonlySet<string> = new Set(), inUse: ReadonlyMap<string, number> = new Map(),
): string {
  const fits = ctx.content.names.names.filter(
    (n) => (n.sex === null || n.sex === sex) && (n.estates === null || n.estates.includes(estate)) && !avoid.has(n.name),
  );
  // ชื่อที่ผู้เล่นเคยตั้งในเซฟนี้ใช้ได้เหมือนชื่อในคลัง
  const custom = (ctx.state.meta.customNames ?? [])
    .filter((n) => n.sex === sex && !avoid.has(n.name) && !fits.some((f) => f.name === n.name))
    .map((n) => ({ name: n.name, invented: false }));
  const pool = fits.length || custom.length
    ? [...fits.map((n) => ({ name: n.name, invented: !!n.invented })), ...custom]
    : PLACEHOLDER_NAMES.filter((n) => !avoid.has(n)).map((name) => ({ name, invented: true }));
  // ใช้ซ้ำน้อยสุดก่อน แล้วชื่อที่มีเอกสารก่อนชื่อที่แต่ง
  const rank = (n: { name: string; invented: boolean }) => (inUse.get(n.name) ?? 0) * 2 + (n.invented ? 1 : 0);
  const best = Math.min(...pool.map(rank));
  return ctx.rng.pick(pool.filter((n) => rank(n) === best))?.name ?? 'ทอง';
}

/** ชื่อที่ผู้เล่นพิมพ์: อักษรไทย 1–20 ตัว ไม่มีช่องว่าง — คืน null ถ้าใช้ไม่ได้ */
export function cleanName(raw: string): string | null {
  const name = raw.trim();
  return /^[฀-๿]{1,20}$/.test(name) ? name : null;
}

/** จำชื่อที่ผู้เล่นตั้งเองไว้ในเซฟ (ถ้ายังไม่มีในคลัง) ให้ NPC ที่เกิดทีหลังสุ่มได้ */
export function rememberCustomName(ctx: Ctx, name: string, sex: 'm' | 'f'): void {
  if (ctx.content.names.names.some((n) => n.name === name && (n.sex === null || n.sex === sex))) return;
  const list = (ctx.state.meta.customNames ??= []);
  if (!list.some((n) => n.name === name && n.sex === sex)) list.push({ name, sex });
}

export function renameCharacter(ctx: Ctx, ch: Character, name: string): void {
  ch.name = name;
  const node = ctx.state.familyNodes[ch.familyNodeId];
  if (node) node.name = name;
}

/** ชื่อที่ห้ามใช้กับเด็กแรกเกิด: ญาติใกล้ของพ่อแม่ฝั่งตระกูล และชื่อผู้เล่นที่ยังมีชีวิต */
export function newbornAvoid(ctx: Ctx, parent: Character, otherParent: Character | undefined): Set<string> {
  const avoid = relativeNames(ctx, parent, otherParent);
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (player && player.deathDay === null) avoid.add(player.name);
  return avoid;
}

/** สุ่มชื่อใหม่ให้เด็กที่เกิดแล้ว (ให้คนอื่นตั้งให้) — ไม่ซ้ำชื่อเดิมที่ตั้งไว้ชั่วคราว */
export function pickNameFor(ctx: Ctx, kid: Character): string {
  const node = ctx.state.familyNodes[kid.familyNodeId];
  const parents = [node?.fatherId, node?.motherId]
    .map((n) => (n ? ctx.state.familyNodes[n]?.characterId : null))
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .filter((c): c is Character => !!c);
  const main = parents.find((p) => p.dynastyId === kid.dynastyId) ?? parents[0];
  const avoid = main ? newbornAvoid(ctx, main, parents.find((p) => p !== main)) : new Set<string>();
  avoid.add(kid.name);
  return pickName(ctx, kid.sex, kid.social.estate, avoid, namesInUse(ctx, kid.dynastyId, yearOf(ctx, ctx.state.meta.day)));
}

/** sinceDay: วันแต่ง — ไม่ระบุ = วันนี้ (ฉากเริ่มใส่วันในอดีตให้คู่ที่แต่งกันมาก่อนเริ่มเรื่อง) */
export function marry(ctx: Ctx, a: Character, b: Character, sinceDay = ctx.state.meta.day): void {
  const na = must(ctx.state.familyNodes[a.familyNodeId], 'a');
  const nb = must(ctx.state.familyNodes[b.familyNodeId], 'b');
  na.spouseIds.push(nb.id);
  nb.spouseIds.push(na.id);
  const id = `${a.id}|${b.id}|spouse`;
  ctx.state.relations[id] = { id, from: a.id, to: b.id, kind: 'spouse', strength: 0.5, sinceDay };
}

/**
 * แต่งงานแล้วไปอยู่ที่ไหน — ch คือคนในตระกูล, spouse คือคนนอกที่แต่งเข้ามา (lore: kinship.uxorilocal_then_neolocal_1680s,
 * kinship.marriage_law_three_seals, kinship.residence_mixed_census, kinship.youngest_daughter_house):
 *  - ลูกสาวในตระกูลแต่งงาน → เขยคนนอกย้ายมาอยู่เรือนพ่อแม่ฝ่ายหญิง
 *  - ลูกชายในตระกูลแต่งงาน → ส่วนใหญ่ไปอยู่กับครอบครัวภรรยา (นอกฉาก = ตั้งเรือนใหม่), บางส่วนพาภรรยามาอยู่บ้านพ่อแม่
 *  - ครบ stayYears คู่ที่อยู่บ้านพ่อแม่แยกเรือนออกไป (ดู lifeMilestones)
 */
export function wed(ctx: Ctx, ch: Character, spouse: Character): string {
  const W = ctx.content.balance.world;
  const day = ctx.state.meta.day;
  marry(ctx, ch, spouse);
  ch.marriedDay = day;
  delete spouse.local; // คนรู้จักนอกตระกูลที่แต่งเข้ามา กลายเป็นคนในเรือน
  const stay = yearsToDays(Math.round(ctx.rng.range(W.stayYears[0], W.stayYears[1])));

  const parentsHome = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  if (ch.sex === 'f') {
    // เขยเข้าเรือนพ่อแม่ฝ่ายหญิง (ลักษณผัวเมีย ม.61 รองรับชายที่ไปอยู่บ้านฝ่ายหญิง)
    joinHousehold(ctx, spouse, parentsHome ?? createHousehold(ctx, ch));
    ch.moveOutDay = day + stay;
    return `${ch.name}แต่งงานกับ${spouse.name} เขยเข้ามาอยู่เรือนพ่อแม่ฝ่ายหญิง`;
  }
  if (parentsHome && ctx.rng.chance(W.patrilocalChance)) {
    joinHousehold(ctx, spouse, parentsHome);
    ch.moveOutDay = day + stay;
    return `${ch.name}แต่งงานกับ${spouse.name} พาเมียมาอยู่เรือนพ่อแม่`;
  }
  // ไปอยู่กับครอบครัวภรรยา — ครอบครัวฝ่ายหญิงไม่ได้จำลอง จึงนับเป็นเรือนใหม่ของคู่นี้
  const home = createHousehold(ctx, ch);
  joinHousehold(ctx, spouse, home);
  return `${ch.name}แต่งงานกับ${spouse.name} ไปอยู่กับครอบครัวเมีย`;
}

export function createDynasty(ctx: Ctx, name: string, founder: Character, faction: string | null): Dynasty {
  const dyn: Dynasty = {
    id: newId(ctx, 'dyn'), name, founderNodeId: founder.familyNodeId, headNodeId: founder.familyNodeId,
    prestige: 10, karma: 0, faction, taboos: [], legendIds: [], branchSummaries: [],
    headHistory: [{ nodeId: founder.familyNodeId, name: founder.name, fromYear: yearOf(ctx, ctx.state.meta.day) }],
  };
  ctx.state.dynasties[dyn.id] = dyn;
  founder.dynastyId = dyn.id;
  const node = ctx.state.familyNodes[founder.familyNodeId];
  if (node) node.dynastyId = dyn.id;
  return dyn;
}

export function createHousehold(ctx: Ctx, head: Character): Household {
  const hh: Household = { id: newId(ctx, 'hh'), headId: head.id, memberIds: [], dynastyId: head.dynastyId, rules: [] };
  ctx.state.households[hh.id] = hh;
  joinHousehold(ctx, head, hh);
  return hh;
}

// ---- อายุออกเรือน (lore: kinship.marry_young_1680s) ----
// ในช่วงอายุ [min, max] แต่ละปีมีโอกาสเท่ากัน ครบ max แล้วส่วนใหญ่แต่ง ที่เหลือ (neverMarryChance) ครองโสดตลอดชีวิต

/** ปีนี้ออกเรือนไหม — เรียกปีละครั้งกับคนที่ยังไม่มีคู่ */
export function marriesThisYear(ctx: Ctx, sex: 'm' | 'f', age: number): boolean {
  const W = ctx.content.balance.world;
  const [min, max] = W.marriageAge[sex];
  if (age < min || age > max) return false;
  // ออกเรือนปีละ (1 − q)/n ของทั้งรุ่นเท่ากันทุกปี → โอกาสของคนที่ยังเหลือ = (1 − q)/(n − ปีที่ผ่านไป × (1 − q))
  const n = max - min + 1;
  const wed = 1 - W.neverMarryChance;
  return ctx.rng.chance(wed / (n - (age - min) * wed));
}

/** ส่วนของคนอายุนี้ที่ออกเรือนไปแล้ว รวมรอบของปีนี้ — คนนอกถูกสร้างหลังรอบออกเรือนประจำปี จึงไม่ได้ทอยปีนี้อีก */
export function marriedShare(ctx: Ctx, sex: 'm' | 'f', age: number): number {
  const W = ctx.content.balance.world;
  const [min, max] = W.marriageAge[sex];
  if (age < min) return 0;
  return (1 - W.neverMarryChance) * Math.min(1, (age - min + 1) / (max - min + 1));
}

/**
 * อายุของคนนอกที่สร้างมาเป็นคนยังไม่มีคู่ (คนให้เกี้ยว): ไม่ต่ำกว่า lo และไม่ถึงปีสุดท้ายของช่วง
 * — สร้างหลังรอบออกเรือนของปีนั้นแล้ว ถ้าสร้างตอนอายุครบช่วงพอดีจะไม่มีโอกาสออกเรือนอีกเลย
 */
export function singleSpawnAge(ctx: Ctx, sex: 'm' | 'f', age: number, lo: number): number {
  return Math.min(ctx.content.balance.world.marriageAge[sex][1] - 1, Math.max(lo, age));
}

/**
 * ป้ายสถานะของคนที่ยังไม่มีคู่: พ้นช่วงออกเรือนแล้ว ผู้หญิงเรียก "สาวแก่" (lore: kinship.unmarried_older_women)
 * ผู้ชายยังไม่พบคำเฉพาะ · ยังไม่ถึงวัยคืน null
 */
export function singleLabel(ctx: Ctx, sex: 'm' | 'f', age: number): string | null {
  if (age < 15) return null;
  if (age <= ctx.content.balance.world.marriageAge[sex][1]) return 'ยังไม่ออกเรือน';
  return sex === 'f' ? 'สาวแก่' : 'ไม่ออกเรือน';
}

/** อายุคู่ครองเพศ sex ของคนอายุ partnerAge: อยู่ในช่วงอายุออกเรือน ภรรยาอ่อนกว่า สามีแก่กว่า */
export function spouseAgeFor(ctx: Ctx, sex: 'm' | 'f', partnerAge: number): number {
  const [min, max] = ctx.content.balance.world.marriageAge[sex];
  const pick = min + Math.floor(ctx.rng.range(0, max - min + 1));
  return sex === 'f' ? Math.min(pick, Math.max(min, partnerAge - 1)) : Math.max(pick, partnerAge + 1);
}

export function livingSpouse(ctx: Ctx, ch: Character): Character | undefined {
  return ctx.state.familyNodes[ch.familyNodeId]?.spouseIds
    .map((n) => ctx.state.familyNodes[n]?.characterId)
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .find((c): c is Character => !!c && c.deathDay === null);
}

export function livingParents(ctx: Ctx, ch: Character): Character[] {
  const node = ctx.state.familyNodes[ch.familyNodeId];
  return [node?.fatherId, node?.motherId]
    .map((n) => (n ? ctx.state.familyNodes[n]?.characterId : null))
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .filter((c): c is Character => !!c && c.deathDay === null);
}

/** ชื่อที่ไม่ควรตั้งให้ลูกคนใหม่ของ ch: ญาติใกล้ที่ยังมีชีวิต (พ่อแม่ ปู่ย่าตายาย ลุงป้าน้าอา พี่น้อง ลูกพี่ลูกน้อง) */
export function relativeNames(ctx: Ctx, ch: Character, spouse: Character | undefined): Set<string> {
  const people = [ch, ...(spouse ? [spouse] : []), ...livingChildren(ctx, ch)];
  for (const parent of livingParents(ctx, ch)) {
    people.push(parent);
    for (const sib of livingChildren(ctx, parent)) people.push(sib, ...livingChildren(ctx, sib));
  }
  return new Set(people.map((p) => p.name));
}

/** ชื่อที่ห้ามใช้กับคู่ครองที่แต่งเข้ามา: ตัวเจ้าบ่าว/เจ้าสาวเอง และคู่ครองของพี่น้อง (สะใภ้/เขยสองคนชื่อเดียวกันอ่านไม่รู้เรื่อง) */
export function inLawNames(ctx: Ctx, ch: Character): Set<string> {
  const names = new Set([ch.name]);
  for (const parent of livingParents(ctx, ch)) {
    for (const sib of livingChildren(ctx, parent)) {
      const sp = livingSpouse(ctx, sib);
      if (sp) names.add(sp.name);
    }
  }
  return names;
}

export function livingChildren(ctx: Ctx, ch: Character): Character[] {
  return (ctx.state.familyNodes[ch.familyNodeId]?.childIds ?? [])
    .map((n) => ctx.state.familyNodes[n]?.characterId)
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .filter((c): c is Character => !!c && c.deathDay === null);
}

/**
 * ลูกที่อยู่ดูแลพ่อแม่และได้เรือนไป: ลูกสาวคนสุดท้อง ถ้าไม่มีลูกสาวใช้ลูกชายคนสุดท้อง
 * (lore: kinship.youngest_daughter_house)
 */
export function pickCaregiverChild(children: Character[]): Character | undefined {
  const youngestFirst = [...children].sort((a, b) => b.birthDay - a.birthDay);
  return youngestFirst.find((c) => c.sex === 'f') ?? youngestFirst[0];
}

export function joinHousehold(ctx: Ctx, ch: Character, hh: Household): void {
  const old = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  if (old && old !== hh) {
    old.memberIds = old.memberIds.filter((id) => id !== ch.id);
    // หัวเรือนย้ายออก (เช่น ม่ายแต่งใหม่ไปตั้งเรือนกับภรรยา) → คนอาวุโสสุดที่ยังอยู่เป็นหัวเรือนแทน ไม่มีใครเหลือก็เลิกเรือน
    if (old.headId === ch.id) {
      const next = old.memberIds.map((id) => ctx.state.characters[id]).filter(isAlive).sort((a, b) => a.birthDay - b.birthDay)[0];
      if (next) old.headId = next.id;
      else delete ctx.state.households[old.id];
    }
  }
  ch.householdId = hh.id;
  if (!hh.memberIds.includes(ch.id)) hh.memberIds.push(ch.id);
}
