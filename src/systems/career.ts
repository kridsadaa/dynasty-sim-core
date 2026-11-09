import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, isAlive, must, yearOf, type Ctx } from '../core/ctx';
import type { Character, CharacterId, DepartmentDef, OfficePostDef } from '../core/types';
import type { OfficeTier } from '../art/select';
import { livingParents } from './factory';
import { opinion } from './opinion';
import { hasPerk, legacyLevel, SKILL_TRACKS } from './skills';
import { institutionActive } from './eras';
import { relationStrength, tradeOf } from './acquaintance';

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

/** ขั้นยศเชิงภาพของตำแหน่งปัจจุบัน (ใช้เลือกภาพตัวละคร) — ไม่มีตำแหน่ง = undefined; ขั้นบนสุดของกรมคือ head */
export function officeTier(ctx: Ctx, ch: Character): OfficeTier | undefined {
  const post = postOf(ctx, ch);
  if (!post) return undefined;
  if (post.rank === 0) return 'page';
  const top = deptOf(ctx, ch).posts.reduce((m, p) => Math.max(m, p.rank), 0);
  return post.rank === top ? 'head' : post.rank === 1 ? 'low' : post.rank === 2 ? 'mid' : 'high';
}

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

/** ผู้ใหญ่ที่ฝากตัวไว้ ยังมีชีวิตและยังเอ็นดู (ความผูกพันถึงเกณฑ์) */
function activePatron(ctx: Ctx, ch: Character) {
  return Object.values(ctx.state.relations).find((r) => r.from === ch.id && r.kind === 'patron' && r.strength >= 0.6
    && isAlive(ctx.state.characters[r.to]) && opinion(ctx, r.to, ch.id) > 0);
}

/** ch อยู่ในฐานะที่เข้ารับราชการได้ (ระบบราชการตอนนี้มีแต่ชายในตระกูลขุนนาง) */
export const canServe = (ch: Character) => ch.sex === 'm' && ch.social.estate === 'noble';

/**
 * other เป็นคนบ้านขุนนางที่ช่วยเรื่องราชการให้ได้ถ้าสนิทกัน — คนนอกอาชีพขุนนาง ไม่ใช่คู่ขัดหรือผู้ใหญ่ที่ฝากตัวไว้แล้ว
 * (ผู้ใหญ่ที่ฝากตัวช่วยอยู่แล้วทาง activePatron)
 */
export function nobleHouse(ctx: Ctx, ch: Character, other: Character): boolean {
  return tradeOf(ctx, other)?.estate === 'noble'
    && relationStrength(ctx, ch.id, other.id, 'rival') <= 0 && relationStrength(ctx, ch.id, other.id, 'patron') <= 0;
}

/**
 * เพื่อนสนิทจากบ้านขุนนางที่ยังมีชีวิตและยังชอบพอ — ช่วยฝากฝังเข้ารับราชการและพูดให้ในกรม
 * (ผู้ทูลรับรองฝากคนเข้ารับราชการ lore: social.official_sponsor_and_kin_liability; ตัวเลขของเกม) · มีหลายคนนับคนที่สนิทที่สุดคนเดียว
 */
export function nobleFriend(ctx: Ctx, ch: Character): Character | undefined {
  let best: Character | undefined;
  let bestStrength = 0;
  for (const r of Object.values(ctx.state.relations)) {
    if (r.from !== ch.id || r.kind !== 'friend' || r.strength < 0.5 || r.strength <= bestStrength) continue;
    const other = ctx.state.characters[r.to];
    if (!isAlive(other) || !nobleHouse(ctx, ch, other) || opinion(ctx, other.id, ch.id) <= 0) continue;
    best = other;
    bestStrength = r.strength;
  }
  return best;
}

/** คำใบ้ตอนผูกมิตรกับคนบ้านขุนนาง — ให้ผู้เล่นรู้ก่อนว่าคบแล้วได้อะไร */
export const FRIEND_HELP_HINT = 'ถ้าสนิทกัน บ้านขุนนางของเขาจะช่วยฝากฝังเข้ารับราชการและพูดให้ในกรม (ถ้าต้องโทษ เขาเสียหน้าด้วย)';

