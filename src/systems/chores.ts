import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, CharacterId, ChoreDomainDef, ChoreTaskDef, TagId } from '../core/types';
import { bond } from './will';

// ============================================================================
// Chores — งานบ้านของเด็ก: ถูกเรียกไปช่วย → หัดทีละขั้นตามวัยและฝีมือ
//
//  หมวด (ครัว งานบ้าน งานฝีมือ) ถูกเรียกปีละ sessionsPerYear ครั้ง สุ่มหมวดตามเพศ
//   ├─ ยังไม่เคยช่วยหมวดนี้: ถามว่าจะไปไหม (chore.ask) — ตกลงแล้วผู้ใหญ่สอนขั้นแรกที่เหมาะกับมือใหม่
//   └─ เคยตกลงแล้ว: ไม่ถามซ้ำ ข้ามไปหัดขั้นใหม่ที่ถึงวัยและถึงฝีมือ (chore.learn / event เฉพาะขั้น เช่นหั่นผัก)
//        หัดครบแล้ว: ทำซ้ำเงียบๆ ฝีมือค่อยๆ ขึ้น
//
//  นิสัยตัดสินแทนผู้เล่นได้ (ไม่เด้ง event):
//   แนวโน้ม = ว่านอนสอนง่าย + ความคาดหวังตามเพศ×ความเกรงผู้ใหญ่ − ใจกล้า − ถูกตามใจ (บ้านใหญ่ พ่อแม่รักมากเกรงน้อย)
//   ≥ autoYesAt → เข้าไปช่วย/หัดเอง (เด็กหญิงเรียบร้อย) · ≤ autoNoAt → ไม่สนใจและไม่มีใครบังคับ (เด็กแก่นในบ้านใหญ่)
//
//  lore: kinship.child_chores_by_strength, material.kitchen_tasks, material.crafts_1680s
// ============================================================================

export function domainByTag(ctx: Ctx, tag: TagId | undefined): ChoreDomainDef | undefined {
  return tag ? ctx.content.chores.domains.find((d) => d.tag === tag) : undefined;
}

const taskByTag = (d: ChoreDomainDef, tag: TagId | undefined): ChoreTaskDef | undefined =>
  tag ? d.tasks.find((t) => t.tag === tag) : undefined;

const stateOf = (ch: Character, d: ChoreDomainDef) => ((ch.chores ??= {})[d.id] ??= { joined: false, tasks: [] });

const skillOf = (ch: Character, d: ChoreDomainDef) => ch.skills[d.skill] ?? 0;

function addSkill(ch: Character, d: ChoreDomainDef, amount: number): void {
  ch.skills[d.skill] = Math.min(100, skillOf(ch, d) + amount);
}

/** ขั้นถัดไปที่ถึงวัยและถึงฝีมือ และยังไม่ได้หัด */
function nextTask(ctx: Ctx, ch: Character, d: ChoreDomainDef): ChoreTaskDef | undefined {
  const age = ageOf(ctx, ch);
  const done = new Set(stateOf(ch, d).tasks);
  return d.tasks.find((t) => !done.has(t.id) && t.minAge <= age && t.minSkill <= skillOf(ch, d));
}

/** แนวโน้มที่จะเข้าไปช่วยเอง (บวก) หรือไม่สนใจเลย (ลบ) */
export function inclination(ctx: Ctx, ch: Character, teacher: Character, d: ChoreDomainDef): number {
  const P = ch.personality;
  const expect = d.expect[ch.sex];
  const awe = bond(ctx, ch, teacher, 'awe');
  const affection = bond(ctx, ch, teacher, 'affection');
  // บ้านใหญ่มีบ่าวไพร่ทำงานแทน + พ่อแม่รักมากแต่ลูกไม่เกรง = ถูกตามใจ
  const indulged = (ch.social.estate === 'noble' || ch.social.estate === 'royal' ? 0.2 : 0) + 0.4 * Math.max(0, affection - awe);
  return (P.agreeableness - 0.5) + expect * (0.5 + awe) - 0.4 * (P.boldness - 0.5) - indulged * (1 - expect);
}

/** ผู้ใหญ่ที่สอน: คนเลี้ยงที่ยังมีชีวิตและอยู่เรือนเดียวกัน (แม่ก่อน) */
function teacherOf(ctx: Ctx, ch: Character): Character | undefined {
  const cgs = ch.caregiverIds.map((id) => ctx.state.characters[id]).filter(isAlive);
  const home = cgs.filter((c) => c.householdId === ch.householdId);
  return home.find((c) => c.sex === 'f') ?? home[0];
}

export interface ChoreEventRequest {
  event: string;
  bindings: Record<string, CharacterId>;
  vars: Record<string, TagId>;
}

