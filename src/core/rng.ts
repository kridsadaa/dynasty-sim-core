// Seeded RNG (mulberry32) — state เป็น number เดียว เก็บใน GameState.meta ได้ → replay/เซฟ deterministic

export class Rng {
  constructor(private s: number) {}

  get state(): number {
    return this.s;
  }

  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T | undefined {
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    // น้ำหนัก ≤ 0 (หรือ NaN) = ไม่มีสิทธิ์ถูกเลือกเลย
    const w = (t: T): number => {
      const x = weight(t);
      return x > 0 ? x : 0;
    };
    let total = 0;
    for (const it of items) total += w(it);
    if (total <= 0) return undefined;
    let r = this.next() * total; // [0, total)
    let last: T | undefined;
    for (const it of items) {
      const x = w(it);
      if (x === 0) continue; // ข้ามตัวน้ำหนักศูนย์ — ถ้า next() ได้ 0 พอดีจะไม่หยิบตัวแรกที่น้ำหนักศูนย์
      last = it;
      r -= x;
      if (r < 0) return it;
    }
    return last; // กัน floating error สะสม: คืนตัวสุดท้ายที่น้ำหนัก > 0
  }
}

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function softmax(scores: number[], temperature: number): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
