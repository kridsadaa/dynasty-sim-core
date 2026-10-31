import { isAlive, type Ctx } from '../core/ctx';
import type { Character, FamilyNode, TagId } from '../core/types';
import { prepareEvent, type PreparedEvent } from './events';

// ============================================================================
// ญาติใกล้ชิดของผู้เล่นตาย → event งานศพ (ปีละหนึ่ง event คนที่ใกล้ที่สุด คนอื่นขึ้นแค่ใน log)
// ตายร้าย (คลอดลูก ไข้ทรพิษ อหิวาต์) ต้องฝังไว้ก่อนแล้วขุดขึ้นมาเผาภายหลัง (lore: belief.bad_death_burial)
// ============================================================================

/** สาเหตุที่นับว่าตายร้าย — lore: belief.bad_death_burial (ลา ลูแบร์, ครอว์เฟิร์ด, Bangkok Calendar) */
const isBadDeath = (cause: TagId | null) =>
  cause === 'situation:childbirth' || cause === 'situation:smallpox' || !!cause?.startsWith('history:cholera');

/** ความเป็นญาติของ dead มองจาก me (ใช้ node จึงใช้กับคนที่ตายแล้วได้) — เรียงจากใกล้ไปไกล ไม่ใช่ญาติใกล้ = undefined */
function kinTie(ctx: Ctx, me: Character, dead: Character): { tie: TagId; rank: number } | undefined {
  const nodes = ctx.state.familyNodes;
  const mine = nodes[me.familyNodeId];
  const theirs = nodes[dead.familyNodeId];
  if (!mine || !theirs) return undefined;
  const m = dead.sex === 'm';
  const parentsOf = (n: FamilyNode | undefined) => [n?.fatherId, n?.motherId].filter((x): x is FamilyNode['id'] => !!x);
  if (mine.spouseIds.includes(theirs.id)) return { tie: m ? 'kin:husband' : 'kin:wife', rank: 0 };
  if (mine.childIds.includes(theirs.id)) return { tie: m ? 'kin:son' : 'kin:daughter', rank: 1 };
  if (parentsOf(mine).includes(theirs.id)) return { tie: 'kin:parent', rank: 2 };
  if (parentsOf(theirs).some((p) => parentsOf(mine).includes(p))) {
    const older = dead.birthDay < me.birthDay;
    return { tie: older ? (m ? 'kin:elder_brother' : 'kin:elder_sister') : m ? 'kin:younger_brother' : 'kin:younger_sister', rank: 3 };
  }
  if (mine.childIds.some((c) => nodes[c]?.childIds.includes(theirs.id))) return { tie: m ? 'kin:grandson' : 'kin:granddaughter', rank: 4 };
  if (mine.fatherId && parentsOf(nodes[mine.fatherId]).includes(theirs.id)) return { tie: m ? 'kin:paternal_grandfather' : 'kin:paternal_grandmother', rank: 5 };
  if (mine.motherId && parentsOf(nodes[mine.motherId]).includes(theirs.id)) return { tie: m ? 'kin:maternal_grandfather' : 'kin:maternal_grandmother', rank: 5 };
  return undefined;
}

/** เรียกหลังทุกอย่างที่ฆ่าคนได้ในวันนั้น — คืน event ของญาติที่ใกล้ที่สุดที่ตายวันนี้ */
export function kinDeathEvent(ctx: Ctx): PreparedEvent | null {
  const S = ctx.state;
  const me = S.characters[S.meta.playerCharacterId];
  if (!isAlive(me)) return null;
  const closest = Object.values(S.characters)
    .filter((c) => c.deathDay === S.meta.day && c.id !== me.id)
    .flatMap((c) => {
      const k = kinTie(ctx, me, c);
      return k ? [{ c, ...k }] : [];
    })
    .sort((a, b) => a.rank - b.rank)[0];
  if (!closest) return null;
  const bad = isBadDeath(closest.c.deathCause);
  return prepareEvent(ctx, bad ? 'family.death_bad' : 'family.death', { actor: me.id, deceased: closest.c.id }, {
    tie: closest.tie, ...(bad && closest.c.deathCause ? { cause: closest.c.deathCause } : {}),
  });
}
