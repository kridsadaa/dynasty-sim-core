// npm run lore:check [-- --strict]
// ตรวจความถูกต้องของคลัง lore/ และการเชื่อมโยงกับ content ของเกม — error ทำให้ build ล้ม, warning ไม่ล้ม (ยกเว้น --strict)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TagDef } from '../core/types';
import { APPLIES_AS, LORE_DOMAINS, LORE_STATUSES, SOURCE_KINDS, type AnachronismRule, type LoreConfig, type LoreEntry, type Source, type YearRange } from './types';

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
const isRange = (r: unknown): r is YearRange => Array.isArray(r) && r.length === 2 && r.every((y) => typeof y === 'number' && Number.isFinite(y));
// ตรวจค่า enum ตอนรัน — สะกดผิด (เช่น "Attested") จะหลบกฎของค่าที่ถูกโดยไม่มีใครรู้
function oneOf(at: string, field: string, value: unknown, allowed: readonly string[], optional = false) {
  if (value === undefined && optional) return;
  if (typeof value !== 'string' || !allowed.includes(value)) errors.push(`${at}: ${field} = ${JSON.stringify(value)} ไม่ใช่ค่าที่รู้จัก (${allowed.join(' | ')})`);
}
const game = config.gamePeriod;

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
  oneOf(s.id, 'kind', s.kind, SOURCE_KINDS);
  if (!isRange(s.describesPeriod)) errors.push(`${s.id}: describesPeriod ต้องเป็น [ปีเริ่ม, ปีจบ]`);
  else if (s.describesPeriod[0] > s.describesPeriod[1]) errors.push(`${s.id}: describesPeriod กลับด้าน`);
  if (s.composedYear !== undefined && typeof s.composedYear !== 'number') errors.push(`${s.id}: composedYear ต้องเป็นตัวเลข`);
  if (s.kind === 'visual' && !s.license) warnings.push(`${s.id}: แหล่งภาพยังไม่ระบุ license`);
  // ไม่มีปีที่เขียน/ชำระ → ตรวจยุคเหลื่อมไม่ได้เลย (ข้อ 3 ของหลักการคลังข้อมูล)
  if ((s.kind === 'primary' || s.kind === 'visual') && s.composedYear === undefined) {
    warnings.push(`${s.id}: เอกสาร${s.kind === 'primary' ? 'ชั้นต้น' : 'ภาพ'}ไม่ระบุ composedYear — ตรวจยุคเหลื่อมไม่ได้`);
  }
}

