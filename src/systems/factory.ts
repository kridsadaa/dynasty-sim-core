import { dayOfYear, must, newId, yearOf, type Ctx } from '../core/ctx';
import type {
  Character, Dynasty, DynastyId, Estate, FamilyNode, GameState, Household, HouseholdId, Parentage, Personality,
} from '../core/types';

export function emptyState(seed: number): GameState {
  return {
    meta: {
      schemaVersion: 1, // ต้องตรงกับ CURRENT_SCHEMA ใน engine/persistence.ts
      seed, rngState: seed, day: 0, nextSerial: 1,
      playerCharacterId: '' as Character['id'], playerDynastyId: '' as DynastyId,
    },
    characters: {}, bodyParts: {}, wounds: {}, memories: {}, traits: {}, households: {},
    familyNodes: {}, dynasties: {}, legends: {}, items: {}, relations: {}, eventLog: {},
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

export function spawnCharacter(ctx: Ctx, o: SpawnOpts): Character {
  const B = ctx.content.balance;
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
    birthYear: o.birthYear,
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
  // คนที่เกิดในปีนี้หรือก่อนหน้า: วันเกิดของปีนี้ต้องผ่านมาแล้ว → เด็กเกิดใหม่ไม่มีวันเกิดในอนาคต (อายุ -1)
  // และคู่ครองที่สร้างด้วย birthYear = ปีนี้ − อายุ ได้อายุตรงตามที่ตั้งใจ (ทอยสุ่มครั้งเดียวเท่าเดิม)
  const now = ctx.state.meta.day;
  const birthDaySpan = o.birthYear <= yearOf(ctx, now) ? dayOfYear(ctx, now) + 1 : B.daysPerYear;
  const ch: Character = {
    id: newId(ctx, 'chr'),
    familyNodeId: node.id,
    dynastyId,
    householdId: o.householdId ?? o.mother?.householdId ?? o.father?.householdId ?? null,
    name: o.name,
    sex: o.sex,
    handedness: ctx.rng.chance(0.1) ? 'l' : 'r',
    birthDay: (o.birthYear - B.epochYear) * B.daysPerYear + Math.floor(ctx.rng.range(0, birthDaySpan)),
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
    horoscope: { weekday: Math.floor(ctx.rng.range(0, 7)), yearAnimal: (o.birthYear - 2280 + 12) % 12, omenTags: [] },
    lod: 'full',
  };
  node.characterId = ch.id;
  ctx.state.familyNodes[node.id] = node;
  ctx.state.characters[ch.id] = ch;
  fatherNode?.childIds.push(node.id);
  motherNode?.childIds.push(node.id);
  if (ch.householdId) ctx.state.households[ch.householdId]?.memberIds.push(ch.id);
  return ch;
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

export function marry(ctx: Ctx, a: Character, b: Character): void {
  const na = must(ctx.state.familyNodes[a.familyNodeId], 'a');
  const nb = must(ctx.state.familyNodes[b.familyNodeId], 'b');
  na.spouseIds.push(nb.id);
  nb.spouseIds.push(na.id);
  const id = `${a.id}|${b.id}|spouse`;
  ctx.state.relations[id] = { id, from: a.id, to: b.id, kind: 'spouse', strength: 0.5, sinceDay: ctx.state.meta.day };
}

export function createDynasty(ctx: Ctx, name: string, founder: Character, faction: string | null): Dynasty {
  const dyn: Dynasty = {
    id: newId(ctx, 'dyn'), name, founderNodeId: founder.familyNodeId, headNodeId: founder.familyNodeId,
    prestige: 10, karma: 0, faction, taboos: [], legendIds: [], branchSummaries: [],
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
  if (ch.householdId) {
    const old = ctx.state.households[ch.householdId];
    if (old) old.memberIds = old.memberIds.filter((id) => id !== ch.id);
  }
  ch.householdId = hh.id;
  if (!hh.memberIds.includes(ch.id)) hh.memberIds.push(ch.id);
}
