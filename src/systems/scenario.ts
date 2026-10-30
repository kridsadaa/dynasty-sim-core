import { yearStart, type Ctx } from '../core/ctx';
import type { Character, ItemId, TagId } from '../core/types';
import { createDynasty, createHousehold, marry, spawnCharacter } from './factory';

/**
 * ฉากเริ่มต้น (ปลายอยุธยา พ.ศ. 2288): ลูกชายวัย 4 ขวบของขุนนางชั้นผู้น้อย
 * TODO: ย้ายไปเป็น scenarios.json เมื่อมีหลายฉาก
 */
export function bootstrapScenario(ctx: Ctx, heroName = 'บุญมา'): Character {
  ctx.state.meta.day = yearStart(ctx, 2288);
  const father = spawnCharacter(ctx, { name: 'หมื่นอิน', sex: 'm', birthYear: 2255, estate: 'noble', wealth: 600 });
  const dyn = createDynasty(ctx, 'บ้านริมคลองตะเคียน', father, 'faction:taksin_loyalist');
  father.social.title = 'หมื่นอินทรรักษา';
  const hh = createHousehold(ctx, father);
  const mother = spawnCharacter(ctx, { name: 'แย้ม', sex: 'f', birthYear: 2262, estate: 'noble', householdId: hh.id });
  marry(ctx, father, mother);
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
  return hero;
}
