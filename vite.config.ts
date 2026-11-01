import { defineConfig } from 'vite';

// Static build ล้วน: dist/ = index.html + assets/*.js (main + worker chunk) + content/*.json + art/
// ไม่มี SSR ไม่มี api/ จึงเสิร์ฟจาก static host ได้ทั้งหมด
// GitHub Pages เสิร์ฟใต้ /dynasty-sim-core/ → workflow pages.yml ตั้ง BASE_PATH ให้ (ที่อื่นใช้ /)
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
