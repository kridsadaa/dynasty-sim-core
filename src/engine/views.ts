import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { CapabilityId, Character, FamilyNode, Item, Parentage, Personality, Trait } from '../core/types';
import { capability } from '../systems/body';
import type { PreparedEvent } from '../systems/events';
import { RELATION_TH } from '../systems/handover';
import { renderLegend } from '../systems/legend';
import { describeTrait } from '../systems/traits';
import type { CharacterView, DynastyView, EventView, InspectView, TreeView } from './protocol';

// แปลง state → view model (plain data) ก่อนส่งข้ามเธรด

export type TextTable = Record<string, string>;

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);

const CAPS: CapabilityId[] = ['manipulation.fine', 'manipulation.gross', 'mobility', 'sight'];

/** ข้อความจากตาราง text.th — ไม่มีคีย์ให้คืนค่าดิบ (เห็นชัดว่าลืมใส่คำแปล) */
const t = (text: TextTable, prefix: string, id: string) => text[`${prefix}.${id}`] ?? id;

/** บรรทัดที่ซ้ำกันรวมเป็นบรรทัดเดียว "… ×2" (แผลเป็นแบบเดียวกันที่อวัยวะเดียวกัน) — คงลำดับที่เจอครั้งแรก */
const countSame = (lines: string[]) => {
  const n = new Map<string, number>();
  for (const l of lines) n.set(l, (n.get(l) ?? 0) + 1);
  return [...n].map(([l, k]) => (k > 1 ? `${l} ×${k}` : l));
};

const pct = (x: number) => `${Math.round(x * 100)}%`;

const estateLabel = (ctx: Ctx, estate: string) => {
  const tag = `estate:${estate}` as const;
  return ctx.tags.def(tag) ? ctx.tags.label(tag) : estate;
};

const partLabelOf = (ctx: Ctx, anatomyId: string) => (partDefId: string) =>
  ctx.content.anatomies[anatomyId]?.parts[partDefId]?.label.th ?? partDefId;

function scarLines(ctx: Ctx, ch: Character, text: TextTable): string[] {
  const partLabel = partLabelOf(ctx, ch.anatomyId);
  return countSame(ch.bodyPartIds.flatMap((pid) => {
    const p = ctx.state.bodyParts[pid];
    const label = p ? partLabel(p.partDefId) : '';
    return p ? [...p.scars.map((s) => `แผลเป็น(${t(text, 'scar.kind', s.kind)})ที่${label}`), ...(p.status === 'missing' ? [`สูญเสีย${label}`] : [])] : [];
  }));
}

function woundLines(ctx: Ctx, ch: Character, text: TextTable): string[] {
  const partLabel = partLabelOf(ctx, ch.anatomyId);
  return ch.woundIds.map((id) => ctx.state.wounds[id]).filter((w) => !!w).map((w) => `${partLabel(w!.partDefId)}: ${t(text, 'wound.stage', w!.stage)}`);
}

/** UI ไม่ควรเห็นคีย์ภายใน ("noble", "finger.index.l", "manipulation.fine") — แปลงเป็นคำไทยที่นี่ */
export function playerView(ctx: Ctx, text: TextTable = {}): CharacterView {
  const ch = must(ctx.state.characters[ctx.state.meta.playerCharacterId], 'player');
  return {
    name: ch.name,
    nodeId: ch.familyNodeId,
    age: ageOf(ctx, ch),
    year: yearOf(ctx, ctx.state.meta.day),
    estate: estateLabel(ctx, ch.social.estate),
    title: ch.social.title,
    wealth: Math.round(ch.social.wealth),
    traits: ch.traitIds.map((id) => ctx.state.traits[id]).filter((t) => !!t && !t.latent).map((t) => describeTrait(ctx, t!)),
    scars: scarLines(ctx, ch, text),
    wounds: woundLines(ctx, ch, text),
    // คีย์เป็นคำไทยเพราะ UI แสดงคีย์ตรงๆ
    capabilities: Object.fromEntries(CAPS.map((c) => [t(text, 'capability', c), Math.round(capability(ctx, ch, c) * 100) / 100])),
  };
}

