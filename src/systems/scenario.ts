import { yearStart, type Ctx } from '../core/ctx';
import type { Character, ItemId, TagId } from '../core/types';
import { setRelation, spawnLocal } from './acquaintance';
import { createDynasty, createHousehold, marry, namesInUse, pickName, relativeNames, spawnCharacter } from './factory';
import { snapshotToNode } from './handover';

/**
 * ฉากเริ่มต้น (ปลายอยุธยา พ.ศ. 2288): ลูกชายวัย 4 ขวบของขุนนางชั้นผู้น้อย
 * โลกมีอดีตมาก่อน: พ่อแม่แต่งกันมา 9 ปี มีพี่คนหนึ่ง ปู่ล่วงลับแล้ว ย่า ตา ยายยังอยู่ และมีผู้ใหญ่ข้างบ้าน
 * ตัวเลขปีของเรื่องหลังเป็นของเกม (ไม่ได้มาจากเอกสาร) แต่ตั้งให้ตรงกฎของระบบ:
 * แม่ออกเรือนอายุ 17 พ่ออายุ 22 (ในช่วง balance.world.marriageAge) ลูกเกิดปีที่ 2 กับ 5 หลังแต่ง (childAfterMarriageYears)
 * TODO: ย้ายไปเป็น scenarios.json เมื่อมีหลายฉาก
 */
export function bootstrapScenario(ctx: Ctx, heroName = 'บุญมา'): Character {
  ctx.state.meta.day = yearStart(ctx, 2288);
  const taken = new Set(['หมื่นอิน', 'แย้ม', heroName]);
  const elder = (sex: 'm' | 'f', birthYear: number) => {
    const name = pickName(ctx, sex, 'noble', taken);
    taken.add(name);
    return spawnCharacter(ctx, { name, sex, birthYear, estate: 'noble' });
  };

  // ปู่ย่า ตายาย — อยู่กับลูกคนอื่น (ลูกสาวคนสุดท้องอยู่ดูแลพ่อแม่ lore: kinship.youngest_daughter_house) จึงไม่มีเรือนในฉาก
  const grandfather = elder('m', 2233);
  const grandmother = elder('f', 2239);
  marry(ctx, grandfather, grandmother, yearStart(ctx, 2255));
  grandfather.deathDay = yearStart(ctx, 2283) + 120;
  grandfather.deathCause = 'situation:old_age';
  snapshotToNode(ctx, grandfather);
  const maternalGrandfather = elder('m', 2239);
  const maternalGrandmother = elder('f', 2244);
  marry(ctx, maternalGrandfather, maternalGrandmother, yearStart(ctx, 2260));

  const father = spawnCharacter(ctx, {
    name: 'หมื่นอิน', sex: 'm', birthYear: 2257, estate: 'noble', wealth: 600, father: grandfather, mother: grandmother,
  });
  const dyn = createDynasty(ctx, 'บ้านริมคลองตะเคียน', father, 'faction:taksin_loyalist');
  father.social.title = 'หมื่นอินทรรักษา';
  const hh = createHousehold(ctx, father);
  const mother = spawnCharacter(ctx, {
    name: 'แย้ม', sex: 'f', birthYear: 2262, estate: 'noble', householdId: hh.id,
    father: maternalGrandfather, mother: maternalGrandmother,
  });
  // แต่งต้นปี 2279 → ลูกคนแรกปี 2281 คนที่สองคือตัวเอกปี 2284 · ทั้งคู่พ้นปีมีลูกแล้ว ไม่มีน้องเพิ่ม
  father.marriedDay = yearStart(ctx, 2279);
  marry(ctx, father, mother, father.marriedDay);
  const siblingSex = ctx.rng.chance(0.5) ? 'm' : 'f';
  spawnCharacter(ctx, {
    name: pickName(ctx, siblingSex, 'noble', new Set([...relativeNames(ctx, father, mother), heroName]), namesInUse(ctx, dyn.id, 2288)),
    sex: siblingSex, birthYear: 2281, estate: 'noble', father, mother,
  });
  const hero = spawnCharacter(ctx, { name: heroName, sex: 'm', birthYear: 2284, estate: 'noble', father, mother });

  const items: Array<[TagId, 'house' | 'land' | 'gold' | 'manual', number, boolean]> = [
    ['house:riverside', 'house', 200, false],
    ['land:paddy_north', 'land', 150, false],
    ['gold:buried_jar', 'gold', 120, true],
    ['manual:goldsmith', 'manual', 50, false],
  ];
  for (const [tag, kind, value, hidden] of items) {
    const id = `itm_${tag}` as ItemId;
    const dynOwned = kind === 'manual';
    ctx.state.items[id] = {
      id, tag, kind, value, hidden, condition: 1,
      ownerCharacterId: dynOwned ? null : father.id, ownerDynastyId: dynOwned ? dyn.id : null,
      ...(kind === 'manual' ? { teaches: { skill: 'goldsmith', learnBonus: 0.5 } } : {}),
    };
  }
  ctx.state.meta.playerCharacterId = hero.id;
  ctx.state.meta.playerDynastyId = dyn.id;

  // ผู้ใหญ่ข้างบ้านที่เด็กเห็นหน้ามาแต่เล็ก — คนหนึ่งรุ่นปู่ย่า อีกคนรุ่นพ่อแม่ (ออกเรือนแล้วหรือยังตามวัย)
  for (const [lo, hi] of [[55, 66], [33, 45]] as const) {
    const sex = ctx.rng.chance(0.5) ? 'm' : 'f';
    const neighbour = spawnLocal(ctx, hero, { sex, age: lo + Math.floor(ctx.rng.range(0, hi - lo + 1)), distance: 'near' });
    setRelation(ctx, hero.id, neighbour.id, 'acquaintance', 0.2);
  }
  return hero;
}