// ---------- entries ----------
dupes(entries.map((e) => e.id), 'lore entry');
const entryIds = new Set(entries.map((e) => e.id));
const tagIds = new Set(tags.map((t) => t.id));
/** รายการที่ใช้เป็นข้อเท็จจริงแต่ช่วงเวลาอยู่นอกยุคของเกมทั้งหมด — รวมตาม period เพื่อไม่ให้รายงานยาวเกิน */
const outsideGame = new Map<string, string[]>();
for (const e of entries) {
  const at = `${e.file} › ${e.id}`;
  oneOf(at, 'domain', e.domain, LORE_DOMAINS);
  oneOf(at, 'status', e.status, LORE_STATUSES);
  oneOf(at, 'appliesAs', e.appliesAs, APPLIES_AS, true);
  if (typeof e.verified !== 'boolean') errors.push(`${at}: verified ต้องเป็น true/false (ได้ ${JSON.stringify(e.verified)})`);
  if (typeof e.id !== 'string' || !e.id.startsWith(`${e.domain}.`)) errors.push(`${at}: id ต้องขึ้นต้นด้วย "${e.domain}."`);
  const hasPeriod = isRange(e.period);
  if (!hasPeriod) errors.push(`${at}: period ต้องเป็น [ปีเริ่ม, ปีจบ]`);
  else if (e.period[0] > e.period[1]) errors.push(`${at}: period กลับด้าน`);
  if (e.status === 'invented' && !e.rationale) errors.push(`${at}: ข้อมูลที่แต่งขึ้นต้องมี rationale`);
  if (!Array.isArray(e.citations)) errors.push(`${at}: ไม่มีฟิลด์ citations (ใส่ [] ได้ถ้าเป็น invented)`);
  const citations = Array.isArray(e.citations) ? e.citations : [];
  if (e.status !== 'invented' && citations.length === 0) errors.push(`${at}: ${e.status} ต้องมีแหล่งอ้างอิงอย่างน้อย 1`);
  if (e.verified !== true) warnings.push(`${at}: ยังไม่ได้ตรวจกับเอกสารจริง (verified: false)${e.aiCheck ? ` — AI เทียบแล้ว: ${e.aiCheck.result}${e.aiCheck.fixed ? ' (แก้แล้ว)' : ''}` : ''}`);
  if (e.aiCheck) oneOf(at, 'aiCheck.result', e.aiCheck.result, ['supported', 'partial', 'contradicted', 'unreachable'] as const);
  if (e.aiCheck?.result === 'contradicted' && !e.aiCheck.fixed && !e.verified) warnings.push(`${at}: AI พบว่าต้นฉบับขัดกับรายการนี้ — ต้องแก้หรือให้คนตรวจก่อนใช้`);
  if (!hasPeriod) continue; // กฎด้านล่างอิง period ทั้งหมด
  const appliesAs = e.appliesAs ?? 'fact';
  // ข้อเท็จจริงจากยุคอื่นใช้ในฉากของเกมตรงๆ ไม่ได้ — ต้องอนุมานต่อ (projection) หรือย้ายไปเป็น pattern/mechanic
  if ((e.status === 'attested' || appliesAs === 'fact') && !e.projection && !overlaps(e.period, game)) {
    const k = e.period.join('–');
    outsideGame.set(k, [...(outsideGame.get(k) ?? []), e.id]);
  }
  // attested ต้องมีหลักฐานที่ "เขียนขึ้น" ใกล้ยุคนั้น — describesPeriod ของงานสมัยใหม่ครอบคลุมได้เสมอจึงใช้แทนไม่ได้
  const composedInWindow = (s: Source | undefined) => s?.composedYear !== undefined && s.composedYear <= e.period[1] + config.lateCompilationWarnYears;
  if (e.status === 'attested' && citations.length > 0 && !citations.some((c) => composedInWindow(sourceById.get(c.sourceId)))) {
    warnings.push(`${at}: attested แต่ไม่มีแหล่งใดเขียน/ชำระภายใน ${config.lateCompilationWarnYears} ปีหลังช่วง ${e.period.join('–')} (หรือไม่ทราบปี) — หลักฐานร่วมยุคจริงอยู่ไหน`);
  }
  for (const c of citations) {
    const s = sourceById.get(c.sourceId);
    if (!s) {
      errors.push(`${at}: ไม่พบแหล่ง ${c.sourceId}`);
      continue;
    }
    if (typeof c.locator !== 'string' || /todo/i.test(c.locator)) warnings.push(`${at}: ยังไม่ระบุตำแหน่งใน ${s.id}`);
    if (isRange(s.describesPeriod) && !overlaps(e.period, s.describesPeriod)) {
      const msg = `${at}: ${s.id} บรรยายช่วง ${s.describesPeriod.join('–')} ไม่ครอบคลุม ${e.period.join('–')}`;
      if (s.kind === 'ethnographic') {
        // งานภาคสนามต่างยุค: ใช้ได้เฉพาะเป็นแบบแผน/กลไก และต้องอธิบายการอนุมาน
        if (e.status === 'attested') errors.push(`${msg} — งานภาคสนามต่างยุคต้องเป็น inferred`);
        if (appliesAs === 'fact') errors.push(`${msg} — งานภาคสนามต่างยุคต้องตั้ง appliesAs เป็น pattern หรือ mechanic`);
        if (!e.projection) errors.push(`${msg} — ต้องมี projection อธิบายว่าทำไมอนุมานย้อนได้`);
      } else if (e.status === 'attested') {
        // attested ต้องมีหลักฐานร่วมยุค
        errors.push(msg);
      } else if (!e.projection) {
        // inferred อนุมานจากเอกสารต่างยุคได้ แต่ควรเขียนเหตุผลไว้
        warnings.push(msg);
      }
    }
    // งานสมัยใหม่ (secondary/ethnographic) เขียนทีหลังเสมอ — เตือนเฉพาะเอกสารชั้นต้น/ภาพที่ชำระทีหลัง
    if ((s.kind === 'primary' || s.kind === 'visual') && s.composedYear !== undefined && s.composedYear > e.period[1] + config.lateCompilationWarnYears) {
      warnings.push(`${at}: ${s.id} เขียน/ชำระ พ.ศ. ${s.composedYear} หลังช่วงข้อมูลเกิน ${config.lateCompilationWarnYears} ปี — ระวังยุคเหลื่อม`);
    }
  }
  for (const t of e.gameRefs?.tags ?? []) if (!tagIds.has(t)) errors.push(`${at}: gameRefs อ้าง tag ที่ไม่มี: ${t}`);
}
for (const [period, ids] of outsideGame) {
  warnings.push(`period ${period} อยู่นอก gamePeriod ${game.join('–')} ทั้งหมด แต่ใช้เป็น fact/attested ไม่มี projection (${ids.length} รายการ): ${ids.join(', ')}`);
}

