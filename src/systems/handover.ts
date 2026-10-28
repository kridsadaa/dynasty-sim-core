import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, Dynasty, FamilyNode, FamilyTaboo, Item, Relation, TagId } from '../core/types';
import { retellLegend, seedLegendsFromLife } from './legend';
import { pruneState, type PruneReport } from './prune';
import { addOrReinforceTrait } from './traits';

// ============================================================================
// Generational Handover — เรียกเมื่อตัวละครผู้เล่นตาย
//
//  [1] Snapshot   : แช่แข็งผู้ตายลง FamilyNode.summary (ข้อมูลขั้นต่ำที่ต้องอยู่ถาวร)
//  [2] Legends    : แผลเป็น/ความทรงจำเด่น → Legend ใหม่ (truth = ความจริง)
//  [3] Heir       : เลือกทายาท (ผู้เล่นเลือกได้จาก candidates)
//  [4] Funeral    : งานศพแปลงทรัพย์เป็นบารมี/บุญ                         ← anti-snowball
//  [5] Estate     : แบ่งมรดกตามสถานะแม่ (ไม่ใช่ winner-takes-all) + หนี้ตกทอด ← anti-snowball
//  [6] Social     : บรรดาศักดิ์ไม่สืบทอด, prestige เสื่อม, บุญคุณ/ความแค้นตกทอดแบบลดทอน
//  [7] Taboos     : กฎในเรือนที่อยู่นานพอ → ข้อห้ามตระกูล; ข้อห้ามเก่าเสื่อม/กลายพันธุ์/ถูกฝ่าฝืน
//  [8] Retell     : ตำนานทุกเรื่องของตระกูลถูกเล่าต่อ 1 รุ่น (บิดเบือนตาม personality ของทายาท)
//  [9] Prune      : ยุบ NPC ที่ตายแล้ว/ไกลตัว
//
// สิ่งที่ "ไม่" ส่งต่อ: skill (ต้องเรียนใหม่ — ส่งต่อได้แค่ตำราที่เร่งการเรียน), บรรดาศักดิ์,
// ความทรงจำของผู้ตาย (เหลือแค่ตำนานที่บิดเบือน), ปมจิตใจโดยตรง (ส่งต่อเฉพาะผ่าน social learning ระหว่างมีชีวิต + taboo)
// ============================================================================

export interface HandoverReport {
  deceased: string;
  heir: string;
  candidates: Array<{ name: string; score: number }>;
  log: string[];
  prune: PruneReport;
}

export function markDead(ctx: Ctx, ch: Character, cause: TagId): void {
  ch.deathDay = ctx.state.meta.day;
  ch.deathCause = cause;
  snapshotToNode(ctx, ch);
}

export function snapshotToNode(ctx: Ctx, ch: Character): void {
  const node = must(ctx.state.familyNodes[ch.familyNodeId], ch.familyNodeId);
  node.deathYear = ch.deathDay === null ? null : yearOf(ctx, ch.deathDay);
  node.summary = {
    estate: ch.social.estate,
    title: ch.social.title,
    notableTraits: ch.traitIds
      .map((id) => ctx.state.traits[id])
      .filter((t) => !!t && t.intensity >= 0.4)
      .map((t) => ({ kind: t!.kind, target: t!.target })),
    scars: ch.bodyPartIds.flatMap((pid) => {
      const p = ctx.state.bodyParts[pid];
      return p ? p.scars.map((s) => ({ partDefId: p.partDefId, kind: s.kind })) : [];
    }),
    causeOfDeath: ch.deathCause,
  };
}

