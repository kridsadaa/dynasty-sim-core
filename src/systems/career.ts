import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId, DepartmentDef, OfficePostDef } from '../core/types';
import { livingParents } from './factory';

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
  if (dyn) dyn.prestige = Math.max(0, dyn.prestige + delta);
}

/** ทำ action ราชการจาก effect ของ event — คืนบรรทัด log */
export function applyCareer(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'promote' | 'demote' | 'dismiss', deptId?: string,
): string[] {
  const C = ctx.content.balance.career;
  const post = postOf(ctx, ch);
  const dept = deptOf(ctx, ch);
  switch (action) {
    case 'enter': {
      if (ch.office) return [];
      const first = must(postAt(dept, 0), 'post rank 0');
      setPost(ctx, ch, first, dept);
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
  if (ch.office) ch.office.favor = Math.max(-1, Math.min(1, ch.office.favor + delta));
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

  if (!player.office) {
    const age = ageOf(ctx, player);
    if (player.sex === 'm' && player.social.estate === 'noble' && elder && age >= C.entryAge[0] && age <= C.entryAge[1]
      && ctx.rng.chance(C.entryChance)) {
      events.push({ event: 'career.present_page', bindings: bind });
    }
    return { lines, events };
  }

  const post = must(postOf(ctx, player), player.office.postId);
  const income = Math.round(post.sakdina * C.incomePerSakdina);
  if (income > 0) {
    player.social.wealth += income;
    lines.push(`ได้ของกำนัลและผลประโยชน์ตามตำแหน่ง ${income} ตำลึง`);
  }
  const years = Math.floor((S.meta.day - player.office.sinceDay) / DAYS_PER_YEAR);
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
  } else if (favor >= C.promoteAt && next && years >= post.minYears && (!next.unique || ctx.rng.chance(C.uniqueVacancyChance))) {
    events.push({ event: promotion, bindings: bind });
  }
  player.office.favor = favor * C.favorDecay;
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
  return `${ch.social.title ?? post.label.th} ${where} · ศักดินา ${post.sakdina} · อยู่ในตำแหน่ง ${years} ปี · ${mood}`;
}

/** ข้อความใต้ตัวเลือก event ราชการ — ราคา/ผลที่ตามมาให้เห็นก่อนเลือก */
export function careerHint(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'promote' | 'demote' | 'dismiss', deptId?: string,
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
  if (action === 'demote') {
    const prev = post && postAt(dept, post.rank - 1);
    return prev ? `ลดเป็น${prev.label.th} ศักดินา ${prev.sakdina}` : 'ถูกถอดจากราชการ';
  }
  return 'ถูกถอดจากราชการ';
}