// ---------- content → lore ----------
for (const t of tags) {
  for (const ref of t.loreRefs ?? []) if (!entryIds.has(ref)) errors.push(`tags.json › ${t.id}: loreRefs อ้าง ${ref} ที่ไม่มี`);
}
// อ้างกันสองทาง (lore/README ข้อ 4): tag.loreRefs ↔ entry.gameRefs.tags
const tagsOfEntry = new Map(entries.map((e) => [e.id, new Set(e.gameRefs?.tags ?? [])]));
const entriesOfTag = new Map(tags.map((t) => [t.id, new Set(t.loreRefs ?? [])]));
for (const t of tags) {
  for (const ref of t.loreRefs ?? []) {
    if (entryIds.has(ref) && !tagsOfEntry.get(ref)?.has(t.id)) warnings.push(`tags.json › ${t.id}: อ้าง ${ref} แต่รายการนั้นไม่อ้าง tag นี้กลับใน gameRefs`);
  }
}
for (const e of entries) {
  for (const t of e.gameRefs?.tags ?? []) {
    if (tagIds.has(t) && !entriesOfTag.get(t)?.has(e.id)) warnings.push(`${e.file} › ${e.id}: gameRefs อ้าง ${t} แต่ tag ไม่อ้างกลับใน loreRefs`);
  }
}

// ---------- art → lore ----------
// style.json / manifest.json อ้าง lore ได้ทุกระดับชั้น → เดินทั้งต้นไม้หา loreRefs
function walkLoreRefs(at: string, v: unknown): void {
  if (Array.isArray(v)) v.forEach((x, i) => walkLoreRefs(`${at}[${i}]`, x));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'loreRefs' && Array.isArray(x)) {
        for (const ref of x) if (!entryIds.has(ref)) errors.push(`${at}: loreRefs อ้าง ${ref} ที่ไม่มี`);
      } else walkLoreRefs(`${at}.${k}`, x);
    }
  }
}
const manifest = readJson<{ images: Array<{ file: string; promptRef?: string }> }>('art', 'approved', 'manifest.json');
walkLoreRefs('art/style.json', readJson('art', 'style.json'));
walkLoreRefs('art/approved/manifest.json', manifest);

