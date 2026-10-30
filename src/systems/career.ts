import { ageOf, isAlive, must, type Ctx } from '../core/ctx';
import type { Character, CharacterId, OfficePostDef } from '../core/types';
import { livingParents } from './factory';

// ============================================================================
// Career — รับราชการในกรมกองกระเวน (บันไดจากทำเนียบศักดินาจริง)
//
//  ลูกขุนนางชายอายุ 13–20 ──► พ่อแม่พาไปถวายตัวเป็นมหาดเล็ก (นา 200)
//    ──► หมื่น{ราชทินนาม} (นา 300) ──► ขุน{ราชทินนามเดิม} (นา 400) ──► หลวงอินทราบดีศรีราชรองเมือง เจ้ากรม (นา 1000)
//
//  favor (ความโปรดปราน): ขึ้นจากงานดี ลงจากความผิด/การถูกฟ้อง และคลายกลับหา 0 ทุกปี
//    ถึง promoteAt และอยู่ในตำแหน่งครบ minYears → event เลื่อนยศ · ต่ำกว่า punishAt → event ถูกลงโทษ
//  ไม่มีเบี้ยหวัด: ได้ของกำนัล/ส่วยตามศักดินาทุกปี และ event ของกำนัลที่ต้องเลือกรับหรือไม่รับ
//  เข้าเวรในวัง → แรงงานหายจากเรือน dutyLabor
//
//  lore: social.royal_pages_1680s, social.patrol_department_ladder, social.officers_no_salary_1680s,
//        social.court_punishments_1680s, social.court_attendance_rules — ตัวเลขทั้งหมดเป็นค่าของเกม
// ============================================================================

const YEAR = (ctx: Ctx) => ctx.content.balance.daysPerYear;

export function postOf(ctx: Ctx, ch: Character): OfficePostDef | undefined {
  return ch.office ? ctx.content.offices.posts.find((p) => p.id === ch.office!.postId) : undefined;
}

const postAt = (ctx: Ctx, rank: number) => ctx.content.offices.posts.find((p) => p.rank === rank);

export const officeRank = (ctx: Ctx, ch: Character): number | undefined => postOf(ctx, ch)?.rank;

/** แรงงานที่หายจากเรือนเพราะเข้าเวรในวัง */
export const officeLabor = (ctx: Ctx, ch: Character): number => (ch.office ? ctx.content.balance.career.dutyLabor : 0);

/** ชื่อตำแหน่งที่แสดง/ตั้งเป็น social.title */
function titleOf(post: OfficePostDef, name: string | undefined): string | null {
  if (!post.title) return null; // มหาดเล็กยังไม่มีบรรดาศักดิ์
  return post.title.replace('{name}', name ?? '');
}

/** ราชทินนามที่คนอื่นในตระกูลที่ยังมีชีวิตยังไม่ได้ใช้ — สุ่มจากในกรม */
function pickOfficeName(ctx: Ctx, ch: Character): string {
  const taken = new Set(Object.values(ctx.state.characters).filter((c) => isAlive(c) && c !== ch).map((c) => c.office?.name));
  const free = ctx.content.offices.names.filter((n) => !taken.has(n));
  return must(ctx.rng.pick(free.length ? free : ctx.content.offices.names), 'office name');
}

function setPost(ctx: Ctx, ch: Character, post: OfficePostDef): void {
  // ราชทินนามสุ่มไว้ตั้งแต่ถวายตัว — คำใบ้ตอนเลื่อนยศบอกชื่อที่จะได้ล่วงหน้า และหมื่น→ขุนใช้ชื่อเดียวกัน
  const name = ch.office?.name ?? pickOfficeName(ctx, ch);
  ch.office = { postId: post.id, ...(name ? { name } : {}), sinceDay: ctx.state.meta.day, favor: 0 };
  ch.social.title = titleOf(post, name);
  ch.social.sakdina = post.sakdina;
}

function addPrestige(ctx: Ctx, ch: Character, delta: number): void {
  const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
  if (dyn) dyn.prestige = Math.max(0, dyn.prestige + delta);
}