export function dynastyView(ctx: Ctx): DynastyView {
  const dyn = must(ctx.state.dynasties[ctx.state.meta.playerDynastyId], 'dynasty');
  return {
    name: dyn.name,
    prestige: Math.round(dyn.prestige * 10) / 10,
    taboos: dyn.taboos.map((t) => `${t.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(t.target)} (${Math.round(t.strength * 100)}%)`),
    legends: dyn.legendIds.map((id) => ctx.state.legends[id]).filter((l) => !!l).map((l) => renderLegend(ctx, l!, 'current')),
    livingMembers: Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c)).length,
    familyNodes: Object.keys(ctx.state.familyNodes).length,
  };
}

export function eventView(ctx: Ctx, p: PreparedEvent, text: TextTable): EventView {
  const vars: Record<string, string> = { actor: p.actor.name };
  for (const [k, v] of Object.entries(p.instance.vars)) vars[k] = ctx.tags.label(v);
  return {
    instanceId: p.instance.id,
    title: text[`${p.def.textKey}.title`] ?? p.def.id,
    text: fill(text[p.def.textKey] ?? p.def.textKey, vars),
    options: p.options.map((o) => ({
      id: o.id,
      text: fill(text[o.textKey] ?? o.textKey, { ...vars, ...o.params }),
      locked: p.locked.has(o.id),
      injected: !!o.injectedBy,
    })),
    triggered: [...new Set(p.hits.map((h) => describeTrait(ctx, h.trait)))],
  };
}

// ---------------------------------------------------------------------------
// ผังตระกูล + หน้าดูตัวละคร — ใช้เล่นทดสอบ/debug ระบบ จึงโชว์ข้อมูลภายในมากกว่าหน้าตัวละครปกติ (เช่น ปมแฝง นิสัยเป็นตัวเลข)
// ---------------------------------------------------------------------------

const PARENTAGE_TH: Partial<Record<Parentage, string>> = {
  minor_wife: 'บุตรภรรยาน้อย',
  slave_wife: 'บุตรภรรยาทาส',
  adopted: 'บุตรบุญธรรม',
};

const PERSONALITY_TH: Record<keyof Personality, string> = {
  neuroticism: 'หวั่นไหว',
  imagination: 'จินตนาการ',
  boldness: 'ใจกล้า',
  agreeableness: 'ว่านอนสอนง่าย',
  piety: 'ศรัทธา/ถือโชคลาง',
  pride: 'ทะนงตัว',
  resilience: 'ใจฟื้นเร็ว',
};

const ITEM_KIND_TH: Record<Item['kind'], string> = {
  land: 'ที่ดิน',
  house: 'เรือน',
  gold: 'ทอง',
  heirloom: 'ของตกทอด',
  manual: 'ตำรา',
};

const AWARENESS_TH: Record<Trait['awareness'], string> = {
  knows_cause: 'รู้ต้นเหตุ',
  misremembers: 'จำต้นเหตุผิด',
  unknown: 'ไม่รู้ต้นเหตุ',
};

export function treeView(ctx: Ctx): TreeView {
  const S = ctx.state;
  const dyn = must(S.dynasties[S.meta.playerDynastyId], 'dynasty');
  const founders = new Set<string>(Object.values(S.dynasties).map((d) => d.founderNodeId));
  const inTree = (id: FamilyNode['id'] | null) => !!id && !!S.familyNodes[id];
  const player = S.characters[S.meta.playerCharacterId];
  return {
    dynastyName: dyn.name,
    founderNodeId: dyn.founderNodeId,
    headNodeId: dyn.headNodeId,
    playerNodeId: player?.familyNodeId ?? null,
    nodes: Object.values(S.familyNodes).map((n) => {
      const ch = n.characterId ? S.characters[n.characterId] : undefined;
      return {
        id: n.id,
        name: n.name,
        sex: n.sex,
        birthYear: n.birthYear,
        deathYear: n.deathYear ?? (ch?.deathDay != null ? yearOf(ctx, ch.deathDay) : null),
        alive: isAlive(ch),
        pruned: !ch,
        // คู่ครองคนนอก = ไม่มีพ่อแม่ในผัง และไม่ใช่ต้นตระกูล
        marriedIn: !founders.has(n.id) && !inTree(n.fatherId) && !inTree(n.motherId),
        parentage: PARENTAGE_TH[n.parentage] ?? null,
        fatherId: n.fatherId,
        motherId: n.motherId,
        spouseIds: n.spouseIds.filter(inTree),
        childIds: n.childIds.filter(inTree),
      };
    }),
    branches: dyn.branchSummaries.map((b) => ({ ...b })),
  };
}

