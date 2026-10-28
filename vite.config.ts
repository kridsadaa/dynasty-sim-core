import { defineConfig } from 'vite';

// Static build ล้วน: dist/ = index.html + assets/*.js (main + worker chunk) + content/*.json
// ไม่มี SSR, ไม่มี api/ → Vercel เสิร์ฟจาก CDN ทั้งหมด, Function Invocations = 0
export default defineConfig({
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
