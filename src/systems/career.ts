import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId, DepartmentDef, OfficePostDef } from '../core/types';
import { livingParents } from './factory';
import { opinion } from './opinion';
import { hasPerk, legacyLevel, SKILL_TRACKS } from './skills';

// ============================================================================
// Career — รับราชการ (บันไดจากทำเนียบศักดินาจริง ตำแหน่งนาพลเรือน)
//
//  ลูกขุนนางชายอายุ 13–20 ──► พ่อแม่พาไปถวายตัวเป็นมหาดเล็ก (นา 200) ยังไม่สังกัดกรม
//    ──► พ้นมหาดเล็ก เลือกกรม (career.assign_department): กองกระเวน, ชาวที่ขวา, ราชบัณฑิตย (ต้องอ่านออกเขียนได้)
//    ──► ไต่บันไดของกรมนั้น เช่น กองกระเวน: หมื่น{ราชทินนาม} (นา 300) ──► ขุน{ราชทินนามเดิม} (นา 400) ──► เจ้ากรม (นา 1000)
//  ราชทินนามของกรมอื่นต่างกันแต่ละขั้น — ได้ชื่อใหม่เมื่อเลื่อน (ชื่อในทำเนียบอ่านจากภาพสแกน ยังต้องตรวจ)
//
//  favor (ความโปรดปราน): ขึ้นจากงานดี ลงจากความผิด/การถูกฟ้อง และคลายกลับหา 0 ทุกปี
//    ถึง promoteAt และอยู่ในตำแหน่งครบ minYears → event เลื่อนยศ · ต่ำกว่า punishAt → event ถูกลงโทษ
//  ไม่มีเบี้ยหวัด: ได้ของกำนัล/ส่วยตามศักดินาทุกปี และ event ของกำนัลที่ต้องเลือกรับหรือไม่รับ
//  เข้าเวรในวัง → แรงงานหายจากเรือน dutyLabor
//
//  lore: social.royal_pages_1680s, social.patrol_department_ladder, social.royal_chamber_department_ladder,
//        social.royal_scholars_department_ladder, social.officers_no_salary_1680s,
//        social.court_punishments_1680s, social.court_attendance_rules — ตัวเลขทั้งหมดเป็นค่าของเกม
// ============================================================================

/** กรมที่สังกัด — มหาดเล็กยังไม่มีกรม (ใช้บันไดของกรมแรก ซึ่งขั้น 0 เหมือนกันทุกกรม); เซฟเก่าไม่มี deptId = กรมแรก */
export function deptOf(ctx: Ctx, ch: Character): DepartmentDef {
  const all = ctx.content.offices.departments;
  return all.find((d) => d.id === ch.office?.deptId) ?? all[0]!;
}

export function postOf(ctx: Ctx, ch: Character): OfficePostDef | undefined {
  return ch.office ? deptOf(ctx, ch).posts.find((p) => p.id === ch.office!.postId) : undefined;
}

const postAt = (dept: DepartmentDef, rank: number) => dept.posts.find((p) => p.rank === rank);

export const officeRank = (ctx: Ctx, ch: Character): number | undefined => postOf(ctx, ch)?.rank;

/** แรงงานที่หายจากเรือนเพราะเข้าเวรในวัง */
export const officeLabor = (ctx: Ctx, ch: Character): number => (ch.office ? ctx.content.balance.career.dutyLabor : 0);

/** ชื่อตำแหน่งที่แสดง/ตั้งเป็น social.title */
function titleOf(post: OfficePostDef, name: string | undefined): string | null {
  if (!post.title) return null; // มหาดเล็กยังไม่มีบรรดาศักดิ์
  return post.title.replace('{name}', name ?? '');
}

/** ราชทินนามที่ใช้ได้ในขั้นนี้ */
const namePool = (dept: DepartmentDef, post: OfficePostDef) => post.names ?? dept.names;

/** ราชทินนามที่คนอื่นที่ยังมีชีวิตยังไม่ได้ใช้ — สุ่มจาก pool */
function pickOfficeName(ctx: Ctx, ch: Character, pool: string[]): string | undefined {
  if (!pool.length) return undefined;
  const taken = new Set(Object.values(ctx.state.characters).filter((c) => isAlive(c) && c !== ch).map((c) => c.office?.name));
  const free = pool.filter((n) => !taken.has(n));
  return ctx.rng.pick(free.length ? free : pool);
}

