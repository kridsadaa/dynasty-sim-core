import { must, newId, type Ctx } from '../core/ctx';
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
  const dynastyId = o.dynastyId ?? o.father?.dynastyId ?? null;

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
    generation: (fatherNode?.generation ?? motherNode?.generation ?? -1) + 1,
    summary: null,
    legendIds: [],
    pruneLevel: 0,
  };
  const ch: Character = {
    id: newId(ctx, 'chr'),
    familyNodeId: node.id,
    dynastyId,
    householdId: o.householdId ?? o.father?.householdId ?? null,
    name: o.name,
    sex: o.sex,
    handedness: ctx.rng.chance(0.1) ? 'l' : 'r',
    birthDay: (o.birthYear - B.epochYear) * B.daysPerYear + Math.floor(ctx.rng.range(0, B.daysPerYear)),
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
  const hh: Household = { id: newId(ctx, 'hh'), headId: head.id, memberIds: [head.id], dynastyId: head.dynastyId, rules: [] };
  ctx.state.households[hh.id] = hh;
  head.householdId = hh.id;
  return hh;
}

export function joinHousehold(ctx: Ctx, ch: Character, hh: Household): void {
  if (ch.householdId) {
    const old = ctx.state.households[ch.householdId];
    if (old) old.memberIds = old.memberIds.filter((id) => id !== ch.id);
  }
  ch.householdId = hh.id;
  hh.memberIds.push(ch.id);
}
