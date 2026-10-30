import { buildContentDB } from '../content';
import { makeCtx, commitRng, dayOfYear, must, yearOf, type Ctx } from '../core/ctx';
import type { ContentDB } from '../core/types';
import { chooseOption, prepareFollowUp, restoreEvent, snapshotEvent, type PreparedEvent } from '../systems/events';
import { cleanName, emptyState, rememberCustomName } from '../systems/factory';
import { heirCandidates, performHandover } from '../systems/handover';
import { bootstrapScenario } from '../systems/scenario';
import { describeTrait } from '../systems/traits';
import { advanceDay } from '../systems/world';
import { deleteSlot, listSlots, loadState, saveState } from './persistence';
import type { ClockState, Command, Push, ReplyData, Request, WorkerMessage } from './protocol';
import { abandonIntent, startIntent } from '../systems/intent';
import { dynastyView, eventView, intentPlanView, knownView, playerView, type TextTable } from './views';

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

const CONTENT_FILES = ['tags', 'anatomy', 'traitKinds', 'events', 'rules', 'intents', 'offices', 'balance', 'names', 'text.th'] as const;

const contentReady = (async () => {
  const base = `${import.meta.env.BASE_URL}content/`;
  const [tags, anatomy, traitKinds, events, rules, intents, offices, balance, names, th] = await Promise.all(
    CONTENT_FILES.map((f) => fetch(`${base}${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`โหลด content ${f} ไม่ได้ (${r.status})`);
      return r.json();
    })),
  );
  content = buildContentDB({ tags, anatomy, traitKinds, events, rules, intents, offices, balance, names });
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
let ended = false; // ตระกูลสิ้นสาย
let resumeAfterEvent = false;
let clockLoop: Promise<void> | null = null;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function clockState(): ClockState {
  return { playing, speed, maxSpeed: MAX_SPEED, ended };
}
const pushClock = () => push({ type: 'clock', clock: clockState() });

/** เดินทีละวัน n วัน — หยุดก่อนครบถ้ามี event หรือสิ้นสาย */
function step(c: Ctx, days: number, lines: string[]): 'done' | 'event' | 'gameOver' {
  for (let i = 0; i < days; i++) {
    let stop: 'done' | 'event' | 'gameOver' = 'done';
    for (const sig of advanceDay(c)) {
      if (sig.type === 'log') lines.push(sig.line);
      else if (sig.type === 'event') {
        pending.set(sig.prepared.instance.id, sig.prepared);
        stop = 'event';
      } else {
        const dead = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
        if (!heirCandidates(c, dead).length) {
          lines.push(`${dead.name} สิ้นชีวิตโดยไม่มีทายาท — ตระกูลสิ้นสาย`);
          return 'gameOver';
        }
        if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
        const r = performHandover(c, dead.id);
        push({ type: 'handover', deceased: r.deceased, heir: r.heir, lines: r.log });
      }
    }
    if (stop !== 'done') return stop;
  }
  return 'done';
}

function pushProgress(c: Ctx) {
  const doy = dayOfYear(c, c.state.meta.day);
  push({ type: 'progress', day: c.state.meta.day, year: yearOf(c, c.state.meta.day), month: Math.floor(doy / 30) + 1, dayOfMonth: (doy % 30) + 1 });
}

async function runClock(c: Ctx): Promise<void> {
  let carry = 0;
  let lastSave = Date.now();
  const lines: string[] = [];
  try {
    while (playing && ctx === c) {
      carry += SPEED_DAYS_PER_SEC[speed]! / TICKS_PER_SEC;
      const days = Math.floor(carry);
      carry -= days;
      const stop = days ? step(c, days, lines) : 'done';
      if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
      pushProgress(c);
      if (stop === 'event') {
        playing = false;
        resumeAfterEvent = true;
        for (const p of pending.values()) push({ type: 'pendingEvent', event: eventView(c, p, text) });
      } else if (stop === 'gameOver') {
        playing = false;
        ended = true;
      }
      if (playing && Date.now() - lastSave > AUTOSAVE_EVERY_MS) {
        await save('autosave');
        lastSave = Date.now();
      }
      if (playing) await sleep(1000 / TICKS_PER_SEC);
    }
  } finally {
    pushClock();
    // ตระกูลสิ้นสาย → ไม่เขียนทับ autosave ด้วย state ที่เล่นต่อไม่ได้ (autosave ยังเป็นจุดก่อนตาย)
    if (!ended && ctx === c) await save('autosave');
  }
}

function play(): ClockState {
  const c = need();
  if (ended) throw new Error('ตระกูลสิ้นสายแล้ว');
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
      ended = false;
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
      ended = false;
      const saved = must(await loadState(cmd.slot), `ไม่พบเซฟ ${cmd.slot}`);
      const c = makeCtx(saved.state, must(content, 'content'));
      ctx = c;
      pending.clear();
      for (const s of saved.pending) {
        const p = restoreEvent(c, s);
        if (p) pending.set(p.instance.id, p);
      }
      return playerView(c, text);
    }
    case 'viewPending':
      return [...pending.values()].map((p) => eventView(need(), p, text)) satisfies ReplyData['viewPending'];
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
      if (!pending.size && resumeAfterEvent) play();
      return { lines } satisfies ReplyData['choose'];
    }
    case 'viewPlayer':
      return playerView(need(), text);
    case 'viewDynasty':
      return dynastyView(need());
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
