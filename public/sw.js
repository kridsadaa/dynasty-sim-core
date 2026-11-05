// Service worker ของหนึ่งตระกูล — ให้ติดตั้งเป็นแอปได้ และเปิดเล่นต่อได้เมื่อไม่มีเน็ต
// ลงทะเบียนจาก src/pwa.ts เป็น sw.js?v=<รุ่น> — รุ่นเปลี่ยน = SW ใหม่ = ล้างแคชรุ่นเก่า
// - assets/* (ชื่อไฟล์มี hash ไม่เปลี่ยนเนื้อหา): ใช้แคชก่อน
// - ที่เหลือ (หน้าเว็บ content art): ดึงจากเน็ตก่อน ล้มเหลวค่อยใช้แคช — ผู้เล่นได้เนื้อหาล่าสุดเสมอเมื่อออนไลน์
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `dynasty-sim-${VERSION}`;
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SCOPE.href)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dynasty-sim-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req, fallbackKey) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(fallbackKey ?? req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(fallbackKey ?? req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate') {
    // หน้าเว็บมีหน้าเดียว — เก็บไว้ที่ key ของ scope เพื่อเปิดออฟไลน์ได้ไม่ว่าจะเข้าด้วย URL ไหน
    event.respondWith(networkFirst(req, SCOPE.href));
    return;
  }
  const rel = url.pathname.slice(SCOPE.pathname.length);
  event.respondWith(rel.startsWith('assets/') ? cacheFirst(req) : networkFirst(req));
});