/** anchor ของหัวข้อแบบ GitHub: ตัวเล็ก ตัดเครื่องหมายวรรคตอน เว้นวรรค → "-" */
const slug = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
for (const img of manifest.images) {
  if (!img.promptRef) continue;
  const [file, anchor] = img.promptRef.split('#');
  let md: string;
  try {
    md = readFileSync(join(root, file!), 'utf8');
  } catch {
    errors.push(`manifest › ${img.file}: promptRef ชี้ไฟล์ที่ไม่มี ${file}`);
    continue;
  }
  const anchors = new Set(md.split(/\r?\n/).filter((l) => /^#{1,6} /.test(l)).map((l) => slug(l.replace(/^#+ /, ''))));
  if (anchor && !anchors.has(anchor)) {
    errors.push(`manifest › ${img.file}: ไม่มีหัวข้อ #${anchor} ใน ${file}`);
  }
}

// ---------- loreRefs ของชั้นยุค (rules.json › eras/institutions) และของ event ----------
{
  const rules = readJson<{ eras?: Array<{ id: string; loreRefs?: string[] }>; institutions?: Record<string, { loreRefs?: string[] }> }>('public', 'content', 'rules.json');
  const refs: Array<[string, string[] | undefined]> = [
    ...(rules.eras ?? []).map((e): [string, string[] | undefined] => [`rules.json › eras › ${e.id}`, e.loreRefs]),
    ...Object.entries(rules.institutions ?? {}).filter(([k]) => !k.startsWith('_')).map(([k, v]): [string, string[] | undefined] => [`rules.json › institutions › ${k}`, v.loreRefs]),
    ...Object.values(readJson<Record<string, { id: string; loreRefs?: string[] }>>('public', 'content', 'events.json')).map((d): [string, string[] | undefined] => [`events.json › ${d.id}`, d.loreRefs]),
  ];
  for (const [at, ids] of refs) for (const id of ids ?? []) if (!entryIds.has(id)) errors.push(`${at}: loreRef ${id} ไม่มี`);
}

// ---------- anachronism lint ----------
// ช่วงปีที่ข้อความถูกใช้ (ชั้นยุค docs/design-eras.md): event ที่มีเงื่อนไข 'year' ใน trigger.requires หรือถูกนัดปีใน historyEvents
// ตรวจกับช่วงนั้นแทนทั้งเกม — event หลัง 2456 ใช้คำว่า "นามสกุล" ได้ ส่วนข้อความอื่นตรวจกับทั้งเกมเหมือนเดิม
type EventLite = { id: string; textKey: string; trigger?: { requires?: Array<{ type: string; min?: number; max?: number }> } };
const eventDefs = Object.values(readJson<Record<string, EventLite>>('public', 'content', 'events.json'));
const scheduled = readJson<{ historyEvents?: Array<{ year: number; event: string }> }>('public', 'content', 'rules.json').historyEvents ?? [];
const windowOf = new Map<string, YearRange>();
for (const d of eventDefs) {
  const years = scheduled.filter((h) => h.event === d.id).map((h) => h.year);
  const cond = d.trigger?.requires?.find((c) => c.type === 'year');
  const w: YearRange | undefined = years.length ? [Math.min(...years), Math.max(...years)]
    : cond ? [Math.max(game[0], cond.min ?? game[0]), Math.min(game[1], cond.max ?? game[1])] : undefined;
  if (w) windowOf.set(d.textKey, w);
}
const textWindow = (key: string): YearRange => {
  for (let k = key; k.includes('.'); k = k.slice(0, k.lastIndexOf('.'))) {
    const w = windowOf.get(k);
    if (w) return w;
  }
  return game;
};
for (const rule of anachronisms) {
  if (rule.loreRef && !entryIds.has(rule.loreRef)) errors.push(`anachronisms › "${rule.term}": loreRef ${rule.loreRef} ไม่มี`);
  const valid: YearRange = [rule.validFrom ?? -Infinity, rule.validTo ?? Infinity];
  for (const [key, text] of Object.entries(texts)) {
    if (!text.includes(rule.term)) continue;
    const used = textWindow(key);
    if (valid[0] <= used[0] && used[1] <= valid[1]) continue;
    const msg = `text.th.json › ${key}: ใช้ "${rule.term}" (ข้อความใช้ช่วง ${used.join('–')}) — ${rule.note}`;
    (overlaps(valid, used) ? warnings : errors).push(msg);
  }
}

// ---------- report ----------
const byDomain = new Map<string, { total: number; verified: number; ai: number }>();
for (const e of entries) {
  const d = byDomain.get(e.domain) ?? { total: 0, verified: 0, ai: 0 };
  d.total++;
  if (e.verified) d.verified++;
  if (e.verified && e.aiCheck) d.ai++;
  byDomain.set(e.domain, d);
}
console.log(`lore: ${sources.length} แหล่ง, ${entries.length} รายการ, ${anachronisms.length} กฎ anachronism`);
console.log(`slice ปัจจุบัน: ${config.currentSlice.label} (พ.ศ. ${config.currentSlice.period.join('–')})`);
for (const [d, c] of byDomain) console.log(`  ${d.padEnd(9)} ${c.verified}/${c.total} verified${c.ai ? ` (AI ${c.ai})` : ''}`);
const ai = new Map<string, number>();
for (const e of entries) if (e.aiCheck) ai.set(e.aiCheck.result, (ai.get(e.aiCheck.result) ?? 0) + 1);
if (ai.size) console.log(`  AI เทียบต้นฉบับแล้ว ${[...ai.values()].reduce((a, b) => a + b, 0)}/${entries.length}: ${[...ai].map(([k, n]) => `${k} ${n}`).join(', ')}`);
const byUse = new Map<string, number>();
for (const e of entries) byUse.set(e.appliesAs ?? 'fact', (byUse.get(e.appliesAs ?? 'fact') ?? 0) + 1);
console.log(`  ใช้เป็น: ${[...byUse].map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.log(`  ✖ ${e}`);

const strict = process.argv.includes('--strict');
if (errors.length || (strict && warnings.length)) {
  console.log(`\nล้มเหลว: ${errors.length} error, ${warnings.length} warning${strict ? ' (strict)' : ''}`);
  process.exit(1);
}
console.log(`\nผ่าน (${warnings.length} warning)`);