function setPost(ctx: Ctx, ch: Character, post: OfficePostDef, dept = deptOf(ctx, ch)): void {
  // ชื่อเดิมอยู่ในรายชื่อของขั้นใหม่ (หมื่น→ขุนกองกระเวนชื่อเดียวกัน) → ใช้ต่อ, ไม่อยู่ → สุ่มชื่อใหม่ของขั้นนั้น
  const pool = namePool(dept, post);
  const name = ch.office?.name && pool.includes(ch.office.name) ? ch.office.name : pickOfficeName(ctx, ch, pool);
  const deptId = post.rank > 0 ? dept.id : undefined;
  ch.office = { postId: post.id, ...(deptId ? { deptId } : {}), ...(name ? { name } : {}), sinceDay: ctx.state.meta.day, favor: 0 };
  ch.social.title = titleOf(post, name);
  ch.social.sakdina = post.sakdina;
}

/** กรมที่ ch เลือกได้ตอนพ้นมหาดเล็ก */
export function eligibleDepartments(ctx: Ctx, ch: Character): DepartmentDef[] {
  return ctx.content.offices.departments.filter((d) =>
    (d.requires ?? []).every((c) => c.type !== 'skill' || (ch.skills[c.skill] ?? 0) >= c.min));
}

function addPrestige(ctx: Ctx, ch: Character, delta: number): void {
  const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
  if (!dyn) return;
  const mult = delta > 0 && (legacyLevel(ctx, ch, 'court') >= 2 || legacyLevel(ctx, ch, 'warrior') >= 3) ? 1.25 : 1;
  dyn.prestige = Math.max(0, dyn.prestige + delta * mult);
}

/** ทำ action ราชการจาก effect ของ event — คืนบรรทัด log */
export function applyCareer(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'enter_dept' | 'promote' | 'demote' | 'dismiss' | 'restore' | 'decline', deptId?: string,
): string[] {
  const C = ctx.content.balance.career;
  const post = postOf(ctx, ch);
  const dept = deptOf(ctx, ch);
  switch (action) {
    case 'restore': {
      // แผ่นดินใหม่ให้คงยศเดิม (lore: event.fall_of_ayutthaya_2310 "พระราชทานฐานาศักดิ์แก่เสนาบดีให้คง...ดังเก่า")
      const f = ch.formerOffice;
      delete ch.formerOffice;
      const to = f && (ctx.content.offices.departments.find((d) => d.id === f.deptId) ?? ctx.content.offices.departments[0]!);
      const back = f && to?.posts.find((p) => p.id === f.postId);
      if (!f || !to || !back || ch.office) return [];
      ch.office = { postId: back.id, ...(f.deptId ? { deptId: f.deptId } : {}), ...(f.name ? { name: f.name } : {}), sinceDay: ctx.state.meta.day, favor: 0 };
      ch.social.title = f.title;
      ch.social.sakdina = back.sakdina;
      return [`${ch.name}เข้ารับราชการในแผ่นดินใหม่ คงยศเดิม${f.title ? ` เป็น${f.title}` : ''}`];
    }
    case 'decline':
      delete ch.formerOffice;
      return [];
    case 'enter': {
      if (ch.office) return [];
      const first = must(postAt(dept, 0), 'post rank 0');
      setPost(ctx, ch, first, dept);
      if (legacyLevel(ctx, ch, 'court') >= 1) adjustFavor(ch, 0.1);
      return [`${ch.name}ถวายตัวเป็น${first.label.th} (นา ${first.sakdina})`];
    }
    case 'assign': {
      // พ้นมหาดเล็กไปสังกัดกรมที่เลือก แล้วได้ขั้นแรกของกรมนั้น
      const to = ctx.content.offices.departments.find((d) => d.id === deptId);
      const next = to && post?.rank === 0 ? postAt(to, 1) : undefined;
      if (!to || !next) return [];
      setPost(ctx, ch, next, to);
      addPrestige(ctx, ch, C.promotePrestige * next.rank);
      return [`${ch.name}ได้เป็น${ch.social.title ?? next.label.th} สังกัด${to.label.th} ถือศักดินา ${next.sakdina}`];
    }
    case 'enter_dept': {
      // ผู้ใหญ่ที่เลยวัยมหาดเล็กแล้วฝากตัวเข้ากรมโดยตรง — ได้ขั้นแรกของกรม (ไม่ผ่านมหาดเล็ก)
      const to = ctx.content.offices.departments.find((d) => d.id === deptId);
      const first = to && postAt(to, 1);
      if (ch.office || !to || !first) return [];
      setPost(ctx, ch, first, to);
      if (legacyLevel(ctx, ch, 'court') >= 1) adjustFavor(ch, 0.1);
      return [`${ch.name}ได้เข้ารับราชการเป็น${ch.social.title ?? first.label.th} สังกัด${to.label.th} ถือศักดินา ${first.sakdina}`];
    }
    case 'promote': {
      const next = post && postAt(dept, post.rank + 1);
      if (!next) return [];
      setPost(ctx, ch, next, dept);
      addPrestige(ctx, ch, C.promotePrestige * next.rank);
      return [`${ch.name}ได้เลื่อนเป็น${ch.social.title ?? next.label.th} ${dept.label.th} ถือศักดินา ${next.sakdina}`];
    }
    case 'demote': {
      const prev = post && postAt(dept, post.rank - 1);
      if (!post) return [];
      // ตกจากตำแหน่งไม่ถือเป็นความอัปยศ (lore: social.court_punishments_1680s) — แต่บารมีตระกูลยังลด
      addPrestige(ctx, ch, -C.promotePrestige * post.rank * 0.5);
      if (!prev) return applyCareer(ctx, ch, 'dismiss');
      setPost(ctx, ch, prev);
      return [`${ch.name}ถูกลดลงเป็น${ch.social.title ?? prev.label.th} ศักดินา ${prev.sakdina}`];
    }
    case 'dismiss': {
      if (!ch.office) return [];
      delete ch.office;
      ch.social.title = null;
      ch.social.sakdina = 0;
      return [`${ch.name}ถูกถอดจากราชการ`];
    }
  }
}

