import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Static build ล้วน: dist/ = index.html + assets/*.js (main + worker chunk) + content/*.json + art/
// ไม่มี SSR ไม่มี api/ จึงเสิร์ฟจาก static host ได้ทั้งหมด
// GitHub Pages เสิร์ฟใต้ /dynasty-sim-core/ → workflow pages.yml ตั้ง BASE_PATH ให้ (ที่อื่นใช้ /)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev'; // build นอก git (zip ที่ดาวน์โหลดมา)
  }
})();

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_HASH__: JSON.stringify(gitHash),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
});