/**
 * เพื่อนที่ฝากฝังไว้เสียหน้าเมื่อผู้เล่นต้องโทษ — ความเป็นเพื่อนลดทั้งสองทาง (ตัวเลขของเกม)
 */
function blameFriend(ctx: Ctx, ch: Character): string[] {
  const f = nobleFriend(ctx, ch);
  if (!f) return [];
  const B = ctx.content.balance.career.friendBlame;
  for (const [from, to] of [[ch.id, f.id], [f.id, ch.id]] as const) {
    const rel = ctx.state.relations[`${from}|${to}|friend`];
    if (rel) rel.strength = Math.max(0, rel.strength - B);
  }
  return [`${f.name}เสียหน้าที่เคยช่วยพูดให้${ch.name} จึงห่างเหินไป`];
}

/**
 * ค่าปรับคูณตามครั้งที่ต้องโทษ: ครั้งแรกลาหนึ่ง ครั้งที่สองทวีคูณ … สูงสุดจัตุรคูณ
 * (lore: social.official_repeat_offence_escalation) — offences นับครั้งปัจจุบันแล้วตอนเกิด event
 */
export function offenceMultiple(ch: Character): number {
  return Math.min(4, Math.max(1, ch.offences ?? 1));
}

/**
 * ผู้ทูลรับรองต้องรับผิดชอบคนที่ตนฝาก (lore: social.official_sponsor_and_kin_liability)
 * — ผู้เล่นถูกลดขั้น/ถอดเพราะความผิด → ความผูกพันกับผู้ใหญ่ลดลง (ตัวเลขของเกม)
 */
function blamePatron(ctx: Ctx, ch: Character): string[] {
  const rel = Object.values(ctx.state.relations).find((r) => r.from === ch.id && r.kind === 'patron' && isAlive(ctx.state.characters[r.to]));
  if (!rel) return [];
  rel.strength = Math.max(0, rel.strength - ctx.content.balance.career.patronBlame);
  return [`${ctx.state.characters[rel.to]!.name}ถูกตำหนิที่รับรอง${ch.name} จึงไม่ค่อยอยากช่วยเหมือนก่อน`];
}

/** ริบทรัพย์ตอนถูกถอดครั้งที่ removeAtOffence (ถอดเพราะลดจนหลุดขั้นแรกไม่ริบ) */
function removalFine(ctx: Ctx, ch: Character): number {
  const C = ctx.content.balance.career;
  return (ch.offences ?? 0) >= C.removeAtOffence ? Math.round(Math.max(0, ch.social.wealth) * C.removedWealthShare) : 0;
}

