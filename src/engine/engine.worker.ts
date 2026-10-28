import { buildContentDB } from '../content';
import { makeCtx, commitRng, must, yearOf, type Ctx } from '../core/ctx';
import type { ContentDB } from '../core/types';
import { chooseOption, restoreEvent, snapshotEvent, type PreparedEvent } from '../systems/events';
import { emptyState } from '../systems/factory';
import { heirCandidates, performHandover } from '../systems/handover';
import { bootstrapScenario } from '../systems/scenario';
import { describeTrait } from '../systems/traits';
import { advanceDay } from '../systems/world';
import { deleteSlot, listSlots, loadState, saveState } from './persistence';
import type { Command, Push, ReplyData, Request, StopReason, WorkerMessage } from './protocol';
import { dynastyView, eventView, playerView, type TextTable } from './views';

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
let running = false;
let pauseRequested = false;
let sessionLock: Promise<void> | null = null;

const CONTENT_FILES = ['tags', 'anatomy', 'traitKinds', 'events', 'rules', 'balance', 'names', 'text.th'] as const;

const contentReady = (async () => {
  const base = `${import.meta.env.BASE_URL}content/`;
  const [tags, anatomy, traitKinds, events, rules, balance, names, th] = await Promise.all(
    CONTENT_FILES.map((f) => fetch(`${base}${f}.json`).then((r) => {
      if (!r.ok) throw new Error(`โหลด content ${f} ไม่ได้ (${r.status})`);
      return r.json();
    })),
  );
  content = buildContentDB({ tags, anatomy, traitKinds, events, rules, balance, names });
  text = th;
  push({ type: 'ready' });
})();
// โหลด content ไม่ได้ → แจ้ง UI ทันที (ไม่งั้นสถานะค้าง "กำลังโหลด…") — ทุก command จะ reject ด้วย error เดียวกัน
contentReady.catch((err: unknown) =>
  push({ type: 'error', message: `เริ่มเกมไม่ได้: ${err instanceof Error ? err.message : String(err)}` }),
);

const need = (): Ctx => must(ctx, 'ยังไม่ได้เริ่มเกม');
const yieldNow = () => new Promise<void>((r) => setTimeout(r, 0));

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

async function advance(days: number): Promise<ReplyData['advance']> {
  const c = need();
  if (pending.size) throw new Error('มีเหตุการณ์รอการตัดสินใจ');
  running = true;
  pauseRequested = false;
  let stoppedBy: StopReason = 'done';
  const lines: string[] = [];
  const flush = () => {
    if (lines.length) push({ type: 'log', year: yearOf(c, c.state.meta.day), lines: lines.splice(0) });
  };
  try {
    for (let i = 0; i < days && stoppedBy === 'done'; i++) {
      for (const sig of advanceDay(c)) {
        if (sig.type === 'log') lines.push(sig.line);
        else if (sig.type === 'event') {
          pending.set(sig.prepared.instance.id, sig.prepared);
          stoppedBy = 'event';
        } else {
          const dead = must(c.state.characters[c.state.meta.playerCharacterId], 'player');
          if (!heirCandidates(c, dead).length) {
            lines.push(`${dead.name} สิ้นชีวิตโดยไม่มีทายาท — ตระกูลสิ้นสาย`);
            stoppedBy = 'gameOver';
            break;
          }
          flush();
          const r = performHandover(c, dead.id);
          push({ type: 'handover', deceased: r.deceased, heir: r.heir, lines: r.log });
        }
      }
      // แบ่งงานเป็นก้อน 30 วัน แล้วคืน event loop → รับคำสั่ง pause และส่ง progress ได้
      if (i % 30 === 29) {
        flush();
        push({ type: 'progress', day: c.state.meta.day, year: yearOf(c, c.state.meta.day) });
        await yieldNow();
        if (pauseRequested && stoppedBy === 'done') stoppedBy = 'paused';
      }
    }
  } finally {
    running = false;
    flush();
  }
  for (const p of pending.values()) push({ type: 'pendingEvent', event: eventView(c, p, text) });
  // ตระกูลสิ้นสาย → ไม่เขียนทับ autosave ด้วย state ที่เล่นต่อไม่ได้ (autosave ยังเป็นจุดก่อนตาย)
  if (stoppedBy !== 'gameOver') await save('autosave');
  return { stoppedBy, day: c.state.meta.day };
}

const ALLOWED_WHILE_RUNNING = new Set<Command['type']>(['pause', 'viewPlayer', 'viewDynasty', 'viewPending', 'listSaves']);

async function handle(cmd: Command): Promise<unknown> {
  await contentReady;
  // เช็คหลัง await: คำสั่งที่ส่งมาก่อน content พร้อมจะถูกปล่อยพร้อมกัน — advance ตัวแรกตั้ง running แบบ sync ก่อนตัวถัดไปมาถึงบรรทัดนี้
  if (running && !ALLOWED_WHILE_RUNNING.has(cmd.type)) throw new Error('กำลังจำลองอยู่ — กดหยุดก่อน');
  switch (cmd.type) {
    case 'newGame': {
      await acquireSessionLock();
      ctx = makeCtx(emptyState(cmd.seed), must(content, 'content'));
      bootstrapScenario(ctx, cmd.heroName);
      pending.clear();
      return playerView(ctx, text);
    }
    case 'load': {
      await acquireSessionLock();
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
    case 'advance':
      return advance(cmd.days);
    case 'pause':
      pauseRequested = true;
      return null;
    case 'choose': {
      const c = need();
      const p = must(pending.get(cmd.instanceId), 'event นี้ไม่ได้รออยู่');
      const rep = chooseOption(c, p, cmd.optionId);
      pending.delete(cmd.instanceId);
      const lines = rep.trauma.flatMap((t) =>
        t.branches.map((b) => `ฝังใจ: ${describeTrait(c, must(c.state.traits[b.traitId], 'trait'))}`),
      );
      if (rep.wounds.length) lines.unshift(`บาดเจ็บ ${rep.wounds.length} แห่ง`);
      return { lines } satisfies ReplyData['choose'];
    }
    case 'viewPlayer':
      return playerView(need(), text);
    case 'viewDynasty':
      return dynastyView(need());
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
