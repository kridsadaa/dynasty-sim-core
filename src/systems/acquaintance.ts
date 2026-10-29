import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId, Distance, RelationKind, TradeDef } from '../core/types';
import { livingSpouse, namesInUse, pickName, spawnCharacter } from './factory';

// ============================================================================
// คนรู้จักนอกตระกูล — เพื่อนบ้าน คนต่างตำบล คนต่างเมืองที่พบในงานวัด
//
//  ผู้เล่นรู้จักใคร = Relation 'acquaintance' จากผู้เล่นไปหาคนนั้น (0 เคยเห็นหน้า .. 1 สนิท)
//  ปีละครั้ง: คนที่ยังไม่มีคู่อาจออกเรือนไปนอกฉาก · คนที่ไม่ค่อยสนิทห่างหายไป · ได้รู้จักคนใหม่
//  ครอบครัวของคนนอกไม่ได้จำลอง — เก็บแค่ระยะทางกับอาชีพของบ้าน (Character.local)
//  คนที่ไม่มีใครในฉากรู้จักแล้ว (เช่นหลังผู้เล่นเปลี่ยนรุ่น) ถูกลบทิ้ง → เซฟไม่โตตามเวลา
// ============================================================================

const relId = (from: CharacterId, to: CharacterId, kind: RelationKind) => `${from}|${to}|${kind}`;

export function relationStrength(ctx: Ctx, from: CharacterId, to: CharacterId, kind: RelationKind): number {
  return ctx.state.relations[relId(from, to, kind)]?.strength ?? 0;
}

export function setRelation(ctx: Ctx, from: CharacterId, to: CharacterId, kind: RelationKind, strength: number): void {
  const id = relId(from, to, kind);
  const prev = ctx.state.relations[id];
  ctx.state.relations[id] = {
    id, from, to, kind, strength: Math.max(-1, Math.min(1, strength)), sinceDay: prev?.sinceDay ?? ctx.state.meta.day,
  };
}

export const familiarity = (ctx: Ctx, from: CharacterId, to: CharacterId) => relationStrength(ctx, from, to, 'acquaintance');

/** คนนอกตระกูลที่ยังมีชีวิตซึ่ง ch รู้จัก */
export function knownLocals(ctx: Ctx, ch: Character): Character[] {
  const out: Character[] = [];
  for (const r of Object.values(ctx.state.relations)) {
    if (r.kind !== 'acquaintance' || r.from !== ch.id) continue;
    const other = ctx.state.characters[r.to];
    if (isAlive(other) && other.local) out.push(other);
  }
  return out;
}

export function tradeOf(ctx: Ctx, ch: Character): TradeDef | undefined {
  return ch.local ? ctx.content.trades.find((t) => t.id === ch.local!.trade) : undefined;
}

/** คนนอกที่ยังไม่มีคู่ (ไม่ได้ออกเรือนนอกฉาก และไม่มีคู่ครองในฉาก) */
export const isSingle = (ctx: Ctx, ch: Character) => !ch.local?.wed && !livingSpouse(ctx, ch);

export interface LocalOpts {
  sex: 'm' | 'f';
  age: number;
  distance: Distance;
  trade?: TradeDef;
  /** ชื่อที่ห้ามใช้เพิ่ม (เช่น สะใภ้/เขยของพี่น้อง สำหรับคู่ที่ผู้ใหญ่ทาบทาม) */
  avoid?: ReadonlySet<string>;
}

export function spawnLocal(ctx: Ctx, knower: Character, o: LocalOpts): Character {
  const trade = o.trade ?? must(ctx.rng.weighted(ctx.content.trades, (t) => t.weight), 'trade');
  const year = yearOf(ctx, ctx.state.meta.day);
  // ชื่อไม่ซ้ำกับคนที่ผู้เล่นรู้จักอยู่แล้ว (รายชื่อในแผงอ่านไม่รู้เรื่อง) และเลี่ยงชื่อที่คนในตระกูลใช้อยู่
  const avoid = new Set([knower.name, ...knownLocals(ctx, knower).map((c) => c.name), ...(o.avoid ?? [])]);
  const ch = spawnCharacter(ctx, {
    name: pickName(ctx, o.sex, trade.estate, avoid, namesInUse(ctx, knower.dynastyId, year)),
    sex: o.sex, birthYear: year - o.age, estate: trade.estate, dynastyId: null, householdId: null,
  });
  ch.local = { distance: o.distance, trade: trade.id };
  return ch;
}

/** ลบคนนอกที่ไม่มีใครในฉากเกี่ยวข้องแล้ว — ไม่มีลูก/คู่ในผัง จึงลบ node ได้เลย */
export function forgetLocal(ctx: Ctx, ch: Character): void {
  const S = ctx.state;
  for (const r of Object.values(S.relations)) if (r.from === ch.id || r.to === ch.id) delete S.relations[r.id];
  for (const i of Object.values(S.intents)) if (i.targetId === ch.id) delete S.intents[i.id];
  for (const id of ch.memoryIds) delete S.memories[id];
  for (const id of ch.traitIds) delete S.traits[id];
  for (const id of ch.woundIds) delete S.wounds[id];
  for (const id of ch.bodyPartIds) delete S.bodyParts[id];
  delete S.familyNodes[ch.familyNodeId];
  delete S.characters[ch.id];
}