/** ทำ action ราชการจาก effect ของ event — คืนบรรทัด log */
export function applyCareer(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'enter_dept' | 'promote' | 'demote' | 'dismiss' | 'remove' | 'restore' | 'decline', deptId?: string,
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
      if (!prev) return applyCareer(ctx, ch, 'remove');
      setPost(ctx, ch, prev);
      return [`${ch.name}ถูกลดลงเป็น${ch.social.title ?? prev.label.th} ศักดินา ${prev.sakdina}`, ...blamePatron(ctx, ch), ...blameFriend(ctx, ch)];
    }
    case 'remove': {
      // ถอดเพราะความผิด (ต่างจาก dismiss ที่ใช้ตอนพ้นวัยมหาดเล็ก) → ติดความผิด ยื่นเข้ากรมเองไม่ได้จนกว่าจะพ้น
      if (!ch.office) return [];
      // ผิดครั้งที่ห้า: ริบทรัพย์ก่อนเอาออก (lore: social.official_repeat_offence_escalation) — จ่ายเท่าที่มี
      const fine = removalFine(ctx, ch);
      ch.social.wealth = Math.max(0, ch.social.wealth - fine);
      ch.disgrace = { year: yearOf(ctx, ctx.state.meta.day), ...(ch.office.deptId ? { deptId: ch.office.deptId } : {}) };
      return [...(fine > 0 ? [`${ch.name}ถูกริบทรัพย์ ${fine} ตำลึง`] : []), ...applyCareer(ctx, ch, 'dismiss'), ...blamePatron(ctx, ch), ...blameFriend(ctx, ch)];
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
  if (!player.office && player.disgrace) {
    // ถูกถอดเพราะความผิด (lore: social.court_punishments_1680s) — กลับเข้าได้เมื่อมีผู้ใหญ่กราบทูลขออภัย ผลัดแผ่นดิน หรือเวลาผ่านไปนาน
    const d = player.disgrace;
    const patron = activePatron(ctx, player);
    if (patron && ctx.rng.chance(C.pardonChance)) {
      delete player.disgrace;
      lines.push(`${S.characters[patron.to]!.name}กราบทูลขออภัยโทษให้${player.name}`);
      lines.push(...applyCareer(ctx, player, d.deptId ? 'enter_dept' : 'enter', d.deptId));
    } else if (ctx.content.history.some((h) => h.kind === 'succession' && h.year === year) || year - d.year >= C.disgraceYears) {
      delete player.disgrace;
      lines.push(`ความผิดเก่าของ${player.name}ถูกลืมเลือนไปแล้ว`);
    }
    return { lines, events };
  }
  if (!player.office) {
    const age = ageOf(ctx, player);
    const courtLvl = legacyLevel(ctx, player, 'court');
    // เพื่อนสนิทบ้านขุนนางช่วยฝากฝัง → ได้โอกาสเข้ารับราชการบ่อยขึ้น และบอกในบันทึกว่าใครช่วย
    const friend = canServe(player) ? nobleFriend(ctx, player) : undefined;
    const boost = friend ? C.friendEntryBoost : 0;
    const vouched = () => friend && lines.push(`${friend.name}เพื่อนจากบ้านขุนนางช่วยฝากฝัง${player.name}กับผู้ใหญ่ในวัง`);
    const chance = C.entryChance + (courtLvl >= 1 ? 0.25 : 0) + boost;
    if (canServe(player) && elder && age >= C.entryAge[0] && age <= C.entryAge[1]
      && ctx.rng.chance(chance)) {
      vouched();
      events.push({ event: 'career.present_page', bindings: bind });
    } else if (canServe(player) && age > C.entryAge[1] && age >= C.lateEntryAge[0] && age <= C.lateEntryAge[1]
      && ctx.rng.chance(C.lateEntryChance + (courtLvl >= 1 ? 0.1 : 0) + boost)) {
      // ผู้สืบที่เป็นผู้ใหญ่แล้วไม่มีทางถวายตัวเป็นมหาดเล็ก — ฝากตัวเข้ากรมโดยตรง (ตัวเลขเป็นของเกม; ขั้นตอนอนุมานจาก social.royal_pages_1680s)
      vouched();
      events.push({ event: 'career.petition', bindings: { actor: player.id } });
    }
    return { lines, events };
  }

  const post = must(postOf(ctx, player), player.office.postId);
  const courtLvl = legacyLevel(ctx, player, 'court');
  const incomeMult = (courtLvl >= 4 ? 1.25 : 1) * (hasPerk(player, 'stewardship_4') ? 1.15 : 1);
  // ชั้นยุค: รายได้ตามศักดินา (rules.json › institutions.sakdinaIncome — ตอนนี้มีผลตลอด 2288–2400)
  const income = institutionActive(ctx, 'sakdinaIncome') ? Math.round(post.sakdina * C.incomePerSakdina * incomeMult) : 0;
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
  const patron = activePatron(ctx, player);
  if (patron) {
    player.office.favor = Math.min(1, player.office.favor + C.patronFavor);
    lines.push(`${S.characters[patron.to]!.name}ช่วยพูดถึง${player.name}ให้เจ้ากรมฟัง`);
  }
  const friend = nobleFriend(ctx, player);
  if (friend) {
    player.office.favor = Math.min(1, player.office.favor + C.friendFavor);
    lines.push(`${friend.name}เพื่อนจากบ้านขุนนางช่วยพูดถึง${player.name}ในหมู่ขุนนาง`);
  }
  const skill = careerSkill(ctx, player);
  if (skill.favor > 0) {
    player.office.favor = Math.min(1, player.office.favor + skill.favor);
    lines.push(`ฝีมือด้าน${skill.track.name} (ขั้น ${skill.tier}) เป็นที่ประจักษ์ในกรม — ความโปรดปรานเพิ่ม`);
  }
  // ตามพระยาตากฝ่าวงล้อมตั้งแต่ก่อนตั้งกรุง → เป็นคนเก่าของพระเจ้าตากในช่วงแผ่นดินธนบุรี (ตัวเลขของเกม)
  if (S.meta.war?.taksin && year >= 2311 && year <= 2324) player.office.favor = Math.min(1, player.office.favor + 0.15);
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
    // อาชญาหลวง: ขุนนางหนุ่มผิดครั้งแรกให้ภาคทัณฑ์ · ผิดซ้ำปรับเพิ่มทีละเท่า · ครั้งที่ห้าริบทรัพย์แล้วเอาออกจากราชการ
    //  (lore: social.official_probation_first_offence, social.official_repeat_offence_escalation)
    const n = (player.offences ?? 0) + 1;
    player.offences = n;
    const event = n === 1 && ageOf(ctx, player) < C.probationAge ? 'career.probation'
      : n >= C.removeAtOffence ? 'career.removed'
      : post.rank === 0 ? 'career.punished_page' : 'career.punished';
    events.push({ event, bindings: bind });
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
  const record = ch.offences ? ` · เคยต้องโทษ ${ch.offences} ครั้ง` : '';
  const friend = nobleFriend(ctx, ch);
  const friendHelp = friend ? ` · ${friend.name}เพื่อนจากบ้านขุนนางช่วยพูดให้ ${+(ctx.content.balance.career.friendFavor * 100).toFixed(1)}% ต่อปี` : '';
  return `${ch.social.title ?? post.label.th} ${where} · ศักดินา ${post.sakdina} · อยู่ในตำแหน่ง ${years} ปี · ${mood}${record} · ${help}${friendHelp}`;
}

