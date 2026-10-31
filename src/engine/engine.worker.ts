import { buildContentDB } from '../content';
import { formatLunar, formatSolar } from '../core/calendar';
import { makeCtx, commitRng, isAlive, lunarOf, must, solarOf, yearOf, yearStart, type Ctx } from '../core/ctx';
import type { CharacterId, ContentDB } from '../core/types';
import { chooseOption, prepareFollowUp, restoreEvent, snapshotEvent, type PreparedEvent } from '../systems/events';
import { cleanName, emptyState, rememberCustomName } from '../systems/factory';
import { heirCandidates, performHandover } from '../systems/handover';
import { bootstrapScenario, END_YEAR, START_YEAR } from '../systems/scenario';
import { describeTrait } from '../systems/traits';
import { advanceDay } from '../systems/world';
import { deleteSlot, listSlots, loadState, saveState } from './persistence';
import type { ClockState, Command, EndReason, LogLine, Push, ReplyData, Request, WorkerMessage } from './protocol';
import { abandonIntent, startIntent } from '../systems/intent';
import {
  dynastyView, endingView, eventView, HEIR_CHOICE_ID, heirChoiceView, inspectView, intentPlanView, knownView, playerView, treeView,
  type TextTable,
} from './views';

// ============================================================================
// Simulation Worker — เจ้าของ GameState แต่เพียงผู้เดียว
// Main thread ไม่เคยถือ state: ส่ง Command มา ได้ view model กลับไป
// ทุกอย่างรันในเบราว์เซอร์ผู้เล่น → hosting เป็นแค่ static files บน CDN
// ============================================================================

const post = (m: WorkerMessage) => self.postMessage(m);
const push = (p: Push) => post({ kind: 'push', push: p });

let content: ContentDB | null = null;
let text: TextTable = {};
let ctx: Ctx | null = null;
const pending = new Map<string, PreparedEvent>(); // เซฟเป็น snapshot ไปกับทุกเซฟ → โหลดแล้วต้องตัดสินใจ event เดิมต่อ
let sessionLock: Promise<void> | null = null;

const CONTENT_FILES = ['tags', 'anatomy', 'traitKinds', 'events', 'rules', 'intents', 'offices', 'chores', 'balance', 'names', 'text.th'] as const;

