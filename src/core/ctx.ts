import { fullYears, lunarDate, solarDate, yearStartDay, type LunarDate, type SolarDate } from './calendar';
import { Rng } from './rng';
import { TagIndex } from './tags';
import type { Character, ContentDB, Day, GameState } from './types';

/** ทุก system รับ Ctx ตัวเดียว: state (mutable), content (read-only), index, rng */
export interface Ctx {
  state: GameState;
  content: ContentDB;
  tags: TagIndex;
  rng: Rng;
}

export function makeCtx(state: GameState, content: ContentDB): Ctx {
  return { state, content, tags: new TagIndex(content.tags), rng: new Rng(state.meta.rngState) };
}

/** เรียกก่อนเซฟ เพื่อเก็บสถานะ RNG ลง state */
export function commitRng(ctx: Ctx): void {
  ctx.state.meta.rngState = ctx.rng.state;
}

export function newId<T extends string>(ctx: Ctx, prefix: string): T {
  return `${prefix}_${(ctx.state.meta.nextSerial++).toString(36)}` as T;
}

export function must<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) throw new Error(`missing ${what}`);
  return v;
}

/** พ.ศ. ตามปฏิทินสุริยคติ (ขึ้นปีใหม่ 1 ม.ค.) */
export const yearOf = (ctx: Ctx, day: Day): number => solarDate(ctx.content.balance.epochYear, day).year;

/** วันที่เท่าไรของปีสุริยคติ เริ่ม 0 = 1 ม.ค. */
export const dayOfYear = (ctx: Ctx, day: Day): number => solarDate(ctx.content.balance.epochYear, day).dayOfYear;

export const solarOf = (ctx: Ctx, day: Day = ctx.state.meta.day): SolarDate => solarDate(ctx.content.balance.epochYear, day);

export const lunarOf = (ctx: Ctx, day: Day = ctx.state.meta.day): LunarDate => lunarDate(ctx.content.balance.epochYear, day);

/** วันในเกมของ 1 ม.ค. ปี พ.ศ. year */
export const yearStart = (ctx: Ctx, year: number): Day => yearStartDay(ctx.content.balance.epochYear, year);

/** ครบกี่ปีเต็มจากวัน from ถึงวัน to */
export const yearsBetween = (ctx: Ctx, from: Day, to: Day = ctx.state.meta.day): number =>
  fullYears(ctx.content.balance.epochYear, from, to);

/** อายุเต็มปี (ผ่านวันเกิดปีนี้แล้วหรือยัง) */
export const ageOf = (ctx: Ctx, ch: Character, day: Day = ctx.state.meta.day): number =>
  fullYears(ctx.content.balance.epochYear, ch.birthDay, day);

export type Living = Character & { deathDay: null };

export const isAlive = (ch: Character | undefined): ch is Living => !!ch && ch.deathDay === null;