/** ทำ action ราชการจาก effect ของ event — คืนบรรทัด log */
export function applyCareer(ctx: Ctx, ch: Character, action: 'enter' | 'promote' | 'demote' | 'dismiss'): string[] {
  const C = ctx.content.balance.career;
  const post = postOf(ctx, ch);
  switch (action) {
    case 'enter': {
      if (ch.office) return [];
      const first = must(postAt(ctx, 0), 'post rank 0');
      setPost(ctx, ch, first);
      return [`${ch.name}ถวายตัวเป็น${first.label.th} (นา ${first.sakdina})`];
    }
    case 'promote': {
      const next = post && postAt(ctx, post.rank + 1);
      if (!next) return [];
      setPost(ctx, ch, next);
      addPrestige(ctx, ch, C.promotePrestige * next.rank);
      return [`${ch.name}ได้เลื่อนเป็น${ch.social.title ?? next.label.th} ${ctx.content.offices.department.label.th} ถือศักดินา ${next.sakdina}`];
    }
    case 'demote': {
      const prev = post && postAt(ctx, post.rank - 1);
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
  const years = Math.floor((S.meta.day - player.office.sinceDay) / YEAR(ctx));
  const favor = player.office.favor;
  const next = postAt(ctx, post.rank + 1);
  // มหาดเล็กเป็นชายหนุ่ม แก่สุดไม่ถึง 25 (lore: social.royal_pages_1680s) — ถึงวัยแล้วได้ตำแหน่งในกรม หรือพ้นไป
  if (post.rank === 0 && ageOf(ctx, player) >= C.pageMaxAge) {
    if (favor > C.punishAt && next) events.push({ event: 'career.promotion', bindings: bind });
    else lines.push(...applyCareer(ctx, player, 'dismiss'));
    return { lines, events };
  }
  if (favor <= C.punishAt) {
    events.push({ event: post.rank === 0 ? 'career.punished_page' : 'career.punished', bindings: bind });
  } else if (favor >= C.promoteAt && next && years >= post.minYears && (!next.unique || ctx.rng.chance(C.uniqueVacancyChance))) {
    events.push({ event: 'career.promotion', bindings: bind });
  }
  player.office.favor = favor * C.favorDecay;
  return { lines, events };
}

/** ข้อความในแผงตัวละคร */
export function officeStatus(ctx: Ctx, ch: Character): string | null {
  const post = postOf(ctx, ch);
  if (!post || !ch.office) return null;
  const years = Math.floor((ctx.state.meta.day - ch.office.sinceDay) / YEAR(ctx));
  const f = ch.office.favor;
  const mood = f >= 0.3 ? 'เป็นที่โปรดปราน' : f <= -0.3 ? 'กำลังถูกเพ่งเล็ง' : 'ทรงตัว';
  const where = post.rank === 0 ? 'ในวัง' : ctx.content.offices.department.label.th;
  return `${ch.social.title ?? post.label.th} ${where} · ศักดินา ${post.sakdina} · อยู่ในตำแหน่ง ${years} ปี · ${mood}`;
}

/** ข้อความใต้ตัวเลือก event ราชการ — ราคา/ผลที่ตามมาให้เห็นก่อนเลือก */
export function careerHint(ctx: Ctx, ch: Character, action: 'enter' | 'promote' | 'demote' | 'dismiss'): string | undefined {
  const post = postOf(ctx, ch);
  const C = ctx.content.balance.career;
  if (action === 'enter') {
    const first = postAt(ctx, 0);
    return first ? `ศักดินา ${first.sakdina} · เข้าเวรในวัง ไม่ได้อยู่ช่วยงานบ้านราว ${Math.round(C.dutyLabor * 100)}%` : undefined;
  }
  if (action === 'promote') {
    const next = post && postAt(ctx, post.rank + 1);
    const name = next?.title?.includes('{name}') ? ch.office?.name ?? '…' : undefined;
    return next ? `เป็น${titleOf(next, name) ?? next.label.th} ศักดินา ${next.sakdina} · บารมีตระกูล +${C.promotePrestige * next.rank}` : undefined;
  }
  if (action === 'demote') {
    const prev = post && postAt(ctx, post.rank - 1);
    return prev ? `ลดเป็น${prev.label.th} ศักดินา ${prev.sakdina}` : 'ถูกถอดจากราชการ';
  }
  return 'ถูกถอดจากราชการ';
}
