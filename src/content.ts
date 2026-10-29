import type { ContentDB, TagDef, TagId } from './core/types';

/** ประกอบ ContentDB จากไฟล์ JSON ดิบ — บนเว็บใช้ fetch, ใน Node ใช้ fs; logic ไม่ต้องรู้ */
export function buildContentDB(raw: {
  names: ContentDB['names'];
  tags: TagDef[];
  anatomy: ContentDB['anatomies'];
  traitKinds: ContentDB['traitKinds'];
  events: ContentDB['events'];
  rules: Pick<ContentDB, 'scarRules' | 'injectionRules' | 'claimTemplates' | 'history'>;
  intents: Pick<ContentDB, 'intents' | 'trades'>;
  balance: ContentDB['balance'];
}): ContentDB {
  const tags = Object.fromEntries(raw.tags.map((t) => [t.id, t])) as ContentDB['tags'];
  const known = (where: string, tag: string) => {
    if (!tag.startsWith('$') && !tags[tag as TagId]) throw new Error(`${where}: unknown tag ${tag}`);
  };
  for (const t of raw.tags) {
    for (const p of t.parents) if (!tags[p]) throw new Error(`tag ${t.id}: unknown parent ${p}`);
    for (const u of t.narrativeUpgrades ?? []) if (!tags[u]) throw new Error(`tag ${t.id}: unknown upgrade ${u}`);
    for (const i of Object.values(t.narrativeImplies ?? {})) known(`tag ${t.id} implies`, i);
  }
  // event อ้าง tag ที่ไม่มี → ปมไม่มีวันชน event นั้น แบบเงียบๆ; จับตั้งแต่โหลด content
  for (const ev of Object.values(raw.events)) {
    for (const tag of ev.contextTags) known(`event ${ev.id}`, tag);
    for (const p of ev.percepts) known(`event ${ev.id} percept`, p.tag);
    for (const v of Object.values(ev.variables ?? {})) for (const tag of v.oneOf) known(`event ${ev.id} variable`, tag);
    for (const o of ev.options) for (const tag of o.tags ?? []) known(`event ${ev.id} option ${o.id}`, tag);
  }
  for (const def of Object.values(raw.intents.intents)) {
    for (const id of [def.success, def.failure, ...def.midEvents.map((m) => m.event)]) {
      if (!raw.events[id]) throw new Error(`intent ${def.id}: unknown event ${id}`);
    }
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
    intents: raw.intents.intents,
    trades: raw.intents.trades,
    balance: raw.balance,
  };
}