/** เดือนละครั้ง (ผู้เล่นเท่านั้น) — คืน log และ event ที่ต้องถามผู้เล่น */
export function tickChores(ctx: Ctx, away: number): { lines: string[]; events: ChoreEventRequest[] } {
  const S = ctx.state;
  const C = ctx.content.balance.chores;
  const lines: string[] = [];
  const events: ChoreEventRequest[] = [];
  const ch = S.characters[S.meta.playerCharacterId];
  if (!isAlive(ch) || away >= 1) return { lines, events };
  const age = ageOf(ctx, ch);
  if (age < C.ageRange[0] || age > C.ageRange[1] || !ctx.rng.chance(C.sessionsPerYear / 12)) return { lines, events };
  const teacher = teacherOf(ctx, ch);
  if (!teacher) return { lines, events };
  const d = ctx.rng.weighted(ctx.content.chores.domains, (x) => x.weight[ch.sex]);
  if (!d) return { lines, events };
  const st = stateOf(ch, d);
  const label = (tag: TagId) => ctx.tags.label(tag);
  const incl = inclination(ctx, ch, teacher, d);
  const bindings = { actor: ch.id, caregiver: teacher.id };

  if (!st.joined) {
    if (st.askAfter !== undefined && S.meta.day < st.askAfter) return { lines, events };
    if (incl >= C.autoYesAt) {
      lines.push(`${ch.name}เข้า${label(d.tag)}ไปช่วย${teacher.name}เองโดยไม่ต้องมีใครเรียก`, ...join(ctx, ch, d, teacher));
    } else if (incl <= C.autoNoAt) {
      if (st.askAfter === undefined) lines.push(`${ch.name}ไม่สนใจ${label(d.tag)} ผู้ใหญ่ก็ไม่ได้บังคับ`);
      st.askAfter = S.meta.day + C.askAgainYears * ctx.content.balance.daysPerYear;
    } else {
      events.push({ event: 'chore.ask', bindings, vars: { chore: d.tag, task: d.tasks[0]!.tag } });
    }
    return { lines, events };
  }

  const task = nextTask(ctx, ch, d);
  if (!task) {
    addSkill(ch, d, C.practiceGain); // หัดครบแล้ว ทำซ้ำเงียบๆ
    return { lines, events };
  }
  if (incl >= C.autoYesAt && !task.event) {
    lines.push(...learn(ctx, ch, d, task, teacher, 1));
  } else {
    events.push({ event: task.event ?? 'chore.learn', bindings, vars: { chore: d.tag, task: task.tag } });
  }
  return { lines, events };
}

function join(ctx: Ctx, ch: Character, d: ChoreDomainDef, teacher: Character | undefined): string[] {
  const st = stateOf(ch, d);
  st.joined = true;
  delete st.askAfter;
  const first = d.tasks[0]!;
  return learn(ctx, ch, d, first, teacher, 1);
}

function learn(ctx: Ctx, ch: Character, d: ChoreDomainDef, task: ChoreTaskDef, teacher: Character | undefined, factor: number): string[] {
  const st = stateOf(ch, d);
  if (!st.tasks.includes(task.id)) st.tasks.push(task.id);
  addSkill(ch, d, task.gain * factor);
  const what = ctx.tags.label(task.tag);
  return [teacher ? `${teacher.name}สอนให้${ch.name}${what}` : `${ch.name}หัด${what}ได้แล้ว`];
}

/** effect 'chore' จาก event — หมวด/ขั้นมาจากตัวแปร $chore / $task ของ event */
export function applyChore(
  ctx: Ctx, ch: Character, action: 'join' | 'learn' | 'decline', vars: Record<string, TagId>, teacher: Character | undefined, factor = 1,
): string[] {
  const d = domainByTag(ctx, vars['chore']);
  if (!d) return [];
  switch (action) {
    case 'join':
      return join(ctx, ch, d, teacher);
    case 'learn': {
      const task = taskByTag(d, vars['task']);
      return task ? learn(ctx, ch, d, task, teacher, factor) : [];
    }
    case 'decline':
      stateOf(ch, d).askAfter = ctx.state.meta.day + ctx.content.balance.chores.askAgainYears * ctx.content.balance.daysPerYear;
      return [];
  }
}

/** ฝีมืองานบ้านในแผงตัวละคร: "งานครัว 23 (หัดได้ 4 ขั้น)" */
export function choreSkills(ctx: Ctx, ch: Character): string[] {
  return ctx.content.chores.domains
    .filter((d) => (ch.skills[d.skill] ?? 0) > 0)
    .map((d) => `${ctx.content.chores.skillLabels[d.skill] ?? d.skill} ${Math.round(ch.skills[d.skill]!)}${ch.chores?.[d.id]?.tasks.length ? ` (หัดได้ ${ch.chores[d.id]!.tasks.length} ขั้น)` : ''}`);
}
