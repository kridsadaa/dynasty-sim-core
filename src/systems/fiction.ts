import type { Ctx } from '../core/ctx';
import type { FictionEntry, HistoricalEvent } from '../core/types';

// ============================================================================
// เล่นต่อหลัง พ.ศ. 2400 — เรื่องสมมติ ไม่อิงเหตุการณ์จริง (BACKLOG → docs/SYSTEM-NOTES.md)
//  "สำรับ" เหตุการณ์ใน rules.json › fiction.deck จั่วแบบ shuffle bag ทุก ~8–15 ปี ไม่ซ้ำจนกว่าสำรับจะหมด
//  จั่วด้วย ctx.rng ในรอบประจำปี (เรียกครั้งเดียวต่อปีจาก applyHistoricalShocks) ผลเก็บใน meta.fiction จึงเซฟ/โหลดได้
//  ก่อน 2400 ไม่เรียก rng เลย → เรื่องช่วงประวัติศาสตร์เหมือนเดิมทุก seed
// ============================================================================

/** ปีที่เกมถือว่าเข้าสู่ "ยุคสมมติ" (ไม่มีสำรับ = ไม่มียุคสมมติ) */
export const fictionStart = (ctx: Ctx): number | undefined => ctx.content.fiction?.startYear;

export const isFictionYear = (ctx: Ctx, year: number): boolean => {
  const start = fictionStart(ctx);
  return start !== undefined && year >= start;
};

/** Fisher–Yates ด้วย rng ของเกม (deterministic ตาม seed) */
function shuffled<T>(ctx: Ctx, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng.next() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const asEvent = (e: FictionEntry, year: number): HistoricalEvent => {
  const { note: _note, ...rest } = e;
  return { ...rest, year };
};

/** เหตุการณ์สมมติของปีนี้ (จั่วถ้าถึงปีนัด) — เรียกครั้งเดียวต่อปี */
export function drawFictionEvents(ctx: Ctx, year: number): Array<{ ev: HistoricalEvent; note?: string }> {
  const F = ctx.content.fiction;
  if (!F || year < F.startYear) return [];
  const meta = ctx.state.meta;
  const gap = () => Math.round(ctx.rng.range(F.gap[0], F.gap[1]));
  meta.fiction ??= { next: year + gap(), bag: [], recent: [] };
  const st = meta.fiction;
  if (year < st.next) return [];
  if (!st.bag.length) st.bag = shuffled(ctx, F.deck.map((d) => d.tag));
  const tag = st.bag.pop()!;
  const entry = F.deck.find((d) => d.tag === tag);
  st.next = year + gap();
  if (!entry) return [];
  st.recent = [...st.recent, { tag, year }].slice(-6);
  return [{ ev: asEvent(entry, year), ...(entry.note ? { note: entry.note } : {}) }];
}

/** เหตุการณ์สมมติที่ถูกจั่วไว้แล้วของปี (ใช้หาภาพ/ป้าย หลังจั่วแล้ว) */
export function fictionEventsOfYear(ctx: Ctx, year: number): HistoricalEvent[] {
  const F = ctx.content.fiction;
  return (ctx.state.meta.fiction?.recent ?? [])
    .filter((r) => r.year === year)
    .flatMap((r) => { const e = F?.deck.find((d) => d.tag === r.tag); return e ? [asEvent(e, year)] : []; });
}

/** ป้าย "สภาวะบ้านเมือง" ของเหตุการณ์สมมติที่ยังไม่หมดอายุ ณ ปี now */
export function activeFiction(ctx: Ctx, now: number): HistoricalEvent[] {
  const F = ctx.content.fiction;
  return (ctx.state.meta.fiction?.recent ?? []).flatMap((r) => {
    const e = F?.deck.find((d) => d.tag === r.tag);
    return e && now >= r.year && now < r.year + (e.lasts ?? 1) ? [asEvent(e, r.year)] : [];
  });
}
