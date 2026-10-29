// npm run lore:compile
// แปลงข้อมูลใน lore/ ที่ระบบเกมต้องใช้ ให้เป็นไฟล์ content (generated — ห้ามแก้มือ)
//   naming (claim.kind = 'nameList') → public/content/names.json
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NamePool } from '../core/types';
import type { LoreEntry, NameListClaim } from './types';

const root = process.cwd();
const entries = readdirSync(join(root, 'lore', 'entries'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(root, 'lore', 'entries', f), 'utf8')) as LoreEntry[]);

const isNameList = (c: Record<string, unknown>): c is NameListClaim & Record<string, unknown> => c.kind === 'nameList';

const pool: NamePool = { generatedFrom: [], names: [] };
const seen = new Set<string>();
for (const e of entries) {
  // ชื่อที่แต่งขึ้นเข้าตัวสุ่มได้แต่ติดป้าย invented — pickName ใช้ชื่อที่มีในเอกสารก่อนเสมอเมื่อใช้ซ้ำเท่ากัน
  if (e.domain !== 'naming' || !isNameList(e.claim)) continue;
  pool.generatedFrom.push(e.id);
  for (const n of e.claim.names) {
    const key = `${n.name}|${n.sex ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.names.push({
      name: n.name, sex: n.sex ?? null, estates: e.estates ?? null, loreRef: e.id,
      ...(e.status === 'invented' ? { invented: true as const } : {}),
    });
  }
}

const out = join(root, 'public', 'content', 'names.json');
writeFileSync(out, JSON.stringify(pool, null, 2) + '\n');
console.log(`names.json: ${pool.names.length} ชื่อ จาก ${pool.generatedFrom.length} รายการ lore`);