export function adjustFavor(ch: Character, delta: number): void {
  if (!ch.office) return;
  const mult = delta > 0 ? (1 + (hasPerk(ch, 'diplomacy_4') ? 0.2 : 0) + (hasPerk(ch, 'martial_3') ? 0.15 : 0)) : 1;
  ch.office.favor = Math.max(-1, Math.min(1, ch.office.favor + delta * mult));
}

/**
 * วิชาที่ช่วยเลื่อนยศ: สายวิชาของกรม (มหาดเล็กยังไม่มีกรม → diplomacy) × ขั้นที่ปลดล็อก → ความโปรดปรานที่ได้เพิ่มทุกปี
 * การจับคู่กรม→สายวิชาและตัวเลขเป็นของเกม (offices.json skillTrack, balance.career.skillFavorPerTier)
 */
export function careerSkill(ctx: Ctx, ch: Character) {
  const post = postOf(ctx, ch);
  const id = (post && post.rank > 0 ? deptOf(ctx, ch).skillTrack : undefined) ?? 'diplomacy';
  const track = must(SKILL_TRACKS.find((t) => t.id === id), id);
  const tier = track.perks.filter((p) => hasPerk(ch, p.id)).length;
  return { track, tier, favor: tier * ctx.content.balance.career.skillFavorPerTier };
}

export interface CareerEventRequest {
  event: string;
  bindings: Record<string, CharacterId>;
}

