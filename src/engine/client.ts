import type { Command, Push, ReplyData, WorkerMessage } from './protocol';

/**
 * Main-thread facade — UI เรียก method แบบ promise โดยไม่รู้ว่ามี Worker อยู่ข้างหลัง
 *   const engine = new EngineClient();
 *   await engine.request({ type: 'newGame', seed: 42 });
 *   engine.onPush((p) => ...);
 */
export class EngineClient {
  private worker: Worker;
  private seq = 0;
  private waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private listeners = new Set<(p: Push) => void>();

  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data;
      if (m.kind === 'push') {
        for (const l of this.listeners) l(m.push);
        return;
      }
      const w = this.waiting.get(m.reply.id);
      if (!w) return;
      this.waiting.delete(m.reply.id);
      if (m.reply.ok) w.resolve(m.reply.data);
      else w.reject(new Error(m.reply.error));
    };
    // module worker โหลดไม่ขึ้น → ErrorEvent ไม่มี message; แจ้งทั้ง request ที่รออยู่และ UI (push 'error')
    this.worker.onerror = (e) => this.fail(e.message || 'โหลดตัวจำลองเกม (worker) ไม่ได้ — ลองรีเฟรชหน้า');
    // reply ถอด structured clone ไม่ได้ → ไม่รู้ id ว่าเป็นของ request ไหน: reject ทั้งหมดดีกว่าค้างตลอดไป
    this.worker.onmessageerror = () => this.fail('รับข้อมูลจากตัวจำลองเกมไม่ได้');
  }

  private fail(message: string): void {
    for (const w of this.waiting.values()) w.reject(new Error(message));
    this.waiting.clear();
    for (const l of this.listeners) l({ type: 'error', message });
  }

  request<T extends Command['type']>(cmd: Extract<Command, { type: T }>): Promise<ReplyData[T]> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ id, cmd });
    });
  }

  onPush(cb: (p: Push) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  terminate(): void {
    this.worker.terminate();
  }
}

/** ขอให้เบราว์เซอร์ไม่ลบ IndexedDB เองเมื่อพื้นที่เหลือน้อย (เรียกได้เฉพาะ main thread) */
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
