import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character } from '../core/types';
import { spawnLocal } from './acquaintance';
import { prepareEvent, type PreparedEvent } from './events';
import { createHousehold, joinHousehold, livingChildren, marry } from './factory';
import { houseCapacity, houseMembersCount } from './servants';
import { bond } from './will';

// ============================================================================
// เมียน้อยและการหย่า — เฉพาะผู้เล่นชาย
//
//  เมียกลางนอก (อนุภรรยา) รองจากเมียหลวง (lore: social.wife_categories) → ลูกเป็นบุตรภรรยาน้อย ได้มรดกน้อยกว่า
//  หย่า: ผัวคืนสินให้เมีย ลูกคนที่ 1, 3, 5… ไปกับแม่ คนที่ 2, 4… อยู่กับพ่อ ลูกคนเดียวไปกับแม่
//        (lore: kinship.inheritance_divorce_1680s — ลา ลูแบร์ เป็นแบบแผนการปฏิบัติ ไม่ใช่ตัวบท)
//  ตัวเลข (อายุ เงิน โอกาส ส่วนที่เมียได้ตอนหย่า) เป็นของเกม
// ============================================================================

/** เมียที่ยังมีชีวิตของผู้ชาย เมียหลวงก่อน */
export function livingWives(ctx: Ctx, man: Character): Character[] {
  return (ctx.state.familyNodes[man.familyNodeId]?.spouseIds ?? [])
    .map((n) => ctx.state.familyNodes[n]?.characterId)
    .map((id) => (id ? ctx.state.characters[id] : undefined))
    .filter((c): c is Character => isAlive(c) && c.sex === 'f');
}

/** ชายที่มีเมียแล้วรับเมียเพิ่มได้ไหม — คืนเหตุผลถ้าไม่ได้ (ใช้ทั้งปุ่มหาคู่ การเกี้ยว และเมนูตัวละคร) */
export function minorWifeProblem(ctx: Ctx, man: Character): string | null {
  const B = ctx.content.balance;
  const W = B.wives;
  const age = ageOf(ctx, man);
  if (man.sex !== 'm') return 'มีผัวอยู่แล้ว';
  if (age < W.age[0] || age > W.age[1]) return 'ไม่อยู่ในวัยที่จะรับเมียเพิ่ม';
  if (livingWives(ctx, man).length >= B.matchmaking.maxWives) return 'มีเมียมากพอแล้ว';
  const hh = man.householdId ? ctx.state.households[man.householdId] : undefined;
  if (hh && houseMembersCount(ctx, hh) >= houseCapacity(ctx, hh)) return 'คนเต็มเรือนแล้ว (ต้องขยายเรือนก่อน)';
  if (man.social.wealth < W.minWealth) return `เงินไม่พอเลี้ยงเมียอีกคน (ต้องมีอย่างน้อย ${W.minWealth} ตำลึง)`;
  return null;
}

/** ผู้เล่นชายที่แต่งงานแล้ว มีฐานะ และยังไม่มีเมียน้อย → บางปีมีคนเสนอหญิงมาเป็นเมียกลางนอก */
export function minorWifeEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.wives;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || player.sex !== 'm') return null;
  const wives = livingWives(ctx, player);
  if (wives.length !== 1 || wives[0]!.wifeRank === 'minor') return null;
  const age = ageOf(ctx, player);
  if (age < B.age[0] || age > B.age[1] || player.social.wealth < B.minWealth || !ctx.rng.chance(B.chance)) return null;
  const other = spawnLocal(ctx, player, {
    sex: 'f', age: B.wifeAge[0] + Math.floor(ctx.rng.range(0, B.wifeAge[1] - B.wifeAge[0] + 1)), distance: 'near', single: true,
  });
  return prepareEvent(ctx, 'marriage.minor_wife', { actor: player.id, spouse: wives[0]!.id, other: other.id });
}

/** effect takeWife: รับ other เป็นเมียน้อยของ actor — ย้ายเข้าเรือน ลูกที่เกิดจากนางเป็นบุตรภรรยาน้อย */
export function takeMinorWife(ctx: Ctx, man: Character, woman: Character): string {
  if (!isAlive(woman) || woman.local?.wed) return '';
  marry(ctx, man, woman);
  woman.wifeRank = 'minor';
  woman.marriedDay = ctx.state.meta.day;
  delete woman.local;
  const hh = man.householdId ? ctx.state.households[man.householdId] : undefined;
  joinHousehold(ctx, woman, hh ?? createHousehold(ctx, man));
  return `${man.name}รับ${woman.name}เป็นเมียน้อย`;
}

