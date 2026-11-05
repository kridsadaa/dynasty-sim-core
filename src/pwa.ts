// ติดตั้งหน้าเว็บเป็นแอป (PWA) — ลงทะเบียน service worker และจับจังหวะที่เบราว์เซอร์ยอมให้ติดตั้ง
// ส่วน UI (หน้าต่างแนะนำ ปุ่มในหน้า "เกี่ยวกับ") อยู่ใน main.ts

/** event ของ Chromium (Chrome/Edge/Android) — ยังไม่อยู่ใน lib.dom ของ TypeScript */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** เปิดจากแอปที่ติดตั้งแล้ว (ไม่ใช่แท็บเบราว์เซอร์ปกติ) */
export const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad — Safari ไม่มีปุ่มติดตั้งอัตโนมัติ ต้องสอนให้กด "เพิ่มไปยังหน้าจอโฮม" เอง */
export const isIOS = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = (): boolean => deferred !== null;

/** ยังควรเสนอให้ติดตั้งอยู่ไหม: ไม่ได้เปิดจากแอป และเพิ่งติดตั้งไปในหน้านี้ไม่ได้ */
export const installOffered = (installedBefore: boolean): boolean =>
  !isStandalone() && !installedNow && (deferred !== null || isIOS() || !installedBefore);

/** เรียกกล่องติดตั้งของเบราว์เซอร์ — คืน true ถ้าผู้เล่นกดติดตั้ง */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null; // ใช้ได้ครั้งเดียว
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  notify();
  return outcome === 'accepted';
}

/**
 * เริ่มระบบ PWA — onAvailable ถูกเรียกเมื่อเบราว์เซอร์พร้อมให้ติดตั้ง (หรือทันทีบน iOS),
 * onInstalled เมื่อติดตั้งเสร็จ, onChange เมื่อสถานะเปลี่ยน (ใช้วาดปุ่มใหม่)
 */
export function initPwa(opts: { version: string; onAvailable: () => void; onInstalled: () => void; onChange?: () => void }): void {
  if (opts.onChange) listeners.add(opts.onChange);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // ไม่ให้แถบของเบราว์เซอร์เด้งเอง — เราเสนอผ่านหน้าต่างของเกม
    deferred = e as BeforeInstallPromptEvent;
    notify();
    opts.onAvailable();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    opts.onInstalled();
    notify();
  });
  if (isIOS() && !isStandalone()) queueMicrotask(opts.onAvailable);

  // dev server ไม่ใช้ SW — กันแคชค้างตอนแก้โค้ด
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(opts.version)}`, { scope: import.meta.env.BASE_URL })
        .catch(() => undefined); // ไม่มี SW ก็ยังเล่นได้ตามปกติ
    });
  }
}
