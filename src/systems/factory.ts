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

/**
 * สุ่มชื่อจาก names.json (compile จาก lore) ตามเพศ/ชนชั้น โดยเลี่ยงชื่อใน avoid (พ่อแม่ พี่น้อง)
 * ถ้าไม่มีที่ตรงเลยใช้ชื่อชั่วคราว
 */
export function pickName(ctx: Ctx, sex: 'm' | 'f', estate: Estate, avoid: ReadonlySet<string> = new Set()): string {
  const fits = ctx.content.names.names.filter(
    (n) => (n.sex === null || n.sex === sex) && (n.estates === null || n.estates.includes(estate)) && !avoid.has(n.name),
  );
  return ctx.rng.pick(fits)?.name ?? ctx.rng.pick(PLACEHOLDER_NAMES.filter((n) => !avoid.has(n))) ?? 'ทอง';
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
