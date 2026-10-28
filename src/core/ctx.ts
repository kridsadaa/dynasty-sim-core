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

export const yearOf = (ctx: Ctx, day: Day): number =>
  ctx.content.balance.epochYear + Math.floor(day / ctx.content.balance.daysPerYear);

export const dayOfYear = (ctx: Ctx, day: Day): number => day % ctx.content.balance.daysPerYear;

export const ageOf = (ctx: Ctx, ch: Character, day: Day = ctx.state.meta.day): number =>
  Math.floor((day - ch.birthDay) / ctx.content.balance.daysPerYear);

export type Living = Character & { deathDay: null };

export const isAlive = (ch: Character | undefined): ch is Living => !!ch && ch.deathDay === null;
