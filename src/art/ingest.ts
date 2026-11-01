// npm run art:ingest
// ภาพที่คัดแล้ว (art/generated/<id>.* หรือภาพชั่วคราวใน source) → public/art/<id>.webp กว้าง 1024 px
// แล้วเขียน public/art/manifest.json ที่เกมโหลด (art/README.md ข้อ 7.5)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import type { ArtImage, ArtManifest } from './select';
import { findGenerated, loadSpec } from './spec';

const WIDTH = 1024;
const root = process.cwd();
const outDir = join(root, 'public', 'art');
mkdirSync(outDir, { recursive: true });
const style = JSON.parse(readFileSync(join(root, 'art', 'style.json'), 'utf8')) as { version: string };

const images: ArtImage[] = [];
const missing: string[] = [];
for (const img of loadSpec(root).images) {
  const from = findGenerated(root, img.id) ?? (img.source && existsSync(join(root, img.source)) ? join(root, img.source) : null);
  if (!from) {
    missing.push(img.id);
    continue;
  }
  const file = `art/${img.id}.webp`;
  const info = await sharp(from).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(root, 'public', file));
  images.push({ id: img.id, file, style: img.style, tags: img.tags, alt: img.alt, width: info.width, height: info.height });
  console.log(`  ${img.id} ← ${from.slice(root.length + 1)} (${Math.round(info.size / 1024)} KB)`);
}

// ภาพที่ถูกเอาออกจาก spec → ลบ webp ที่ค้างอยู่
const keep = new Set(images.map((i) => `${i.id}.webp`));
for (const f of readdirSync(outDir)) if (f.endsWith('.webp') && !keep.has(f)) rmSync(join(outDir, f));

const manifest: ArtManifest = { styleVersion: style.version, images };
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`public/art/manifest.json: ${images.length} ภาพ · ยังไม่มีภาพ ${missing.length}: ${missing.join(', ')}`);
