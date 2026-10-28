import type { ContentDB, TagDef } from './core/types';

/** ประกอบ ContentDB จากไฟล์ JSON ดิบ — บนเว็บใช้ fetch, ใน Node ใช้ fs; logic ไม่ต้องรู้ */
export function buildContentDB(raw: {
  names: ContentDB['names'];
  tags: TagDef[];
  anatomy: ContentDB['anatomies'];
  traitKinds: ContentDB['traitKinds'];
  events: ContentDB['events'];
  rules: Pick<ContentDB, 'scarRules' | 'injectionRules' | 'claimTemplates' | 'history'>;
  balance: ContentDB['balance'];
}): ContentDB {
  const tags = Object.fromEntries(raw.tags.map((t) => [t.id, t])) as ContentDB['tags'];
  for (const t of raw.tags) {
    for (const p of t.parents) if (!tags[p]) throw new Error(`tag ${t.id}: unknown parent ${p}`);
    for (const u of t.narrativeUpgrades ?? []) if (!tags[u]) throw new Error(`tag ${t.id}: unknown upgrade ${u}`);
  }
  return {
    names: raw.names,
    tags,
    anatomies: raw.anatomy,
    scarRules: raw.rules.scarRules,
    traitKinds: raw.traitKinds,
    events: raw.events,
    injectionRules: raw.rules.injectionRules,
    claimTemplates: raw.rules.claimTemplates,
    history: raw.rules.history,
    balance: raw.balance,
  };
}
