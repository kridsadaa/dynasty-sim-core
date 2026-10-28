// npm run lore:check [-- --strict]
// ตรวจความถูกต้องของคลัง lore/ และการเชื่อมโยงกับ content ของเกม — error ทำให้ build ล้ม, warning ไม่ล้ม (ยกเว้น --strict)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TagDef } from '../core/types';
import type { AnachronismRule, LoreConfig, LoreEntry, Source, YearRange } from './types';

const root = process.cwd();
const readJson = <T>(...p: string[]): T => JSON.parse(readFileSync(join(root, ...p), 'utf8')) as T;

const config = readJson<LoreConfig>('lore', 'config.json');
const sources = readJson<Source[]>('lore', 'sources.json');
const entries = readdirSync(join(root, 'lore', 'entries'))
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => readJson<LoreEntry[]>('lore', 'entries', f).map((e) => ({ ...e, file: f })));
const anachronisms = readJson<AnachronismRule[]>('lore', 'anachronisms.json');
const tags = readJson<Array<TagDef & { loreRefs?: string[] }>>('public', 'content', 'tags.json');
const texts = readJson<Record<string, string>>('public', 'content', 'text.th.json');

const errors: string[] = [];
const warnings: string[] = [];
const overlaps = (a: YearRange, b: YearRange) => a[0] <= b[1] && b[0] <= a[1];

function dupes(ids: string[], what: string) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`${what} id ซ้ำ: ${id}`);
    seen.add(id);
  }
}

// ---------- sources ----------
dupes(sources.map((s) => s.id), 'source');
const sourceById = new Map(sources.map((s) => [s.id, s]));
for (const s of sources) {
  if (!s.id.startsWith('src.')) errors.push(`${s.id}: source id ต้องขึ้นต้นด้วย "src."`);
  if (s.describesPeriod[0] > s.describesPeriod[1]) errors.push(`${s.id}: describesPeriod กลับด้าน`);
  if (s.kind === 'visual' && !s.license) warnings.push(`${s.id}: แหล่งภาพยังไม่ระบุ license`);
}

// ---------- entries ----------
dupes(entries.map((e) => e.id), 'lore entry');
const entryIds = new Set(entries.map((e) => e.id));
const tagIds = new Set(tags.map((t) => t.id));
for (const e of entries) {
  const at = `${e.file} › ${e.id}`;
  if (!e.id.startsWith(`${e.domain}.`)) errors.push(`${at}: id ต้องขึ้นต้นด้วย "${e.domain}."`);
  if (e.period[0] > e.period[1]) errors.push(`${at}: period กลับด้าน`);
  if (e.status === 'invented' && !e.rationale) errors.push(`${at}: ข้อมูลที่แต่งขึ้นต้องมี rationale`);
  if (e.status !== 'invented' && e.citations.length === 0) errors.push(`${at}: ${e.status} ต้องมีแหล่งอ้างอิงอย่างน้อย 1`);
  if (!e.verified) warnings.push(`${at}: ยังไม่ได้ตรวจกับเอกสารจริง (verified: false)`);
  for (const c of e.citations) {
    const s = sourceById.get(c.sourceId);
    if (!s) {
      errors.push(`${at}: ไม่พบแหล่ง ${c.sourceId}`);
      continue;
    }
    if (/todo/i.test(c.locator)) warnings.push(`${at}: ยังไม่ระบุตำแหน่งใน ${s.id}`);
    if (!overlaps(e.period, s.describesPeriod)) {
      // attested ต้องมีหลักฐานร่วมยุค; inferred อนุมานจากเอกสารต่างยุคได้ แต่ต้องรู้ตัว
      const msg = `${at}: ${s.id} บรรยายช่วง ${s.describesPeriod.join('–')} ไม่ครอบคลุม ${e.period.join('–')}`;
      (e.status === 'attested' ? errors : warnings).push(msg);
    }
    if (s.composedYear !== undefined && s.composedYear > e.period[1] + config.lateCompilationWarnYears) {
      warnings.push(`${at}: ${s.id} เขียน/ชำระ พ.ศ. ${s.composedYear} หลังช่วงข้อมูลเกิน ${config.lateCompilationWarnYears} ปี — ระวังยุคเหลื่อม`);
    }
  }
  for (const t of e.gameRefs?.tags ?? []) if (!tagIds.has(t)) errors.push(`${at}: gameRefs อ้าง tag ที่ไม่มี: ${t}`);
}

// ---------- content → lore ----------
for (const t of tags) {
  for (const ref of t.loreRefs ?? []) if (!entryIds.has(ref)) errors.push(`tags.json › ${t.id}: loreRefs อ้าง ${ref} ที่ไม่มี`);
}

// ---------- anachronism lint ----------
const game = config.gamePeriod;
for (const rule of anachronisms) {
  if (rule.loreRef && !entryIds.has(rule.loreRef)) errors.push(`anachronisms › "${rule.term}": loreRef ${rule.loreRef} ไม่มี`);
  const valid: YearRange = [rule.validFrom ?? -Infinity, rule.validTo ?? Infinity];
  const fullyValid = valid[0] <= game[0] && game[1] <= valid[1];
  if (fullyValid) continue;
  for (const [key, text] of Object.entries(texts)) {
    if (!text.includes(rule.term)) continue;
    const msg = `text.th.json › ${key}: ใช้ "${rule.term}" — ${rule.note}`;
    (overlaps(valid, game) ? warnings : errors).push(msg);
  }
}

// ---------- report ----------
const byDomain = new Map<string, { total: number; verified: number }>();
for (const e of entries) {
  const d = byDomain.get(e.domain) ?? { total: 0, verified: 0 };
  d.total++;
  if (e.verified) d.verified++;
  byDomain.set(e.domain, d);
}
console.log(`lore: ${sources.length} แหล่ง, ${entries.length} รายการ, ${anachronisms.length} กฎ anachronism`);
console.log(`slice ปัจจุบัน: ${config.currentSlice.label} (พ.ศ. ${config.currentSlice.period.join('–')})`);
for (const [d, c] of byDomain) console.log(`  ${d.padEnd(9)} ${c.verified}/${c.total} verified`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✖ ${e}`);

const strict = process.argv.includes('--strict');
if (errors.length || (strict && warnings.length)) {
  console.log(`\nล้มเหลว: ${errors.length} error, ${warnings.length} warning${strict ? ' (strict)' : ''}`);
  process.exit(1);
}
console.log(`\nผ่าน (${warnings.length} warning)`);
