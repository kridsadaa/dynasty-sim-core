// อ่าน art/assets.spec.json และหาไฟล์ภาพที่สร้างแล้ว — ใช้ร่วมกันระหว่าง art:prompts กับ art:ingest
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArtStyle } from './select';

export interface SpecImage {
  id: string;
  style: ArtStyle;
  tags: string[];
  alt: string;
  subject: string;
  loreRefs: string[];
  /** ภาพชั่วคราว (เช่น จาก art/approved) ใช้จนกว่าจะมี art/generated/<id>.* */
  source?: string;
}

export interface Spec {
  baseline: Array<{ id: string; replaces: string; why: string; subject: string; loreRefs: string[] }>;
  images: SpecImage[];
}

export function loadSpec(root: string): Spec {
  const spec = JSON.parse(readFileSync(join(root, 'art', 'assets.spec.json'), 'utf8')) as Spec;
  const ids = new Set<string>();
  for (const i of spec.images) {
    if (ids.has(i.id)) throw new Error(`assets.spec.json: id ซ้ำ ${i.id}`);
    ids.add(i.id);
  }
  return spec;
}

const EXTS = ['webp', 'png', 'jpg', 'jpeg', 'jfif'];

/** ภาพที่คัดแล้ววางไว้ที่ art/generated/<id>.<ext> */
export function findGenerated(root: string, id: string): string | null {
  for (const ext of EXTS) {
    const p = join(root, 'art', 'generated', `${id}.${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}
