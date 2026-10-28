import type { TagDef, TagId } from './types';

/**
 * Tag Ontology index — precompute ancestor closure ตอนโหลด content ครั้งเดียว
 * isA() จึงเป็น O(1): ใช้ทั้งตอน match ปมกับ event และตอน generalize/drift
 */
export class TagIndex {
  private closure = new Map<TagId, Map<TagId, number>>(); // tag → (ancestor → distance)
  private childMap = new Map<TagId, TagId[]>();

  constructor(private defs: Record<TagId, TagDef>) {
    for (const def of Object.values(defs)) {
      for (const p of def.parents) {
        const list = this.childMap.get(p) ?? [];
        list.push(def.id);
        this.childMap.set(p, list);
      }
    }
    for (const id of Object.keys(defs) as TagId[]) this.ancestorsOf(id);
  }

  private ancestorsOf(id: TagId): Map<TagId, number> {
    const cached = this.closure.get(id);
    if (cached) return cached;
    const m = new Map<TagId, number>([[id, 0]]);
    this.closure.set(id, m); // set ก่อน recurse กัน cycle
    for (const p of this.defs[id]?.parents ?? []) {
      for (const [a, d] of this.ancestorsOf(p)) {
        const prev = m.get(a);
        if (prev === undefined || prev > d + 1) m.set(a, d + 1);
      }
    }
    return m;
  }

  def(id: TagId): TagDef | undefined {
    return this.defs[id];
  }

  label(id: TagId): string {
    return this.defs[id]?.label.th ?? id;
  }

  isA(tag: TagId, ancestor: TagId): boolean {
    return this.ancestorsOf(tag).has(ancestor);
  }

  /** ระยะจาก tag ขึ้นไปถึง ancestor (null = ไม่เกี่ยวกัน) */
  distance(tag: TagId, ancestor: TagId): number | null {
    return this.ancestorsOf(tag).get(ancestor) ?? null;
  }

  /** ขยายชุด tag ให้รวมบรรพบุรุษทั้งหมด — ปม "food:gourd" จะชนกับ event ที่มี "food:cucumber" */
  expand(tags: Iterable<TagId>): Set<TagId> {
    const out = new Set<TagId>();
    for (const t of tags) for (const a of this.ancestorsOf(t).keys()) out.add(a);
    return out;
  }

  parents(id: TagId): TagId[] {
    return this.defs[id]?.parents ?? [];
  }

  children(id: TagId): TagId[] {
    return this.childMap.get(id) ?? [];
  }

  /** พี่น้องใน ontology (แตงกวา ↔ ฟักทอง ↔ บวบ) — ใช้ตอนปมเพี้ยนระหว่างส่งต่อรุ่น */
  siblings(id: TagId): TagId[] {
    const out = new Set<TagId>();
    for (const p of this.parents(id)) for (const c of this.children(p)) if (c !== id) out.add(c);
    return [...out];
  }

  salience(id: TagId): number {
    return this.defs[id]?.salience ?? 0.3;
  }

  prestige(id: TagId): number {
    return this.defs[id]?.prestige ?? 0;
  }
}