const contentReady = (async () => {
  const base = `${import.meta.env.BASE_URL}content/`;
  const [tags, anatomy, traitKinds, events, rules, intents, offices, chores, balance, names, th] = await Promise.all(
    CONTENT_FILES.map((f) => fetch(`${base}${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`โหลด content ${f} ไม่ได้ (${r.status})`);
      return r.json();
    })),
  );
  content = buildContentDB({ tags, anatomy, traitKinds, events, rules, intents, offices, chores, balance, names });
  text = th;
  push({ type: 'ready' });
})();
// โหลด content ไม่ได้ → แจ้ง UI ทันที (ไม่งั้นสถานะค้าง "กำลังโหลด…") — ทุก command จะ reject ด้วย error เดียวกัน
contentReady.catch((err: unknown) =>
  push({ type: 'error', message: `เริ่มเกมไม่ได้: ${err instanceof Error ? err.message : String(err)}` }),
);

const need = (): Ctx => must(ctx, 'ยังไม่ได้เริ่มเกม');

/** กันเปิดเกมซ้อน 2 แท็บแล้วเขียน IndexedDB ทับกัน — ถือ Web Lock ไว้ตลอดอายุ worker */
function acquireSessionLock(): Promise<void> {
  if (!('locks' in navigator)) return Promise.resolve();
  sessionLock ??= new Promise<void>((resolve, reject) => {
    void navigator.locks.request('dynasty-sim:session', { ifAvailable: true }, (lock) => {
      if (!lock) {
        sessionLock = null;
        reject(new Error('เกมเปิดอยู่ในแท็บอื่น'));
        return;
      }
      resolve();
      return new Promise<void>(() => {}); // ไม่ปล่อย lock จนกว่า worker จะถูกปิด
    });
  });
  return sessionLock;
}

async function save(slot: string) {
  const c = need();
  commitRng(c);
  const player = c.state.characters[c.state.meta.playerCharacterId];
  return saveState(slot, { state: c.state, pending: [...pending.values()].map(snapshotEvent) }, {
    year: yearOf(c, c.state.meta.day),
    playerName: player?.name ?? '-',
    dynastyName: c.state.dynasties[c.state.meta.playerDynastyId]?.name ?? '-',
  });
}

// ============================================================================
// นาฬิกาเกม — เวลาเดินเองต่อเนื่อง ผู้เล่นหยุด/เล่น/ปรับความเร็วได้ (แบบเกมกลยุทธ์เรียลไทม์มีหยุด)
//   ทุก tick เดิน SPEED_DAYS_PER_SEC[speed] / TICKS_PER_SEC วัน (สะสมเศษไว้ tick ถัดไป)
//   มี event → หยุดเอง และเดินต่อให้เองเมื่อตัดสินใจครบทุก event
// ============================================================================

/** วันในเกมต่อวินาทีจริง ที่ความเร็ว 1–5 (ปีละ 360 วัน: ความเร็ว 3 ≈ 18 วินาทีต่อปี) */
const SPEED_DAYS_PER_SEC = [0, 3, 8, 20, 60, 180];
const MAX_SPEED = SPEED_DAYS_PER_SEC.length - 1;
const TICKS_PER_SEC = 10;
const AUTOSAVE_EVERY_MS = 30_000;

let speed = 2;
let playing = false;
let endReason: EndReason | null = null; // เกมจบแล้ว — ถึงปีจบของเรื่อง หรือตระกูลสิ้นสาย
let resumeAfterEvent = false;
let clockLoop: Promise<void> | null = null;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function clockState(): ClockState {
  return { playing, speed, maxSpeed: MAX_SPEED, ended: endReason !== null, ...(endReason ? { endReason } : {}) };
}
const pushClock = () => push({ type: 'clock', clock: clockState() });

/** วันที่เรื่องจบ (1 ม.ค. ของปีจบ) — วันนั้นยังเดินรอบประจำปีครบ แล้วจึงหยุด */
const endDayOf = (c: Ctx) => yearStart(c, c.state.meta.endYear ?? END_YEAR);

/** ผู้เล่นตายแล้วแต่ยังไม่ได้เลือกผู้สืบ (เซฟไว้ระหว่างเลือกก็โหลดกลับมาที่จุดนี้) */
const awaitingHeir = (c: Ctx) => !isAlive(c.state.characters[c.state.meta.playerCharacterId]);

/** เกมจบหรือยัง — คิดจาก state ล้วน ใช้ตอนโหลดเซฟ */
function endOf(c: Ctx): EndReason | null {
  const player = c.state.characters[c.state.meta.playerCharacterId];
  if (!player || (!isAlive(player) && !heirCandidates(c, player).length)) return 'extinct';
  return c.state.meta.day >= endDayOf(c) ? 'era' : null;
}

/** เดินทีละวัน n วัน — หยุดก่อนครบถ้ามี event, ต้องเลือกผู้สืบ, สิ้นสาย หรือถึงปีจบ */
function step(c: Ctx, days: number, lines: LogLine[]): 'done' | 'event' | 'heir' | 'gameOver' | 'end' {
  for (let i = 0; i < days; i++) {
    if (c.state.meta.day >= endDayOf(c)) return 'end';
    let stop: 'done' | 'event' | 'heir' = 'done';
    for (const sig of advanceDay(c)) {
      if (sig.type === 'log') lines.push({ kind: sig.kind, text: sig.line });
      else if (sig.type === 'event') {
        pending.set(sig.prepared.instance.id, sig.prepared);
        stop = 'event';
      } else {
        const dead = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
        const cands = heirCandidates(c, dead);
        if (!cands.length) {
          lines.push({ kind: 'death', text: `${dead.name} สิ้นชีวิตโดยไม่มีทายาท — ตระกูลสิ้นสาย` });
          return 'gameOver';
        }
        if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
        // มีผู้สืบได้หลายคน → หยุดให้ผู้เล่นเลือก (heirChoiceView); คนเดียวก็ไม่ต้องถาม
        if (cands.length > 1) {
          stop = 'heir';
          continue;
        }
        const r = performHandover(c, dead.id);
        push({ type: 'handover', deceased: r.deceased, heir: r.heir, lines: r.log });
      }
    }
    if (stop !== 'done') return stop;
  }
  return 'done';
}

/** ผู้สืบที่ต้องเลือก (ถ้ามี) มาก่อน event อื่น */
function pendingViews(c: Ctx) {
  const heir = heirChoiceView(c);
  return [...(heir ? [heir] : []), ...[...pending.values()].map((p) => eventView(c, p, text))];
}

function pushProgress(c: Ctx) {
  const day = c.state.meta.day;
  push({ type: 'progress', day, year: yearOf(c, day), solar: formatSolar(solarOf(c, day)), lunar: formatLunar(lunarOf(c, day)) });
}

async function runClock(c: Ctx): Promise<void> {
  let carry = 0;
  let lastSave = Date.now();
  let stoppedForEvent = false;
  const lines: LogLine[] = [];
  try {
    while (playing && ctx === c) {
      carry += SPEED_DAYS_PER_SEC[speed]! / TICKS_PER_SEC;
      const days = Math.floor(carry);
      carry -= days;
      const stop = days ? step(c, days, lines) : 'done';
      if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
      pushProgress(c);
      if (stop === 'event' || stop === 'heir') {
        playing = false;
        resumeAfterEvent = true;
        stoppedForEvent = true;
      } else if (stop === 'gameOver' || stop === 'end') {
        playing = false;
        endReason = stop === 'end' ? 'era' : 'extinct';
      }
      if (playing && Date.now() - lastSave > AUTOSAVE_EVERY_MS) {
        await save('autosave');
        lastSave = Date.now();
      }
      if (playing) await sleep(1000 / TICKS_PER_SEC);
    }
  } finally {
    pushClock();
    try {
      // ตระกูลสิ้นสาย → ไม่เขียนทับ autosave ด้วย state ที่เล่นต่อไม่ได้ (autosave ยังเป็นจุดก่อนตาย)
      // ถึงปีจบ → เซฟได้ (โหลดแล้วเปิดหน้าสรุปและผังตระกูลดูได้)
      if (endReason !== 'extinct' && ctx === c) await save('autosave');
    } finally {
      // ส่ง event หลังเซฟเสร็จ — saveState รอเปิด IndexedDB ก่อนเขียน ถ้า UI เปิดปุ่มตัวเลือกก่อน choose แทรกได้
      // เซฟจะได้ state หลังเลือกแต่ pending ก่อนเลือก → โหลดแล้วเลือก event เดิมซ้ำ
      if (stoppedForEvent && ctx === c) for (const event of pendingViews(c)) push({ type: 'pendingEvent', event });
    }
  }
}

function play(): ClockState {
  const c = need();
  if (endReason) throw new Error(endReason === 'era' ? 'เรื่องจบแล้ว' : 'ตระกูลสิ้นสายแล้ว');
  if (awaitingHeir(c)) throw new Error('ต้องเลือกผู้สืบตระกูลก่อน');
  if (pending.size) throw new Error('มีเหตุการณ์รอการตัดสินใจ');
  resumeAfterEvent = false;
  if (!playing) {
    playing = true;
    clockLoop = runClock(c).finally(() => (clockLoop = null));
  }
  pushClock();
  return clockState();
}

/** หยุดเวลาและรอ tick ที่กำลังเดินจบ — ใช้ก่อนแทนที่ ctx (เริ่มใหม่/โหลด) */
async function stopClock(): Promise<void> {
  playing = false;
  resumeAfterEvent = false;
  await clockLoop;
}

async function handle(cmd: Command): Promise<unknown> {
  await contentReady;
  switch (cmd.type) {
    case 'newGame': {
      await acquireSessionLock();
      await stopClock();
      endReason = null;
      const heroName = cmd.heroName === undefined ? undefined : cleanName(cmd.heroName);
      if (heroName === null) throw new Error('ชื่อต้องเป็นอักษรไทย 1–20 ตัว ไม่มีช่องว่าง');
      ctx = makeCtx(emptyState(cmd.seed), must(content, 'content'));
      const hero = bootstrapScenario(ctx, heroName);
      if (heroName) rememberCustomName(ctx, heroName, hero.sex);
      pending.clear();
      return playerView(ctx, text);
    }
    case 'load': {
      await acquireSessionLock();
      await stopClock();
      const saved = must(await loadState(cmd.slot), `ไม่พบเซฟ ${cmd.slot}`);
      const c = makeCtx(saved.state, must(content, 'content'));
      ctx = c;
      endReason = endOf(c);
      pending.clear();
      for (const s of saved.pending) {
        const p = restoreEvent(c, s);
        if (p) pending.set(p.instance.id, p);
      }
      return playerView(c, text);
    }
    case 'viewPending':
      return (endReason === 'extinct' ? [] : pendingViews(need())) satisfies ReplyData['viewPending'];
    case 'viewEnding': {
      const c = need();
      const dyn = c.state.dynasties[c.state.meta.playerDynastyId];
      return endingView(c, must(endReason, 'เกมยังไม่จบ'), dyn?.headHistory?.[0]?.fromYear ?? START_YEAR) satisfies ReplyData['viewEnding'];
    }
    case 'save':
      return save(cmd.slot);
    case 'listSaves':
      return listSlots();
    case 'deleteSave':
      await deleteSlot(cmd.slot);
      return null;
    case 'play':
      return play();
    case 'pause':
      await stopClock();
      return clockState();
    case 'setSpeed':
      speed = Math.max(1, Math.min(MAX_SPEED, Math.round(cmd.speed)));
      pushClock();
      return clockState();
    case 'choose': {
      const c = need();
      if (cmd.instanceId === HEIR_CHOICE_ID) {
        const dead = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
        if (!awaitingHeir(c)) throw new Error('ไม่ได้รอเลือกผู้สืบตระกูล');
        if (!heirCandidates(c, dead).some((h) => h.ch.id === cmd.optionId)) throw new Error('คนนี้สืบตระกูลไม่ได้');
        const r = performHandover(c, dead.id, cmd.optionId as CharacterId);
        push({ type: 'handover', deceased: r.deceased, heir: r.heir, lines: r.log });
        if (!pending.size && resumeAfterEvent) play();
        return { lines: [] } satisfies ReplyData['choose'];
      }
      const p = must(pending.get(cmd.instanceId), 'event นี้ไม่ได้รออยู่');
      const rep = chooseOption(c, p, cmd.optionId, { name: cmd.name });
      pending.delete(cmd.instanceId);
      const lines = rep.trauma.flatMap((t) =>
        t.branches.map((b) => `ฝังใจ: ${describeTrait(c, must(c.state.traits[b.traitId], 'trait'))}`),
      );
      if (rep.wounds.length) lines.unshift(`บาดเจ็บ ${rep.wounds.length} แห่ง`);
      if (rep.strained) lines.unshift('ฝืนใจทำ — เครียดขึ้น');
      if (rep.named) lines.push(`ตั้งชื่อว่า "${rep.named.name}"`);
      lines.push(...rep.notes);
      // ตัวเลือกพาไป event ถัดไปทันที (ช่วยงานครัว → มีดบาด) — UI ถาม viewPending ต่อ
      const next = prepareFollowUp(c, p, rep);
      if (next) pending.set(next.instance.id, next);
      // หยุดเพราะ event → ตัดสินใจครบแล้วเดินต่อเอง
      if (!pending.size && !awaitingHeir(c) && resumeAfterEvent) play();
      return { lines } satisfies ReplyData['choose'];
    }
    case 'viewPlayer':
      return playerView(need(), text);
    case 'viewDynasty':
      return dynastyView(need());
    case 'viewTree':
      return treeView(need());
    case 'viewCharacter':
      return inspectView(need(), cmd.nodeId, text);
    case 'viewKnown':
      return knownView(need(), text);
    case 'planIntent':
      return intentPlanView(need(), text, cmd.targetId, cmd.kind);
    case 'startIntent': {
      const c = need();
      const player = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
      const target = must(c.state.characters[cmd.targetId as typeof player.id], 'คนนี้');
      return { lines: startIntent(c, cmd.kind, player, target, cmd.approach) } satisfies ReplyData['startIntent'];
    }
    case 'abandonIntent': {
      const c = need();
      return { lines: abandonIntent(c, must(c.state.characters[c.state.meta.playerCharacterId], 'player')) } satisfies ReplyData['abandonIntent'];
    }
  }
}

self.onmessage = async (e: MessageEvent<Request>) => {
  const { id, cmd } = e.data;
  try {
    post({ kind: 'reply', reply: { id, ok: true, data: await handle(cmd) } });
  } catch (err) {
    post({ kind: 'reply', reply: { id, ok: false, error: err instanceof Error ? err.message : String(err) } });
  }
};
