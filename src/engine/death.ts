import { must, yearOf, type Ctx } from '../core/ctx';
import { heirCandidates, performHandover } from '../systems/handover';
import type { LogLine, Push } from './protocol';
import { deathNotice } from './views';

/**
 * ผู้เล่นตายแล้ว (ตายตามวัยในลูปเวลา หรือเพราะผลของตัวเลือกเสี่ยงใน event) — แจ้งการตายและส่งต่อผู้สืบ
 *  extinct = ไม่มีผู้สืบ ตระกูลสิ้นสาย · choose = มีผู้สืบหลายคน ต้องให้ผู้เล่นเลือก (heirChoiceView) · handed_over = มีคนเดียว สืบต่อทันที
 * แยกออกมาจาก worker เพื่อทดสอบใน sim:check ได้ (ตัว worker พึ่ง self/postMessage)
 */
export type DeathOutcome = 'extinct' | 'choose' | 'handed_over';

export function settlePlayerDeath(c: Ctx, lines: LogLine[], push: (p: Push) => void): DeathOutcome {
  const dead = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
  const cands = heirCandidates(c, dead);
  if (!cands.length) {
    lines.push({ kind: 'death', text: `${dead.name}สิ้นชีวิตโดยไม่มีทายาท — ตระกูลสิ้นสาย` });
    push({ type: 'playerDied', notice: deathNotice(c, dead, undefined, true) });
    return 'extinct';
  }
  if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
  // มีผู้สืบได้หลายคน → หยุดให้ผู้เล่นเลือก (heirChoiceView); คนเดียวก็ไม่ต้องถาม
  if (cands.length > 1) {
    push({ type: 'playerDied', notice: deathNotice(c, dead, undefined, false) });
    return 'choose';
  }
  push({ type: 'playerDied', notice: deathNotice(c, dead, cands[0]!.ch, false) });
  const r = performHandover(c, dead.id);
  push({ type: 'handover', deceased: r.deceased, heir: r.heir, lines: r.log });
  return 'handed_over';
}