/** ข้อความใต้ตัวเลือก event ราชการ — ราคา/ผลที่ตามมาให้เห็นก่อนเลือก */
export function careerHint(
  ctx: Ctx, ch: Character, action: 'enter' | 'assign' | 'enter_dept' | 'promote' | 'demote' | 'dismiss' | 'remove', deptId?: string,
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
    const skill = careerSkill(ctx, ch);
    return `เป็น${titleOf(next, name) ?? next.label.th} ศักดินา ${next.sakdina} · บารมีตระกูล +${C.promotePrestige * next.rank}` +
      (action === 'assign' ? ` · สูงสุดเป็น${top.title?.includes('{name}') ? top.label.th : top.title ?? top.label.th} นา ${top.sakdina}` : '') +
      (action === 'promote' && skill.tier > 0 ? ` · ฝีมือด้าน${skill.track.name}ขั้น ${skill.tier} ช่วยให้ได้เลื่อนครั้งนี้` : '');
  }
  if (action === 'enter_dept') {
    const first = ctx.content.offices.departments.find((d) => d.id === deptId)?.posts.find((p) => p.rank === 1);
    return first ? `เป็น${titleOf(first, first.title?.includes('{name}') ? '…' : undefined) ?? first.label.th} ศักดินา ${first.sakdina} · เข้าเวรรับราชการ ไม่ได้อยู่ช่วยงานบ้านราว ${Math.round(C.dutyLabor * 100)}%` : undefined;
  }
  if (action === 'demote') {
    const prev = post && postAt(dept, post.rank - 1);
    return prev ? `ลดเป็น${prev.label.th} ศักดินา ${prev.sakdina}` : 'ถูกถอดจากราชการ · ยื่นเข้ากรมเองไม่ได้จนกว่าจะพ้นโทษ';
  }
  if (action === 'remove') {
    const fine = removalFine(ctx, ch);
    return `${ch.offences ? `ความผิดครั้งที่ ${ch.offences} · ` : ''}${fine > 0 ? `ริบทรัพย์ ${fine} ตำลึง · ` : ''}ถูกถอดจากราชการ · ยื่นเข้ากรมเองไม่ได้จนกว่าจะพ้นโทษ`;
  }
  return 'ถูกถอดจากราชการ';
}
