// เลือกภาพจากคลังภาพสร้างล่วงหน้าด้วย tag (art/README.md ข้อ 7.4)
//   ภาพแต่ละภาพมี tag; สถานการณ์ส่ง tag ที่อยากได้มา → ให้คะแนนตาม tag ที่ตรง เลือกคะแนนสูงสุด
//   ไม่มีภาพที่ตรงเลย → null (UI ไม่แสดงช่องภาพ) — เกมต้องเล่นได้ครบแม้ไม่มีภาพสักภาพ

export type ArtStyle = 'reality' | 'chronicle';

export interface ArtImage {
  id: string;
  /** path ใต้ public/ เช่น "art/scene.kitchen.webp" */
  file: string;
  style: ArtStyle;
  tags: string[];
  alt: string;
  width: number;
  height: number;
}

export interface ArtManifest {
  styleVersion: string;
  images: ArtImage[];
}

/** tag ที่บอกว่าภาพสร้างมาเพื่อ event นั้นโดยตรง มีน้ำหนักกว่า tag ฉาก/หมวด */
const weightOf = (tag: string) => (tag.startsWith('event:') ? 4 : tag.startsWith('group:') ? 1 : 2);

export function pickArt(manifest: ArtManifest | null, style: ArtStyle, wanted: readonly string[]): ArtImage | null {
  if (!manifest || !wanted.length) return null;
  const want = new Set(wanted);
  let best: ArtImage | null = null;
  let bestScore = 0;
  for (const img of manifest.images) {
    if (img.style !== style) continue;
    const score = img.tags.reduce((s, t) => s + (want.has(t) ? weightOf(t) : 0), 0);
    if (score > bestScore) [best, bestScore] = [img, score];
  }
  return best;
}

/** tag ภาพของ event: id ของ event, หมวด (ส่วนหน้าของ id) และ tag ฉากที่ event ใช้ (รวมบรรพบุรุษของ tag) */
export function eventArtTags(defId: string, contextTags: Iterable<string>): string[] {
  return [`event:${defId}`, `group:${defId.split('.')[0]}`, ...contextTags];
}