/** ปีละครั้ง: ถวายตัว รายได้ตามตำแหน่ง ความโปรดปรานคลายลง เลื่อนยศ/ลงโทษ */
export function careerYearTick(ctx: Ctx): { lines: string[]; events: CareerEventRequest[] } {
  const S = ctx.state;
  const C = ctx.content.balance.career;
  const lines: string[] = [];
  const events: CareerEventRequest[] = [];
  const player = S.characters[S.meta.playerCharacterId];
  // ตำแหน่งราชการเป็นของตัวบุคคล ไม่ตกทอด — คนที่ไม่ใช่ผู้เล่นแล้ว (รุ่นก่อน) ไม่ต้องเดินระบบ
  if (!isAlive(player)) return { lines, events };
  // รับราชการในแผ่นดินใด → ตระกูลถูกนับเป็นฝ่ายนั้น (lore: event.thonburi_succession_2325)
  const year = yearOf(ctx, S.meta.day);
  const era = player.office && C.factionByEra.find((e) => year >= e.from && year <= e.to);
  const dyn = player.dynastyId ? S.dynasties[player.dynastyId] : undefined;
  if (era && dyn && dyn.faction !== era.faction) {
    dyn.faction = era.faction;
    lines.push(`ตระกูล${dyn.name}นับเป็น${ctx.tags.label(era.faction as never)} เพราะ${player.name}รับราชการในแผ่นดินนี้`);
  }
  const parents = livingParents(ctx, player);
  const elder = parents.find((p) => p.householdId === player.householdId) ?? parents[0];
  const bind = { actor: player.id, ...(elder ? { elder: elder.id } : {}) };

  if (!player.office && player.formerOffice) {
    // ราชสำนักใหม่เรียกผู้ที่เคยมีตำแหน่ง — ผ่านช่วงปีไปแล้วก็หมดโอกาส
    if (year >= C.recallYears[0] && year <= C.recallYears[1]) events.push({ event: 'career.recall', bindings: bind });
    else if (year > C.recallYears[1]) delete player.formerOffice;
    return { lines, events };
  }
  if (!player.office) {
    const age = ageOf(ctx, player);
    const courtLvl = legacyLevel(ctx, player, 'court');
    const chance = C.entryChance + (courtLvl >= 1 ? 0.25 : 0);
    if (player.sex === 'm' && player.social.estate === 'noble' && elder && age >= C.entryAge[0] && age <= C.entryAge[1]
      && ctx.rng.chance(chance)) {
      events.push({ event: 'career.present_page', bindings: bind });
    } else if (player.sex === 'm' && player.social.estate === 'noble' && age > C.entryAge[1] && age >= C.lateEntryAge[0] && age <= C.lateEntryAge[1]
      && ctx.rng.chance(C.lateEntryChance + (courtLvl >= 1 ? 0.1 : 0))) {
      // ผู้สืบที่เป็นผู้ใหญ่แล้วไม่มีทางถวายตัวเป็นมหาดเล็ก — ฝากตัวเข้ากรมโดยตรง (ตัวเลขเป็นของเกม; ขั้นตอนอนุมานจาก social.royal_pages_1680s)
      events.push({ event: 'career.petition', bindings: { actor: player.id } });
    }
    return { lines, events };
  }

  const post = must(postOf(ctx, player), player.office.postId);
  const courtLvl = legacyLevel(ctx, player, 'court');
  const incomeMult = (courtLvl >= 4 ? 1.25 : 1) * (hasPerk(player, 'stewardship_4') ? 1.15 : 1);
  const income = Math.round(post.sakdina * C.incomePerSakdina * incomeMult);
  if (income > 0) {
    player.social.wealth += income;
    lines.push(`ได้ของกำนัลและผลประโยชน์ตามตำแหน่ง ${income} ตำลึง`);
  }
  if (courtLvl >= 2) {
    player.office.favor = Math.min(1, player.office.favor + 0.03);
  }
  const years = Math.floor((S.meta.day - player.office.sinceDay) / DAYS_PER_YEAR);
  const minYears = Math.max(1, post.minYears - (courtLvl >= 3 ? 1 : 0));
  // ฝากตัวกับขุนนางผู้ใหญ่ไว้ (adult.court_feast → pledge): ผู้ใหญ่ยังอยู่และยังเอ็นดู → ช่วยพูดให้ทุกปี
  //  (lore: social.protection_patronage — ฝากตัวกับผู้มีอำนาจแลกการคุ้มครอง; ตัวเลขเป็นของเกม)
  const patron = Object.values(S.relations).find((r) => r.from === player.id && r.kind === 'patron' && r.strength >= 0.6
    && isAlive(S.characters[r.to]) && opinion(ctx, r.to, player.id) > 0);
  if (patron) {
    player.office.favor = Math.min(1, player.office.favor + C.patronFavor);
    lines.push(`${S.characters[patron.to]!.name}ช่วยพูดถึง${player.name}ให้เจ้ากรมฟัง`);
  }
  const skill = careerSkill(ctx, player);
  if (skill.favor > 0) {
    player.office.favor = Math.min(1, player.office.favor + skill.favor);
    lines.push(`ฝีมือด้าน${skill.track.name} (ขั้น ${skill.tier}) เป็นที่ประจักษ์ในกรม — ความโปรดปรานเพิ่ม`);
  }
  const favor = player.office.favor;
  const next = postAt(deptOf(ctx, player), post.rank + 1);
  // มหาดเล็กพ้นไปเข้ากรม → เลือกกรมก่อน (เลื่อนขั้นแรกไปพร้อมกัน)
  const promotion = post.rank === 0 ? 'career.assign_department' : 'career.promotion';
  // มหาดเล็กเป็นชายหนุ่ม แก่สุดไม่ถึง 25 (lore: social.royal_pages_1680s) — ถึงวัยแล้วได้ตำแหน่งในกรม หรือพ้นไป
  if (post.rank === 0 && ageOf(ctx, player) >= C.pageMaxAge) {
    if (favor > C.punishAt && next) events.push({ event: promotion, bindings: bind });
    else lines.push(...applyCareer(ctx, player, 'dismiss'));
    return { lines, events };
  }
  if (favor <= C.punishAt) {
    events.push({ event: post.rank === 0 ? 'career.punished_page' : 'career.punished', bindings: bind });
  } else if (favor >= C.promoteAt && next && years >= minYears && (!next.unique || ctx.rng.chance(C.uniqueVacancyChance))) {
    events.push({ event: promotion, bindings: bind });
  }
  player.office.favor = player.office.favor * C.favorDecay;
  return { lines, events };
}