/**
 * เมียหลวงกีดกันเมียน้อย — ปีละครั้งตามโอกาส ถ้าเมียน้อยเป็นทาสที่ยกขึ้นมาหนักกว่า
 * (เมียหลวงยังแค้นเมียน้อยมาก โอกาสยิ่งสูง)
 */
export function jealousyEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.interactions;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || player.sex !== 'm') return null;
  const wives = livingWives(ctx, player);
  const principal = wives.find((w) => w.wifeRank !== 'minor');
  const seenFor = (id: string) =>
    (player.seen?.[`marriage.wife_jealousy@${id}`] ?? 0) > 0 ||
    (player.seen?.[`marriage.wife_jealousy_slave@${id}`] ?? 0) > 0;
  const minor = ctx.rng.pick(wives.filter((w) => w.wifeRank === 'minor' && !seenFor(w.id)));
  if (!principal || !minor) return null;
  const slave = minor.social.estate === 'that';
  const grudge = ctx.state.relations[`${principal.id}|${minor.id}|grudge`]?.strength ?? 0;
  if (!ctx.rng.chance(Math.min(0.9, B.jealousyChance * (slave ? B.jealousySlaveFactor : 1) * (1 + grudge)))) return null;
  return prepareEvent(ctx, slave ? 'marriage.wife_jealousy_slave' : 'marriage.wife_jealousy', { actor: player.id, spouse: principal.id, other: minor.id });
}

/** เมียที่ไม่รักผู้เล่นแล้ว (affection ต่ำ) ขอแยกทาง */
export function divorceEvent(ctx: Ctx): PreparedEvent | null {
  const B = ctx.content.balance.wives;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || player.sex !== 'm') return null;
  const unhappy = livingWives(ctx, player).find((w) => bond(ctx, w, player, 'affection') <= B.divorceAt);
  if (!unhappy || !ctx.rng.chance(B.divorceChance)) return null;
  return prepareEvent(ctx, 'marriage.divorce', { actor: player.id, spouse: unhappy.id });
}

/** effect divorce: แยกทาง — ตัดคู่ครอง แบ่งลูกตามลำดับเกิด เมียได้ส่วนหนึ่งของเงินไปตั้งเรือนของนาง */
export function divorce(ctx: Ctx, man: Character, wife: Character): string[] {
  const S = ctx.state;
  const B = ctx.content.balance.wives;
  const mn = S.familyNodes[man.familyNodeId];
  const wn = S.familyNodes[wife.familyNodeId];
  if (!mn || !wn || !mn.spouseIds.includes(wn.id)) return [];
  mn.spouseIds = mn.spouseIds.filter((id) => id !== wn.id);
  wn.spouseIds = wn.spouseIds.filter((id) => id !== mn.id);
  for (const id of [`${man.id}|${wife.id}|spouse`, `${wife.id}|${man.id}|spouse`]) delete S.relations[id];
  delete wife.wifeRank;
  delete wife.marriedDay;
  const share = Math.round(man.social.wealth * B.wealthShare);
  man.social.wealth -= share;
  wife.social.wealth += share;
  // ลูกของคู่นี้เรียงตามวันเกิด: คนที่ 1, 3, 5… ไปกับแม่ (ลูกคนเดียวก็ไปกับแม่)
  const kids = livingChildren(ctx, man).filter((k) => S.familyNodes[k.familyNodeId]?.motherId === wn.id)
    .sort((a, b) => a.birthDay - b.birthDay);
  const withMother = kids.filter((_, i) => i % 2 === 0);
  const home = createHousehold(ctx, wife);
  for (const k of withMother) joinHousehold(ctx, k, home);
  const lines = [`${man.name}หย่ากับ${wife.name} — คืนสินให้นาง ${share} ตำลึง`];
  if (withMother.length) lines.push(`${withMother.map((k) => k.name).join(', ')}ไปอยู่กับแม่`);
  const withFather = kids.filter((k) => !withMother.includes(k));
  if (withFather.length) lines.push(`${withFather.map((k) => k.name).join(', ')}อยู่กับพ่อ`);
  return lines;
}
