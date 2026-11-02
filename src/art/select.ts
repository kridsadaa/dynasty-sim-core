// เลือกภาพจากคลังภาพสร้างล่วงหน้าด้วย tag (art/README.md ข้อ 7.4)
//   ภาพแต่ละภาพมี tag; สถานการณ์ส่ง tag ที่อยากได้มา → ให้คะแนนตาม tag ที่ตรง เลือกคะแนนสูงสุด
//   ไม่มีภาพที่ตรงเลย → null (UI ไม่แสดงช่องภาพ) — เกมต้องเล่นได้ครบแม้ไม่มีภาพสักภาพ

export type ArtStyle = 'reality' | 'chronicle' | 'portrait';

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

/** tag ที่บอกว่าภาพสร้างมาเพื่อ event หรือ role นั้นโดยตรง มีน้ำหนักกว่า tag ฉาก/ฐานะ/หมวด */
const weightOf = (tag: string) =>
  tag === 'role:pregnant' ? 8
    : tag.startsWith('role:') ? 6
      : tag.startsWith('rank:') ? 5
      : tag.startsWith('event:') || tag.startsWith('age:') ? 4
        : tag.startsWith('estate:') ? 3
          : tag.startsWith('group:') ? 1
            : 2;

export function pickArt(manifest: ArtManifest | null, style: ArtStyle, wanted: readonly string[]): ArtImage | null {
  if (!manifest || !wanted.length) return null;
  const want = new Set(wanted);
  const wantSex = wanted.find((t) => t.startsWith('sex:'));
  const wantAge = wanted.find((t) => t.startsWith('age:'));
  let best: ArtImage | null = null;
  let bestScore = 0;
  for (const img of manifest.images) {
    if (img.style !== style) continue;
    // ภาพตัวละครต้องตรงเพศและช่วงวัยเสมอ (ภาพที่ใช้ได้หลายวัยใส่ age:* หลายค่าได้)
    if (wantSex && img.tags.some((t) => t.startsWith('sex:')) && !img.tags.includes(wantSex)) continue;
    if (wantAge && img.tags.some((t) => t.startsWith('age:')) && !img.tags.includes(wantAge)) continue;
    if (style === 'portrait' && !portraitFits(img, want)) continue;
    // ภาพที่ติดขั้นยศใช้เฉพาะคนที่ยศขั้นนั้น — ไม่มีภาพขั้นนั้นก็ถอยไปใช้ภาพของบทบาทเดียวกันที่ไม่ติดขั้นยศ
    const imgRanks = img.tags.filter((t) => t.startsWith('rank:'));
    if (imgRanks.length && !imgRanks.some((t) => want.has(t))) continue;
    const score = img.tags.reduce((s, t) => s + (want.has(t) ? weightOf(t) : 0), 0);
    if (score > bestScore) [best, bestScore] = [img, score];
  }
  return best;
}

/**
 * ภาพตัวละครต้องตรงชนชั้น (ไพร่ไม่ได้ภาพนางขุนนาง) และภาพที่ติดบทบาทใช้ได้เฉพาะคนที่มีบทบาทนั้น
 * (ขุนนางไม่มีตำแหน่งไม่ได้ภาพมหาดเล็ก) — ไม่มีภาพที่ตรงก็ไม่แสดง ดีกว่าแสดงภาพผิดคน
 */
function portraitFits(img: ArtImage, want: ReadonlySet<string>): boolean {
  const estates = img.tags.filter((t) => t.startsWith('estate:'));
  if (estates.length && !estates.some((t) => want.has(t))) return false;
  const roles = img.tags.filter((t) => t.startsWith('role:'));
  return !roles.length || roles.some((t) => want.has(t));
}

/** tag ภาพของ event: id ของ event, หมวด (ส่วนหน้าของ id) และ tag ฉากที่ event ใช้ (รวมบรรพบุรุษของ tag) */
export function eventArtTags(defId: string, contextTags: Iterable<string>): string[] {
  return [`event:${defId}`, `group:${defId.split('.')[0]}`, ...contextTags];
}

/** ขั้นยศเชิงภาพ: มหาดเล็ก → หมื่น (low) → ขุน (mid) → ขั้นระหว่างขุนกับเจ้ากรม (high) → เจ้ากรม (head) */
export type OfficeTier = 'page' | 'low' | 'mid' | 'high' | 'head';

export interface PortraitSpec {
  sex: 'm' | 'f';
  age: number;
  topknotCut?: boolean;
  estate: string;
  roles?: readonly string[];
  /** ขั้นยศของคนมีตำแหน่ง (career.officeTier) — ไม่ระบุ = ไม่มีตำแหน่ง */
  rank?: OfficeTier;
}

/** tag ภาพตัวละคร: เพศ + ช่วงวัย + ชนชั้น + บทบาท (มหาดเล็ก/ขุนนางแต่ละกรม/พระ/เมียเอก/เมียน้อย/เจ้าเรือน) */
export function portraitArtTags(p: PortraitSpec): string[] {
  const ageTag = p.age < 13 && !p.topknotCut ? 'age:child' : p.age < 25 ? 'age:youth' : p.age < 50 ? 'age:adult' : 'age:elder';
  // ยังไม่มีภาพเจ้านาย — ใช้ภาพขุนนางซึ่งแต่งกายใกล้ที่สุด
  const estate = p.estate === 'royal' ? 'noble' : p.estate;
  return [`sex:${p.sex}`, ageTag, `estate:${estate}`, ...(p.roles ?? []).map((r) => `role:${r}`), ...(p.rank ? [`rank:${p.rank}`] : [])];
}