export function heirCandidates(ctx: Ctx, deceased: Character): Array<{ ch: Character; score: number }> {
  const B = ctx.content.balance.inheritance;
  const node = must(ctx.state.familyNodes[deceased.familyNodeId], 'node');
  const kids = node.childIds
    .map((id) => ctx.state.familyNodes[id])
    .map((n) => (n?.characterId ? ctx.state.characters[n.characterId] : undefined))
    .filter(isAlive);
  return kids
    .map((ch) => {
      const n = must(ctx.state.familyNodes[ch.familyNodeId], 'child node');
      const age = ageOf(ctx, ch);
      return { ch, score: B.shareByParentage[n.parentage] + (age >= 16 ? 1 : 0) + age * 0.01 };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * asPlayer=false: ใช้ตอนหัวหน้าตระกูลที่เป็น NPC ตาย (เช่น บิดาผู้เล่น) — แบ่งมรดก/ตกผลึกข้อห้ามเหมือนกัน
 * แต่ไม่สลับตัวละครผู้เล่น
 */
export function performHandover(
  ctx: Ctx, deceasedId: Character['id'], chosenHeirId?: Character['id'], opts: { asPlayer?: boolean } = {},
): HandoverReport {
  const B = ctx.content.balance.inheritance;
  const dead = must(ctx.state.characters[deceasedId], deceasedId);
  if (dead.deathDay === null) markDead(ctx, dead, 'situation:old_age');
  const node = must(ctx.state.familyNodes[dead.familyNodeId], 'node');
  const dyn = must(dead.dynastyId ? ctx.state.dynasties[dead.dynastyId] : undefined, 'dynasty');
  const log: string[] = [];

  // [1] snapshot ทำแล้วใน markDead

  // [2] legends
  for (const lid of seedLegendsFromLife(ctx, dead, node, dyn)) log.push(`ตำนานใหม่: ${lid}`);

  // [3] heir
  const candidates = heirCandidates(ctx, dead);
  const heir = chosenHeirId ? must(ctx.state.characters[chosenHeirId], 'heir') : must(candidates[0], 'no heir — game over / adopt').ch;
  const heirNode = must(ctx.state.familyNodes[heir.familyNodeId], 'heir node');

  // [4] funeral
  const funeral = dead.social.wealth * B.funeralCostRate[dead.social.estate];
  dead.social.wealth -= funeral;
  dyn.prestige += funeral * B.funeralPrestigePerTamlueng;
  dead.merit += funeral * 0.01;
  log.push(`งานศพ ${dead.name} ใช้ ${funeral.toFixed(0)} ตำลึง → บารมีตระกูล +${(funeral * B.funeralPrestigePerTamlueng).toFixed(1)}`);

  // [5] estate
  log.push(...distributeEstate(ctx, dead, candidates.map((c) => c.ch), heir));

  // [6] social
  dyn.prestige *= 1 - B.prestigeDecay;
  dyn.headNodeId = heirNode.id;
  log.push(...carryRelations(ctx, dead, heir));
  if (dead.social.title) log.push(`บรรดาศักดิ์ "${dead.social.title}" ไม่ตกทอด — ${heir.name} ต้องถวายตัวรับราชการเอง`);

  // [7] taboos
  log.push(...crystallizeTaboos(ctx, dead, heir, heirNode, dyn));

  // [8] retell
  for (const lid of dyn.legendIds) {
    const legend = ctx.state.legends[lid];
    if (!legend) continue;
    const ops: string[] = retellLegend(ctx, legend, heir);
    if ((heir.skills['literacy'] ?? 0) >= 30 && !legend.writtenRecord) {
      legend.writtenRecord = true; // จดลงสมุดข่อย → บิดเบือนช้าลงนับจากนี้
      ops.push('จดลงสมุดข่อย');
    }
    if (ops.length) log.push(`ตำนาน ${lid} ถูกเล่าต่อโดย ${heir.name}: ${ops.join(', ')} (divergence ${legend.divergence.toFixed(2)})`);
  }

  // household: กฎส่วนตัวของผู้ตายหายไป เหลือเฉพาะที่ตกผลึกเป็นข้อห้ามตระกูลแล้ว (ปฏิบัติต่อในเรือนทายาท)
  const deadHh = dead.householdId ? ctx.state.households[dead.householdId] : undefined;
  if (deadHh) {
    deadHh.memberIds = deadHh.memberIds.filter((id) => id !== dead.id);
    deadHh.rules = [];
    const nextHead = deadHh.memberIds.includes(heir.id)
      ? heir
      : deadHh.memberIds.map((id) => ctx.state.characters[id]).filter(isAlive).sort((a, b) => a.birthDay - b.birthDay)[0];
    if (nextHead) deadHh.headId = nextHead.id;
    else delete ctx.state.households[deadHh.id];
  }
  const heirHh = heir.householdId ? ctx.state.households[heir.householdId] : undefined;
  if (heirHh) {
    heirHh.rules = heirHh.rules.filter((r) => r.originTraitId || dyn.taboos.some((t) => t.target === r.target));
    for (const t of dyn.taboos) {
      if (heirHh.rules.some((r) => r.target === t.target)) continue;
      heirHh.rules.push({
        id: `rule_${heirHh.id}_${t.target}`, kind: t.kind, target: t.target, sinceDay: ctx.state.meta.day,
        imposedBy: heir.id, originTraitId: null, statedReason: 'inauspicious', // "บรรพบุรุษห้ามไว้"
      });
    }
  }

  if (opts.asPlayer !== false) ctx.state.meta.playerCharacterId = heir.id;
  const prune = pruneState(ctx);
  return {
    deceased: dead.name,
    heir: heir.name,
    candidates: candidates.map((c) => ({ name: c.ch.name, score: c.score })),
    log,
    prune,
  };
}

/**
 * แบ่งมรดกแบบ partible: น้ำหนักตามสถานะแม่ + โบนัสทายาทหลัก
 * - เรือน → ทายาทหลัก, ที่ดิน/ทอง → greedy ให้คนที่ยังได้น้อยกว่าสิทธิ์มากที่สุด
 * - เงินสดและหนี้ แบ่งตามสัดส่วนเดียวกัน (ลูกอาจตกเป็นหนี้จนต้องขายตัวเป็นทาส)
 * - ของประจำตระกูล (ownerDynastyId) ไม่ถูกแบ่ง — ผู้นำตระกูลถือครองแทน
 */
function distributeEstate(ctx: Ctx, dead: Character, heirs: Character[], main: Character): string[] {
  const B = ctx.content.balance.inheritance;
  if (!heirs.length) return ['ไม่มีทายาท — ทรัพย์ตกเป็นของหลวง'];
  const weight = new Map(
    heirs.map((h) => {
      const n = must(ctx.state.familyNodes[h.familyNodeId], 'node');
      return [h.id, B.shareByParentage[n.parentage] + (h.id === main.id ? B.mainHeirBonus : 0)] as const;
    }),
  );
  const totalW = [...weight.values()].reduce((a, b) => a + b, 0);
  const share = (h: Character) => (weight.get(h.id) ?? 0) / totalW;

  const items = Object.values(ctx.state.items).filter((i) => i.ownerCharacterId === dead.id);
  const totalValue = items.reduce((a, i) => a + i.value, 0) + dead.social.wealth;
  const received = new Map<Character['id'], number>(heirs.map((h) => [h.id, 0]));
  const give = (item: Item, to: Character) => {
    item.ownerCharacterId = to.id;
    received.set(to.id, (received.get(to.id) ?? 0) + item.value);
  };

  for (const it of items.filter((i) => i.kind === 'house')) give(it, main);
  for (const it of items.filter((i) => i.kind !== 'house').sort((a, b) => b.value - a.value)) {
    const best = heirs.reduce((a, b) =>
      share(b) * totalValue - (received.get(b.id) ?? 0) > share(a) * totalValue - (received.get(a.id) ?? 0) ? b : a,
    );
    give(it, best);
  }
  for (const h of heirs) {
    h.social.wealth += dead.social.wealth * share(h);
    h.social.debt += dead.social.debt * share(h);
  }
  const lines = heirs.map(
    (h) => `${h.name} ได้ ${((received.get(h.id) ?? 0) + dead.social.wealth * share(h)).toFixed(0)} ตำลึง (${Math.round(share(h) * 100)}%)` +
      (dead.social.debt ? `, รับหนี้ ${(dead.social.debt * share(h)).toFixed(0)}` : ''),
  );
  dead.social.wealth = 0;
  dead.social.debt = 0;
  return lines;
}

/** ความแค้นตกทอดแรงกว่าบุญคุณ — asymmetry นี้ทำให้ศัตรูเก่าตามหลอกหลอนรุ่นลูก */
function carryRelations(ctx: Ctx, dead: Character, heir: Character): string[] {
  const carry = ctx.content.balance.inheritance.relationCarry;
  const out: string[] = [];
  for (const r of Object.values(ctx.state.relations)) {
    if (r.from !== dead.id && r.to !== dead.id) continue;
    const factor = carry[r.kind];
    const other = r.from === dead.id ? r.to : r.from;
    if (!factor || other === heir.id || !isAlive(ctx.state.characters[other])) continue;
    const inherited: Relation = {
      id: `${r.from === dead.id ? heir.id : other}|${r.to === dead.id ? heir.id : other}|${r.kind}`,
      from: r.from === dead.id ? heir.id : other,
      to: r.to === dead.id ? heir.id : other,
      kind: r.kind,
      strength: r.strength * factor,
      sinceDay: ctx.state.meta.day,
    };
    ctx.state.relations[inherited.id] = inherited;
    out.push(`${heir.name} รับ ${r.kind} กับ ${ctx.state.characters[other]?.name} (${inherited.strength.toFixed(2)})`);
  }
  return out;
}

function crystallizeTaboos(ctx: Ctx, dead: Character, heir: Character, heirNode: FamilyNode, dyn: Dynasty): string[] {
  const B = ctx.content.balance.inheritance;
  const out: string[] = [];
  const created = new Set<string>();

  // (a) เสื่อม / ลืมต้นเหตุ / กลายพันธุ์ / ถูกฝ่าฝืน — ข้อห้ามเก่า
  for (const t of [...dyn.taboos]) {
    t.strength *= B.tabooDecay;
    if (heirNode.generation - t.sinceGeneration >= 2) t.originKnown = false;
    if (ctx.rng.chance(B.tabooMutateChance)) {
      const ups = ctx.tags.parents(t.target).filter((p) => !ctx.tags.def(p)?.generalizeStop);
      const up = ctx.rng.pick(ups);
      if (up && ctx.rng.chance(0.5)) {
        out.push(`ข้อห้ามกลายพันธุ์: ${ctx.tags.label(t.target)} → ${ctx.tags.label(up)}`);
        t.target = up;
      } else if (t.kind === 'ban') {
        t.kind = 'ritual';
        out.push(`ข้อห้าม${ctx.tags.label(t.target)} กลายเป็นพิธีกรรมประจำตระกูล`);
      }
    }
    const P = heir.personality;
    const rebel = P.boldness * P.imagination * (1 - t.strength) * (t.originKnown ? 0.5 : 1);
    if (ctx.rng.chance(rebel) || t.strength < B.tabooForgetBelow) {
      dyn.taboos = dyn.taboos.filter((x) => x !== t);
      out.push(t.strength < B.tabooForgetBelow
        ? `ข้อห้าม${ctx.tags.label(t.target)} ถูกลืมไปตามกาลเวลา`
        : `${heir.name} ฝ่าฝืนข้อห้าม${ctx.tags.label(t.target)} (ผิดผีบรรพบุรุษ)`);
    }
  }

  // (b) กฎในเรือนของผู้ตายที่อยู่นานพอ → ข้อห้ามตระกูล
  const hh = dead.householdId ? ctx.state.households[dead.householdId] : undefined;
  for (const rule of hh?.rules ?? []) {
    const years = (ctx.state.meta.day - rule.sinceDay) / ctx.content.balance.daysPerYear;
    if (years < B.tabooMinYears) continue;
    const existing = dyn.taboos.find((t) => t.target === rule.target || ctx.tags.isA(rule.target, t.target));
    if (existing) {
      // กฎที่มาจากปมจริงของคนเป็น เสริมแรงมาก; กฎที่ทำตามประเพณีอย่างเดียว เสริมแรงน้อย → ค่อยๆ จางหาย
      existing.strength = clamp01(existing.strength + (rule.originTraitId ? 0.15 : 0.03));
      continue;
    }
    const imposer = ctx.state.characters[rule.imposedBy];
    const taboo: FamilyTaboo = {
      id: `taboo_${dyn.id}_${rule.target}`,
      kind: rule.kind,
      target: rule.target,
      strength: clamp01(0.5 + 0.04 * Math.min(years, 12)),
      originNodeId: imposer?.familyNodeId ?? heirNode.id,
      originKnown: rule.statedReason === 'true_cause',
      sinceGeneration: heirNode.generation,
    };
    dyn.taboos.push(taboo);
    created.add(taboo.id);
    out.push(`ข้อห้ามตระกูลใหม่: ${taboo.kind === 'ban' ? 'ห้าม' : 'พิธีเกี่ยวกับ'}${ctx.tags.label(taboo.target)} (แรง ${taboo.strength.toFixed(2)}, รู้ต้นเหตุ: ${taboo.originKnown})`);
  }

  // (c) ข้อห้ามฝังเข้าตัวทายาทเป็น superstition (ถ้ายังไม่มีปมนี้)
  for (const t of dyn.taboos) {
    addOrReinforceTrait(ctx, heir, {
      kind: 'superstition',
      target: t.target,
      intensity: t.strength * 0.5,
      latent: false,
      awareness: t.originKnown ? 'knows_cause' : 'unknown',
      origin: { type: 'taboo', dynastyId: dyn.id, tabooId: t.id },
    });
  }
  return out;
}

// ============================================================================
// Anti-snowball: เหตุการณ์ประวัติศาสตร์ "ล้างไพ่" — เรียกเมื่อเวลาในเกมผ่านปีนั้น
// ============================================================================

export function applyHistoricalShocks(ctx: Ctx, year: number): string[] {
  const out: string[] = [];
  for (const ev of ctx.content.history.filter((h) => h.year === year)) {
    out.push(`== ${ctx.tags.label(ev.tag)} (${ev.year}) ==`);
    for (const dyn of Object.values(ctx.state.dynasties)) {
      const members = Object.values(ctx.state.characters).filter((c) => c.dynastyId === dyn.id && isAlive(c));
      const purged = !!dyn.faction && (ev.shock.purgeFactions ?? []).includes(dyn.faction);
      for (const m of members) {
        const loss = ctx.rng.range(ev.shock.wealthLoss[0], ev.shock.wealthLoss[1]);
        m.social.wealth *= 1 - (purged ? Math.max(loss, 0.8) : loss);
        if (purged && m.social.title) {
          out.push(`${m.name} ถูกริบราชบาดาล ถอดจาก${m.social.title}`);
          m.social.title = null;
        }
        if (ctx.rng.chance(ev.shock.deathRisk)) {
          markDead(ctx, m, ev.tag);
          out.push(`${m.name} เสียชีวิตใน${ctx.tags.label(ev.tag)}`);
        }
      }
      // ทรัพย์ที่ไม่ได้ซ่อน (เรือน ที่ดินในกรุง ตำรา) เสียหาย — ทองที่ฝังดินรอด
      for (const it of Object.values(ctx.state.items)) {
        const owner = it.ownerCharacterId ? ctx.state.characters[it.ownerCharacterId] : undefined;
        if (it.hidden || (owner?.dynastyId !== dyn.id && it.ownerDynastyId !== dyn.id)) continue;
        const loss = ctx.rng.range(ev.shock.wealthLoss[0], ev.shock.wealthLoss[1]);
        it.value *= 1 - loss;
        it.condition = clamp01(it.condition - loss);
      }
      if (purged) dyn.prestige *= 0.5;
    }
  }
  return out;
}
