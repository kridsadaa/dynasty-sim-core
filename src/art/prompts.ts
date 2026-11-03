// npm run art:prompts
// ประกอบ prompt ทุกภาพใน art/assets.spec.json = STYLE (art/style.json) + SUBJECT → art/prompts.md
// ไว้คัดลอกไปสร้างใน Gemini (art/README.md ข้อ 7.5) — ตรวจว่า loreRefs มีจริง และบอกว่าภาพไหนมีแล้ว
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoreEntry } from '../lore/types';
import { findGenerated, loadSpec, type SpecImage } from './spec';

const root = process.cwd();
const style = JSON.parse(readFileSync(join(root, 'art', 'style.json'), 'utf8')) as {
  version: string;
  output: { aspectRatio: string };
  styles: Record<'reality' | 'chronicle', { prompt: string }> & { reality_late?: { prompt: string } };
  subjectRules: Array<{ id: string; rule: string }>;
};
const spec = loadSpec(root);
const lore = new Map<string, LoreEntry>();
for (const f of readdirSync(join(root, 'lore', 'entries')).filter((f) => f.endsWith('.json'))) {
  for (const e of JSON.parse(readFileSync(join(root, 'lore', 'entries', f), 'utf8')) as LoreEntry[]) lore.set(e.id, e);
}

const errors: string[] = [];
const loreLine = (refs: string[] = [], at: string) =>
  refs.map((id) => {
    const e = lore.get(id);
    if (!e) errors.push(`${at}: ไม่มี lore ${id}`);
    return `\`${id}\`${e ? ` (${e.status}${e.verified ? ', verified' : ''})` : ' ❌'}`;
  }).join(', ');

const block = (styleId: 'reality' | 'chronicle' | 'portrait', subject: string, era?: 'late') => {
  const key = styleId === 'portrait' ? 'reality' : styleId;
  const late = era === 'late' && key === 'reality' ? style.styles.reality_late : undefined;
  if (era === 'late' && key === 'reality' && !late) errors.push('มีภาพ era: late แต่ style.json ไม่มี reality_late');
  return `${(late ?? style.styles[key]).prompt}\n\n${subject}`;
};

const out: string[] = [
  '# Prompt ภาพประกอบ (สร้างจาก `npm run art:prompts` — ห้ามแก้มือ)',
  '',
  `style v${style.version} · อัตราส่วน ${style.output.aspectRatio} · สร้างภาพละ 2 ครั้งแล้วคัด`,
  '',
  'ขั้นตอน: คัดลอก prompt ไปสร้างใน Gemini → บันทึกภาพที่คัดแล้วเป็น `art/generated/<id>.jpg` (หรือ .png/.webp) → `npm run art:ingest`',
  '',
  'กฎที่ต้องตรวจก่อนรับภาพ (`art/style.json` › subjectRules):',
  ...style.subjectRules.map((r) => `- **${r.id}** — ${r.rule}`),
  '',
];

const status = (img: SpecImage) =>
  findGenerated(root, img.id) ? '✅ มีภาพแล้ว' : img.source && existsSync(join(root, img.source)) ? `🟡 ใช้ภาพชั่วคราว \`${img.source}\`` : '⬜ ยังไม่มีภาพ';

out.push('## Baseline (สร้างใหม่ด้วย style ปัจจุบัน แล้วแทนภาพใน art/approved)', '');
for (const b of spec.baseline) {
  out.push(`### ${b.id}`, '', `แทน \`${b.replaces}\` — ${b.why}`, '', `lore: ${loreLine(b.loreRefs, b.id)}`, '', '```', block('reality', b.subject), '```', '');
}
for (const [title, styleId] of [
  ['ภาพฉาก (Reality)', 'reality'],
  ['ภาพตำนาน (Chronicle)', 'chronicle'],
  ['ภาพตัวละคร (Portrait)', 'portrait'],
] as const) {
  out.push(`## ${title}`, '');
  for (const img of spec.images.filter((i) => i.style === styleId)) {
    out.push(
      `### ${img.id} — ${img.alt}`, '',
      `${status(img)} · tag: ${img.tags.map((t) => `\`${t}\``).join(' ')}`, '',
      `lore: ${loreLine(img.loreRefs, img.id)}`, '',
      '```', block(styleId, img.subject, img.era), '```', '',
    );
  }
}

if (errors.length) {
  for (const e of errors) console.error(`✖ ${e}`);
  process.exit(1);
}
writeFileSync(join(root, 'art', 'prompts.md'), out.join('\n'));
console.log(`art/prompts.md: ${spec.baseline.length} baseline + ${spec.images.length} ภาพ`);