export const DISTANCE_TH: Record<Distance, string> = { near: 'ระแวกบ้าน', town: 'ต่างตำบล', far: 'ต่างเมือง' };

/** "ลูกสาวบ้านช่างทอง" — ใช้ใน log และแผงคนที่รู้จัก */
export function localOrigin(ctx: Ctx, ch: Character): string {
  const who = ageOf(ctx, ch) < 25 ? (ch.sex === 'f' ? 'ลูกสาว' : 'ลูกชาย') : 'คน';
  return `${who}บ้าน${tradeOf(ctx, ch)?.label.th ?? ''}`;
}

/** ปีละครั้ง — คืน log ของผู้เล่น */
export function meetPeople(ctx: Ctx): string[] {
  const S = ctx.state;
  const L = ctx.content.balance.locals;
  const W = ctx.content.balance.world;
  const player = S.characters[S.meta.playerCharacterId];
  if (!isAlive(player)) return [];
  const out: string[] = [];
  // คนที่กำลังเกี้ยว/หมั้นอยู่ ห้ามห่างหายหรือถูกลบ
  const intentTargets = new Set(Object.values(S.intents).map((i) => i.targetId));
  if (player.betrothal) intentTargets.add(player.betrothal.toId);

  // คนนอกที่ผู้เล่นไม่รู้จักแล้ว (รุ่นก่อนรู้จัก ทายาทไม่ได้รับต่อ) → ลบ
  for (const ch of Object.values(S.characters)) {
    if (ch.local && familiarity(ctx, player.id, ch.id) <= 0 && !intentTargets.has(ch.id)) forgetLocal(ctx, ch);
  }

  const known = knownLocals(ctx, player);
  // ออกเรือนไปนอกฉาก — คนที่กำลังถูกเกี้ยวอยู่ก็อาจถูกคนอื่นชิงไป (tickIntents แจ้งเอง)
  for (const ch of known) {
    const marriageAge = ch.sex === 'm' ? W.marriageAge : W.marriageAgeFemale;
    if (!isSingle(ctx, ch) || ageOf(ctx, ch) < marriageAge || !ctx.rng.chance(L.wedChance)) continue;
    ch.local!.wed = true;
    if (familiarity(ctx, player.id, ch.id) >= 0.3 && !intentTargets.has(ch.id)) out.push(`${ch.name}ออกเรือนไปแล้ว`);
  }

  const age = ageOf(ctx, player);
  if (age < L.startAge) return out;
  const cap = age < 14 ? L.maxKnown[0] : L.maxKnown[1];
  let alive = known.filter(isAlive);

  // เต็มแล้ว → คนที่ไม่ค่อยสนิทห่างหายไป เปิดที่ให้คนใหม่
  if (alive.length >= cap && ctx.rng.chance(L.fadeChance)) {
    // คนที่ออกเรือนไปแล้วห่างหายก่อน แล้วจึงคนที่รู้จักน้อยที่สุด
    const loosest = alive
      .filter((c) => !intentTargets.has(c.id) && relationStrength(ctx, player.id, c.id, 'friend') < 0.5)
      .sort((a, b) => Number(isSingle(ctx, a)) - Number(isSingle(ctx, b)) || familiarity(ctx, player.id, a.id) - familiarity(ctx, player.id, b.id))[0];
    if (loosest && familiarity(ctx, player.id, loosest.id) < 0.5) {
      forgetLocal(ctx, loosest);
      alive = alive.filter((c) => c !== loosest);
    }
  }

  const single = !livingSpouse(ctx, player);
  const meet = Math.min(cap - alive.length, cap - alive.length >= 3 ? 2 : 1);
  for (let i = 0; i < meet; i++) {
    const opposite = single && age >= 14 && age <= 35 && ctx.rng.chance(L.oppositeSexWhenSingle);
    const sex = opposite ? (player.sex === 'm' ? 'f' : 'm') : ctx.rng.chance(0.5) ? player.sex : player.sex === 'm' ? 'f' : 'm';
    // วัยหนุ่มสาวต่างเพศ: ผู้หญิงมักอายุน้อยกว่า (แต่งงานเร็วกว่า) · อื่นๆ รุ่นราวคราวเดียวกัน
    const r = ctx.rng.range(0, 1);
    const otherAge = opposite
      ? sex === 'f' ? Math.max(W.marriageAgeFemale - 2, age - 1 - Math.floor(r * 7)) : age + 1 + Math.floor(r * 7)
      : Math.max(3, age - 3 + Math.floor(r * 7));
    const distance = must(ctx.rng.weighted(Object.entries(L.distanceWeights) as Array<[Distance, number]>, ([, w]) => w), 'distance')[0];
    const ch = spawnLocal(ctx, player, { sex, age: otherAge, distance });
    setRelation(ctx, player.id, ch.id, 'acquaintance', Math.round(ctx.rng.range(0.1, 0.3) * 100) / 100);
    out.push(`${player.name}ได้รู้จักกับ${ch.name} ${localOrigin(ctx, ch)} ${DISTANCE_TH[distance]}`);
  }
  return out;
}