/** ข้อความในแผงตัวละคร */
export function officeStatus(ctx: Ctx, ch: Character): string | null {
  const post = postOf(ctx, ch);
  if (!post || !ch.office) return null;
  const years = Math.floor((ctx.state.meta.day - ch.office.sinceDay) / DAYS_PER_YEAR);
  const f = ch.office.favor;
  const mood = f >= 0.3 ? 'เป็นที่โปรดปราน' : f <= -0.3 ? 'กำลังถูกเพ่งเล็ง' : 'ทรงตัว';
  const where = post.rank === 0 ? 'ในวัง' : deptOf(ctx, ch).label.th;
  const skill = careerSkill(ctx, ch);
  const help = skill.tier > 0
    ? `วิชา${skill.track.name} ขั้น ${skill.tier} ช่วยให้เป็นที่โปรดปรานขึ้น ${+(skill.favor * 100).toFixed(1)}% ต่อปี`
    : `ฝึกวิชา${skill.track.name}จะช่วยให้เลื่อนยศเร็วขึ้น`;
  return `${ch.social.title ?? post.label.th} ${where} · ศักดินา ${post.sakdina} · อยู่ในตำแหน่ง ${years} ปี · ${mood} · ${help}`;
}

/** ข้อความใต้ตัวเลือก event ราชการ — ราคา/ผลที่ตามมาให้เห็นก่อนเลือก */
export function careerHint(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'enter_dept' | 'promote' | 'demote' | 'dismiss', deptId?: string,
): string | undefined {
  const post = postOf(ctx, ch);
  const dept = deptOf(ctx, ch);
  const C = ctx.content.balance.career;
  if (action === 'enter') {
    const first = postAt(dept, 0);
    return first ? `ศักดินา ${first.sakdina} · เข้าเวรในวัง ไม่ได้อยู่ช่วยงานบ้านราว ${Math.round(C.dutyLabor * 100)}%` : undefined;
  }
  if (action === 'promote' || action === 'assign') {
    const to = action === 'assign' ? ctx.content.offices.departments.find((d) => d.id === deptId) : dept;
    const next = to && post && postAt(to, post.rank + 1);
    if (!to || !next) return undefined;
    // ชื่อเดิมใช้ต่อได้ → บอกชื่อ; ได้ชื่อใหม่ (สุ่มตอนเลื่อน) → …
    const keep = ch.office?.name && namePool(to, next).includes(ch.office.name);
    const name = next.title?.includes('{name}') ? (keep ? ch.office!.name : '…') : undefined;
    const top = to.posts.reduce((a, p) => (p.rank > a.rank ? p : a));
    return `เป็น${titleOf(next, name) ?? next.label.th} ศักดินา ${next.sakdina} · บารมีตระกูล +${C.promotePrestige * next.rank}` +
      (action === 'assign' ? ` · สูงสุดเป็น${top.title?.includes('{name}') ? top.label.th : top.title ?? top.label.th} นา ${top.sakdina}` : '');
  }
  if (action === 'enter_dept') {
    const first = ctx.content.offices.departments.find((d) => d.id === deptId)?.posts.find((p) => p.rank === 1);
    return first ? `เป็น${titleOf(first, first.title?.includes('{name}') ? '…' : undefined) ?? first.label.th} ศักดินา ${first.sakdina} · เข้าเวรรับราชการ ไม่ได้อยู่ช่วยงานบ้านราว ${Math.round(C.dutyLabor * 100)}%` : undefined;
  }
  if (action === 'demote') {
    const prev = post && postAt(dept, post.rank - 1);
    return prev ? `ลดเป็น${prev.label.th} ศักดินา ${prev.sakdina}` : 'ถูกถอดจากราชการ';
  }
  return 'ถูกถอดจากราชการ';
}