export function inspectView(ctx: Ctx, nodeId: string, text: TextTable): InspectView {
  const S = ctx.state;
  const node = must(S.familyNodes[nodeId as FamilyNode['id']], `ไม่พบ ${nodeId} ในผังตระกูล`);
  const ch = node.characterId ? S.characters[node.characterId] : undefined;
  const nodeName = (id: FamilyNode['id'] | null) => (id ? S.familyNodes[id]?.name : undefined);
  const charName = (id: Character['id'] | null) => (id ? S.characters[id]?.name : undefined) ?? '?';
  const deathYear = node.deathYear ?? (ch?.deathDay != null ? yearOf(ctx, ch.deathDay) : null);
  const cause = ch?.deathCause ?? node.summary?.causeOfDeath ?? null;
  const names = (ids: Array<FamilyNode['id'] | null>) => ids.map(nodeName).filter((x): x is string => !!x);

  const facts: InspectView['facts'] = [];
  const sections: InspectView['sections'] = [];
  const section = (title: string, items: string[]) => {
    if (items.length) sections.push({ title, items });
  };

  // ข้อมูลในผัง — มีทุกคน รวมคนที่ถูก prune
  const dyn = node.dynastyId ? S.dynasties[node.dynastyId] : undefined;
  if (dyn?.founderNodeId === node.id) facts.push(['ต้นตระกูล', dyn.name]);
  if (dyn?.headNodeId === node.id) facts.push(['ตำแหน่ง', `ผู้นำตระกูล${dyn.name}`]);
  const parents = names([node.fatherId, node.motherId]);
  if (parents.length) facts.push(['บิดามารดา', parents.join(' · ')]);
  const parentage = PARENTAGE_TH[node.parentage];
  if (parentage) facts.push(['ฐานะในบ้าน', parentage]);
  facts.push(['รุ่นที่', String(node.generation)]);
  const spouses = names(node.spouseIds);
  if (spouses.length) facts.push(['คู่ครอง', spouses.join(', ')]);
  const kids = names(node.childIds);
  if (kids.length) facts.push(['บุตร', kids.join(', ')]);
  section('ตำนานที่เล่าถึงคนนี้', node.legendIds.map((id) => S.legends[id]).filter((l) => !!l).map((l) => renderLegend(ctx, l!, 'current')));

  if (!ch) {
    // ถูก prune แล้ว — เหลือแค่ snapshot ตอนตาย
    const sm = node.summary;
    if (sm) {
      facts.push(['ชนชั้น', estateLabel(ctx, sm.estate)]);
      if (sm.title) facts.push(['บรรดาศักดิ์', sm.title]);
      section('ปมที่คนยังจำได้', sm.notableTraits.map((x) =>
        `${ctx.content.traitKinds[x.kind]?.label.th ?? x.kind}${x.target ? ctx.tags.label(x.target) : ''}`));
      const partLabel = partLabelOf(ctx, 'human');
      section('ร่องรอยบนร่างกาย', countSame(sm.scars.map((x) => `แผลเป็น(${t(text, 'scar.kind', x.kind)})ที่${partLabel(x.partDefId)}`)));
    }
    return {
      nodeId: node.id, name: node.name, sex: node.sex,
      lifespan: `${node.birthYear}–${deathYear ?? '?'}`,
      status: `เหลือแต่ชื่อในผังตระกูล${cause ? ` · ${ctx.tags.label(cause)}` : ''}`,
      facts, sections,
    };
  }

  facts.unshift(['อายุ', `${ageOf(ctx, ch, ch.deathDay ?? S.meta.day)} ปี`], ['ชนชั้น', estateLabel(ctx, ch.social.estate)]);
  if (ch.social.title) facts.push(['บรรดาศักดิ์', ch.social.title]);
  facts.push(['เงินสด', `${Math.round(ch.social.wealth)} ตำลึง${ch.social.debt ? ` · หนี้ ${Math.round(ch.social.debt)}` : ''}`]);
  facts.push(['ศักดินา', String(ch.social.sakdina)]);
  if (ch.social.patronId) facts.push(['มูลนาย', charName(ch.social.patronId)]);
  facts.push(['ความเครียด', pct(ch.stress)], ['บุญ', ch.merit.toFixed(1)], ['ถนัดมือ', ch.handedness === 'l' ? 'ซ้าย' : 'ขวา']);
  const hh = ch.householdId ? S.households[ch.householdId] : undefined;
  if (hh) facts.push(['เรือน', `${hh.headId === ch.id ? 'เป็นหัวเรือน' : `อยู่เรือนของ${charName(hh.headId)}`} · ${hh.memberIds.length} คน`]);

  section('ปมในใจ (รวมปมแฝง)', ch.traitIds.map((id) => S.traits[id]).filter((x): x is Trait => !!x).map((tr) => {
    const o = tr.origin;
    const from = o.type === 'experience' ? 'จากประสบการณ์'
      : o.type === 'social' ? `ซึมซับจาก${nodeName(o.fromNodeId) ?? 'ญาติ'}`
      : o.type === 'taboo' ? 'จากข้อห้ามตระกูล'
      : o.source === 'horoscope' ? 'ตามดวงชะตา' : 'นิสัยติดตัว';
    return `${describeTrait(ctx, tr)} — ${from}, ${AWARENESS_TH[tr.awareness]}, กำเริบ ${tr.triggerCount} ครั้ง`;
  }));
  section('ร่างกาย', [
    ...scarLines(ctx, ch, text),
    ...woundLines(ctx, ch, text).map((w) => `แผลสด ${w}`),
    ...CAPS.map((c) => [c, capability(ctx, ch, c)] as const).filter(([, x]) => x < 1).map(([c, x]) => `${t(text, 'capability', c)} ${pct(x)}`),
  ]);
  section('นิสัย', (Object.keys(PERSONALITY_TH) as Array<keyof Personality>).map((k) => `${PERSONALITY_TH[k]} ${pct(ch.personality[k])}`));
  section('ทักษะ', Object.entries(ch.skills).filter(([, v]) => v > 0).map(([k, v]) => `${t(text, 'skill', k)} ${Math.round(v)}`));
  section('ความสัมพันธ์', Object.values(S.relations).filter((r) => r.from === ch.id)
    .sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength))
    .map((r) => `${RELATION_TH[r.kind]}กับ${charName(r.to)} (${pct(r.strength)})`));
  section('ทรัพย์สิน', Object.values(S.items).filter((i) => i.ownerCharacterId === ch.id)
    .map((i) => `${ctx.tags.label(i.tag)} (${ITEM_KIND_TH[i.kind]}) ${Math.round(i.value)} ตำลึง${i.hidden ? ' · ซ่อนไว้' : ''}`));
  section('ความทรงจำที่ฝังใจ', ch.memoryIds.map((id) => S.memories[id]).filter((m) => !!m && (m.formative || m.intensity >= 0.5)).map((m) => {
    const def = ctx.content.events[m!.eventDefId];
    const title = (def && text[`${def.textKey}.title`]) || m!.eventDefId;
    return `อายุ ${m!.ageAtTime}: ${title} (แรง ${pct(m!.intensity)}${m!.formative ? ', ฝังลึก' : ''})`;
  }));
  if (hh?.headId === ch.id) {
    section('กฎในเรือน', hh.rules.map((r) => `${r.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(r.target)} — ตั้งโดย${charName(r.imposedBy)}`));
  }

  return {
    nodeId: node.id, name: node.name, sex: node.sex,
    lifespan: `${node.birthYear}–${deathYear ?? ''}`,
    status: isAlive(ch) ? 'ยังมีชีวิต' : `ถึงแก่กรรม${cause ? ` (${ctx.tags.label(cause)})` : ''}`,
    facts, sections,
  };
}
