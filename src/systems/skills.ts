import { ageOf, isAlive, must, type Ctx } from '../core/ctx';
import type { Character, Dynasty, LegacyTrackId, SkillTrackId } from '../core/types';
import { purse, spend } from './marriage';

/** ค่าครูสอนและจ้างคนทำงานแทนระหว่างฝึกวิชา ต่อเดือน (ตำลึง) */
export const FOCUS_MONTHLY_COST = 0.5;

// ============================================================================
// วิชาประจำตัว (4 สายวิชา — ปรับจาก CK3 Lifestyle) และมรดกตระกูล (5 สาย — ปรับจาก CK3 Dynasty Legacies)
//
//  ผู้เล่นอายุ 12 ปีขึ้นไปเลือก "การฝึกฝนยามว่าง" (focus) ได้ครั้งละ 1 สาย:
//   - ทุกเดือนได้ทั้งทักษะพื้นฐาน (combat, speech, stewardship, literacy/medicine) และแต้มความชำนาญ (skillXp 0..100)
//   - แต้มครบ 100 กดปลดล็อกขั้นวิชา (perk) ขั้นถัดไปของสายนั้นได้ (สายละ 4 ขั้น)
//  ผู้นำตระกูลใช้บารมีตระกูล (prestige) ปลดล็อก "มรดกตระกูล" (legacies) ซึ่งส่งผลถาวรต่อลูกหลานทุกรุ่น
// ============================================================================

export interface PerkDef {
  id: string;
  tier: number;
  name: string;
  desc: string;
  skillBonus: Record<string, number>;
}

export interface SkillTrackDef {
  id: SkillTrackId;
  name: string;
  focusLabel: string;
  focusDesc: string;
  primarySkills: string[];
  perks: PerkDef[];
}

export const SKILL_TRACKS: SkillTrackDef[] = [
  {
    id: 'martial',
    name: 'เพลงอาวุธและการศึก',
    focusLabel: 'ซ้อมมวยคาดเชือกและเพลงดาบสองมือ',
    focusDesc: 'ฝึกหมัดมวยและกระบี่กระบองที่ลานเรือน เพิ่มทักษะการต่อสู้ ใช้ชกมวยงานวัดและนำลูกหมู่ปราบโจร',
    primarySkills: ['combat'],
    perks: [
      {
        id: 'martial_1', tier: 1, name: 'มวยคาดเชือก',
        desc: 'ทักษะการต่อสู้ +15 · ชกมวยงานวัดและซ้อมมือมีโอกาสพลาดเจ็บตัวน้อยลง',
        skillBonus: { combat: 15 },
      },
      {
        id: 'martial_2', tier: 2, name: 'เชิงดาบสองมือ',
        desc: 'ทักษะการต่อสู้ +15 · ปะทะโจรผู้ร้ายมีโอกาสพลาดน้อยลง',
        skillBonus: { combat: 15 },
      },
      {
        id: 'martial_3', tier: 3, name: 'หัวหมู่ทะลวงฟัน',
        desc: 'ทักษะการต่อสู้ +15 · ความดีความชอบในราชการที่ได้เพิ่มขึ้น 15%',
        skillBonus: { combat: 15 },
      },
      {
        id: 'martial_4', tier: 4, name: 'พิชัยสงคราม',
        desc: 'ทักษะการต่อสู้ +20 · แคล้วคลาด ลดความเสี่ยงเจ็บไข้ตายประจำปีลง 15%',
        skillBonus: { combat: 20 },
      },
    ],
  },
  {
    id: 'diplomacy',
    name: 'ถ้อยคำและเส้นสาย',
    focusLabel: 'ฝึกเจรจาพาทีและเข้าหาผู้ใหญ่',
    focusDesc: 'หัดพูดจาผูกใจคน เข้าหาผู้ใหญ่และคบค้าสมาคม ช่วยทั้งเรื่องเกี้ยวพาราสี เรื่องในเรือน และราชการ',
    primarySkills: ['speech'],
    perks: [
      {
        id: 'diplomacy_1', tier: 1, name: 'วาจาอ่อนหวาน',
        desc: 'ทักษะการพูดจา +15 · การเกี้ยวพาราสีและตีสนิทก้าวหน้าเร็วขึ้น',
        skillBonus: { speech: 15 },
      },
      {
        id: 'diplomacy_2', tier: 2, name: 'ร่มโพธิ์ร่มไทรในเรือน',
        desc: 'ทักษะการพูดจา +15 · คนในเรือนคลายความหนักใจปีละ 0.02',
        skillBonus: { speech: 15 },
      },
      {
        id: 'diplomacy_3', tier: 3, name: 'รู้ทางลมในวัง',
        desc: 'ทักษะการพูดจา +15 · ผู้รับราชการได้ความโปรดปรานเพิ่มปีละ 0.03',
        skillBonus: { speech: 15 },
      },
      {
        id: 'diplomacy_4', tier: 4, name: 'หูตากว้างไกล',
        desc: 'ทักษะการพูดจา +20 · ความดีความชอบในราชการที่ได้เพิ่มขึ้น 20%',
        skillBonus: { speech: 20 },
      },
    ],
  },
  {
    id: 'stewardship',
    name: 'การเรือนและทรัพย์สิน',
    focusLabel: 'ตรวจตรานาสวนและบัญชีเรือน',
    focusDesc: 'ดูแลไร่นา สวนผลไม้ และจัดระเบียบบ่าวไพร่ในเรือนให้งอกเงย',
    primarySkills: ['stewardship'],
    perks: [
      {
        id: 'stewardship_1', tier: 1, name: 'ตาชั่งเที่ยง',
        desc: 'ทักษะการเรือน +15 · ซื้อที่นาและปลูกขยายเรือนใช้เงินลดลง 20%',
        skillBonus: { stewardship: 15 },
      },
      {
        id: 'stewardship_2', tier: 2, name: 'นายเรือนรู้จักใช้คน',
        desc: 'ทักษะการเรือน +15 · ทาสทำนาทำสวนได้ผลผลิตเพิ่มขึ้น 25% และไม่คิดหนีง่าย',
        skillBonus: { stewardship: 15 },
      },
      {
        id: 'stewardship_3', tier: 3, name: 'เรือนใหญ่เป็นระเบียบ',
        desc: 'ทักษะการเรือน +15 · เรือนรองรับคนได้เพิ่มขึ้นอีก 3 คน และลดค่ากินอยู่ลง 20%',
        skillBonus: { stewardship: 15 },
      },
      {
        id: 'stewardship_4', tier: 4, name: 'พอกพูนทรัพย์',
        desc: 'ทักษะการเรือน +20 · รายได้จากที่นาและของกำนัลตามตำแหน่งเพิ่มขึ้น 25%',
        skillBonus: { stewardship: 20 },
      },
    ],
  },
  {
    id: 'learning',
    name: 'หนังสือ ตำรายา และพุทธคุณ',
    focusLabel: 'ค้นคว้าสมุดข่อย ตำรายา และศีลภาวนา',
    focusDesc: 'เรียนหนังสือขอม-ไทย ตำรายาสมุนไพร และหลักธรรมคำสอน เพื่อเป็นที่พึ่งของคนในเรือน',
    primarySkills: ['literacy', 'medicine'],
    perks: [
      {
        id: 'learning_1', tier: 1, name: 'รู้หนังสือขอม-ไทยแตกฉาน',
        desc: 'หนังสือขอม-ไทย +30 · เข้ารับราชการกรมราชบัณฑิตยได้ และจดตำนานตระกูลลงสมุดข่อยได้',
        skillBonus: { literacy: 30 },
      },
      {
        id: 'learning_2', tier: 2, name: 'ตำรายาสมุนไพรประจำเรือน',
        desc: 'ยาสมุนไพร +30 · คนในเรือนเจ็บไข้ตายน้อยลง 15%',
        skillBonus: { medicine: 30 },
      },
      {
        id: 'learning_3', tier: 3, name: 'โหราศาสตร์และฤกษ์ยาม',
        desc: 'หนังสือขอม-ไทย +15, ยาสมุนไพร +15 · รู้ฤกษ์ยามมงคล ได้บารมีตระกูล +0.5 และบุญ +1 ทุกปี',
        skillBonus: { literacy: 15, medicine: 15 },
      },
      {
        id: 'learning_4', tier: 4, name: 'จิตตั้งมั่นในธรรม',
        desc: 'งานบุญ +20 · ความหนักใจคลายลงปีละ 0.05 และได้บุญปีละ +2',
        skillBonus: { devotion: 20 },
      },
    ],
  },
];

export interface LegacyStepDef {
  tier: number;
  name: string;
  desc: string;
}

export interface LegacyTrackDef {
  id: LegacyTrackId;
  name: string;
  desc: string;
  steps: LegacyStepDef[];
}

export const LEGACY_TRACKS: LegacyTrackDef[] = [
  {
    id: 'court',
    name: 'สายเสวกามาตย์ (ขุนนางในวัง)',
    desc: 'ตระกูลขุนนางเก่าที่ผู้ใหญ่ในวังคุ้นชื่อ เสริมความก้าวหน้าในราชการทุกรุ่น',
    steps: [
      { tier: 1, name: 'คุ้นหน้าในท้องพระโรง', desc: 'ลูกหลานถวายตัวรับราชการแล้วได้ความดีความชอบตั้งต้นทันที' },
      { tier: 2, name: 'รับใช้ใกล้ชิด', desc: 'บารมีตระกูลที่ได้จากการเลื่อนยศเพิ่มขึ้น 25% และความโปรดปรานเพิ่มปีละ 0.03' },
      { tier: 3, name: 'ผู้ใหญ่เกรงใจ', desc: 'ระยะปีขั้นต่ำก่อนเลื่อนยศสั้นลง 1 ปี' },
      { tier: 4, name: 'เสาหลักแผ่นดิน', desc: 'ของกำนัลตามศักดินาเพิ่มขึ้น 25%' },
    ],
  },
  {
    id: 'warrior',
    name: 'สายนักรบพระนคร (เพลงอาวุธ)',
    desc: 'ตระกูลนายกองผู้สืบทอดเพลงมวยและเพลงดาบไว้ป้องกันบ้านเมือง',
    steps: [
      { tier: 1, name: 'ลานมวยประจำตระกูล', desc: 'ลูกหลานฝึกวิชาสายเพลงอาวุธและการศึกได้เร็วขึ้น 30%' },
      { tier: 2, name: 'สายเลือดนักรบ', desc: 'ลูกหลานเมื่อเข้าสู่วัยผู้ใหญ่ได้ทักษะการต่อสู้ติดตัว +15' },
      { tier: 3, name: 'ชื่อเสียงเลื่องลือ', desc: 'ชื่อเสียงนักรบ ผู้นำตระกูลได้บารมีเพิ่มปีละ 0.5 และบารมีจากการเลื่อนยศเพิ่ม 25%' },
      { tier: 4, name: 'หนังเหนียวแคล้วคลาด', desc: 'ผู้ชายในตระกูลอายุ 15 ปีขึ้นไปเจ็บไข้ตายน้อยลง 15%' },
    ],
  },
  {
    id: 'wealth',
    name: 'สายคหบดีเรือนใหญ่ (ทรัพย์และที่ดิน)',
    desc: 'ตระกูลมั่งคั่งที่มีที่นา สวนผลไม้ และบ่าวไพร่จงรักภักดีสืบต่อกัน',
    steps: [
      { tier: 1, name: 'นาดีสวนงาม', desc: 'ที่นาและสวนของเรือนให้ผลผลิตเพิ่มขึ้น 20%' },
      { tier: 2, name: 'บ่าวไพร่ภักดี', desc: 'ทาสในเรือนมีความภักดีสูงขึ้น โอกาสหนีลดลงครึ่งหนึ่ง' },
      { tier: 3, name: 'ช่างหลวงคุ้นเคย', desc: 'ค่าขยายเรือนและซื้อที่นาถูกลง 20%' },
      { tier: 4, name: 'เรือนใหญ่คับคั่ง', desc: 'เรือนของตระกูลรองรับคนได้เพิ่มขึ้นอีก 4 คนโดยไม่แออัด' },
    ],
  },
  {
    id: 'kin',
    name: 'สายวงศาคณาญาติ (สายเลือดและครอบครัว)',
    desc: 'ตระกูลใหญ่ที่เครือญาติกลมเกลียว ลูกหลานแข็งแรงและเกี่ยวดองกับบ้านมีหน้ามีตา',
    steps: [
      { tier: 1, name: 'ลูกหลานเลี้ยงง่าย', desc: 'ทารกในตระกูลแข็งแรง ลดความเสี่ยงตายวัยทารกและตอนคลอด' },
      { tier: 2, name: 'ตระกูลมีชื่อ', desc: 'คนในตระกูลทุกวัยเจ็บไข้ตายน้อยลง 10%' },
      { tier: 3, name: 'เรือนร่มเย็น', desc: 'คนในเรือนคลายความหนักใจปีละ 0.03' },
      { tier: 4, name: 'มรดกไม่รั่วไหล', desc: 'เมื่อผลัดรุ่น บารมีตระกูลเสื่อมถอยน้อยลงครึ่งหนึ่ง' },
    ],
  },
  {
    id: 'wisdom',
    name: 'สายปราชญ์และบุญญาธิการ (ตำราและวัดวา)',
    desc: 'ตระกูลผู้รู้หนังสือ มีสมุดข่อยตกทอด และเป็นโยมอุปัฏฐากวัดวาอาราม',
    steps: [
      { tier: 1, name: 'ตู้สมุดข่อยประจำเรือน', desc: 'ลูกหลานฝึกวิชาทุกสายได้เร็วขึ้น 20%' },
      { tier: 2, name: 'เรียนเขียนอ่านแต่เยาว์', desc: 'ลูกหลานได้ทักษะหนังสือขอม-ไทยติดตัว +15 เมื่อเติบโต' },
      { tier: 3, name: 'ศรัทธาตั้งมั่น', desc: 'ผู้นำตระกูลได้บุญประจำปีเพิ่ม +1.5' },
      { tier: 4, name: 'บารมีธรรมคุ้มครอง', desc: 'ทุกปีผู้นำตระกูลได้บุญ +2 และบารมีตระกูล +1' },
    ],
  },
];

export const hasPerk = (ch: Character | undefined, perkId: string): boolean =>
  Boolean(ch?.perks?.includes(perkId));

export const legacyLevel = (ctx: Ctx, ch: Character | undefined, track: LegacyTrackId): number => {
  const dynId = ch?.dynastyId ?? ctx.state.meta.playerDynastyId;
  return ctx.state.dynasties[dynId]?.legacies?.[track] ?? 0;
};

/** บารมีตระกูลที่ต้องใช้ปลดล็อกมรดกตระกูลขั้นถัดไป (ขั้นที่ 1 ใช้ 8, ขั้นต่อไปเพิ่มขึ้นตามจำนวนที่ปลดไปแล้ว) */
export function legacyCost(dyn: Dynasty): number {
  const total = Object.values(dyn.legacies ?? {}).reduce((a, b) => a + (b ?? 0), 0);
  return 8 + total * 6;
}

/** เลือกสายวิชาที่ฝึกยามว่าง */
export function setSkillFocus(ctx: Ctx, ch: Character, focus: SkillTrackId | null): string {
  if (!isAlive(ch)) throw new Error('ตัวละครไม่มีชีวิตอยู่');
  if (ageOf(ctx, ch) < 12) throw new Error('ต้องอายุอย่างน้อย 12 ปีจึงจะเลือกฝึกวิชาได้');
  if (!focus) {
    delete ch.focus;
    return `${ch.name}หยุดการฝึกวิชาประจำวัน`;
  }
  const track = must(SKILL_TRACKS.find((t) => t.id === focus), focus);
  ch.focus = focus;
  return `${ch.name}เริ่มตั้งใจ${track.focusLabel}`;
}

/** ปลดล็อกขั้นวิชาถัดไปในสายเมื่อสะสมแต้มความชำนาญครบ 100 */
export function unlockNextPerk(ch: Character, trackId: SkillTrackId): string {
  const track = must(SKILL_TRACKS.find((t) => t.id === trackId), trackId);
  const xp = ch.skillXp?.[trackId] ?? 0;
  const next = track.perks.find((p) => !hasPerk(ch, p.id));
  if (!next) throw new Error('สำเร็จวิชาสายนี้ครบทุกขั้นแล้ว');
  if (xp < 100) throw new Error(`ความชำนาญยังไม่พอ (มี ${Math.floor(xp)}/100)`);
  ch.skillXp = { ...ch.skillXp, [trackId]: xp - 100 };
  ch.perks = [...(ch.perks ?? []), next.id];
  for (const [sk, bonus] of Object.entries(next.skillBonus)) {
    ch.skills[sk] = Math.min(100, (ch.skills[sk] ?? 0) + bonus);
  }
  return `${ch.name}สำเร็จวิชา "${next.name}" (${track.name})`;
}

/** ผู้นำตระกูลใช้บารมีตระกูลปลดล็อกมรดกตระกูลขั้นถัดไป */
export function unlockDynastyLegacy(ctx: Ctx, ch: Character, trackId: LegacyTrackId): string {
  const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
  if (!dyn) throw new Error('ไม่มีตระกูล');
  if (dyn.headNodeId !== ch.familyNodeId) throw new Error('ต้องเป็นผู้นำตระกูลจึงจะกำหนดมรดกตระกูลได้');
  const track = must(LEGACY_TRACKS.find((t) => t.id === trackId), trackId);
  const cur = dyn.legacies?.[trackId] ?? 0;
  if (cur >= track.steps.length) throw new Error('ปลดล็อกสายนี้ครบทุกขั้นแล้ว');
  const cost = legacyCost(dyn);
  if (dyn.prestige < cost) throw new Error(`บารมีตระกูลไม่พอ (ต้องใช้ ${cost} มีอยู่ ${Math.round(dyn.prestige * 10) / 10})`);
  const step = track.steps[cur]!;
  dyn.prestige = Math.round((dyn.prestige - cost) * 10) / 10;
  dyn.legacies = { ...dyn.legacies, [trackId]: cur + 1 };
  // หากปลดล็อกสายที่ให้ทักษะติดตัว ให้คนในตระกูลที่โตแล้วได้รับทันทีด้วย
  if (trackId === 'warrior' && cur + 1 === 2) {
    ch.skills['combat'] = Math.min(100, (ch.skills['combat'] ?? 0) + 15);
  }
  if (trackId === 'wisdom' && cur + 1 === 2) {
    ch.skills['literacy'] = Math.min(100, (ch.skills['literacy'] ?? 0) + 15);
  }
  return `ตระกูล${dyn.name}สืบทอดมรดก "${step.name}" (${track.name} ขั้นที่ ${cur + 1})`;
}

/** ตัวคูณความเสี่ยงตายรายปี (น้อยกว่า 1 = ตายน้อยลง) จากมรดกตระกูลและวิชาของผู้เล่น */
export function mortalityShield(ctx: Ctx, ch: Character, age: number): number {
  const S = ctx.state;
  const player = S.characters[S.meta.playerCharacterId];
  let f = 1;
  if (ch.dynastyId && ch.dynastyId === S.meta.playerDynastyId) {
    const kin = legacyLevel(ctx, ch, 'kin');
    if (kin >= 1 && age < 5) f *= 0.75;
    if (kin >= 2) f *= 0.9;
    if (legacyLevel(ctx, ch, 'warrior') >= 4 && ch.sex === 'm' && age >= 15) f *= 0.85;
  }
  if (player && isAlive(player)) {
    if (ch === player && hasPerk(player, 'martial_4')) f *= 0.85;
    if (ch.householdId && ch.householdId === player.householdId && hasPerk(player, 'learning_2')) f *= 0.85;
  }
  return f;
}

/** ทุก 1 ม.ค.: ผลประจำปีของวิชาของผู้เล่นและมรดกตระกูล */
export function skillsYearTick(ctx: Ctx): string[] {
  const S = ctx.state;
  const p = S.characters[S.meta.playerCharacterId];
  const dyn = S.dynasties[S.meta.playerDynastyId];
  const log: string[] = [];
  if (!p || !isAlive(p) || !dyn) return log;
  const hh = p.householdId ? S.households[p.householdId] : undefined;
  const members = (hh?.memberIds ?? []).map((id) => S.characters[id]).filter((m) => isAlive(m)) as Character[];
  const calm = (by: number) => { for (const m of members) m.stress = Math.max(0, m.stress - by); };
  let calmBy = 0;
  if (hasPerk(p, 'diplomacy_2')) calmBy += 0.02;
  if (legacyLevel(ctx, p, 'kin') >= 3) calmBy += 0.03;
  if (calmBy) calm(calmBy);
  if (hasPerk(p, 'learning_4')) { p.stress = Math.max(0, p.stress - 0.05); p.merit += 2; }
  if (hasPerk(p, 'learning_3')) { dyn.prestige += 0.5; p.merit += 1; }
  if (hasPerk(p, 'diplomacy_3') && p.office) p.office.favor = Math.min(1, p.office.favor + 0.03);
  if (dyn.headNodeId === p.familyNodeId) {
    if (legacyLevel(ctx, p, 'warrior') >= 3) dyn.prestige += 0.5;
    if (legacyLevel(ctx, p, 'wisdom') >= 3) p.merit += 1.5;
    if (legacyLevel(ctx, p, 'wisdom') >= 4) { p.merit += 2; dyn.prestige += 1; }
  }
  return log;
}

/** ทุก 30 วัน: ตัวละครที่เลือกฝึกวิชาจะได้ทักษะและสะสมแต้มความชำนาญ */
export function skillsMonthTick(ctx: Ctx): string[] {
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  if (!isAlive(player) || ageOf(ctx, player) < 12) return [];
  const log: string[] = [];
  // โบนัสมรดกตระกูลเมื่อเข้าวัยผู้ใหญ่ครั้งแรก
  if (ageOf(ctx, player) >= 14) {
    if (legacyLevel(ctx, player, 'warrior') >= 2 && !(player.seen?.['legacy.warrior_2'] ?? 0)) {
      (player.seen ??= {})['legacy.warrior_2'] = 1;
      player.skills['combat'] = Math.min(100, (player.skills['combat'] ?? 0) + 15);
    }
    if (legacyLevel(ctx, player, 'wisdom') >= 2 && !(player.seen?.['legacy.wisdom_2'] ?? 0)) {
      (player.seen ??= {})['legacy.wisdom_2'] = 1;
      player.skills['literacy'] = Math.min(100, (player.skills['literacy'] ?? 0) + 15);
    }
  }
  if (!player.focus) return log;
  const track = SKILL_TRACKS.find((t) => t.id === player.focus);
  if (!track) return log;

  // ค่าครูและค่าเสียเวลาจ้างคนแทนงานเรือน — เงินไม่พอก็หยุดฝึกเดือนนั้น
  if (purse(ctx, player) < FOCUS_MONTHLY_COST) {
    log.push(`${player.name}ไม่มีเงินจ่ายค่าครู เดือนนี้จึงหยุดฝึกวิชา`);
    return log;
  }
  spend(ctx, player, FOCUS_MONTHLY_COST);

  let xpGain = 4;
  if (legacyLevel(ctx, player, 'wisdom') >= 1) xpGain *= 1.2;
  if (track.id === 'martial' && legacyLevel(ctx, player, 'warrior') >= 1) xpGain *= 1.3;

  for (const sk of track.primarySkills) {
    const add = track.primarySkills.length > 1 ? 0.3 : 0.6;
    player.skills[sk] = Math.min(100, Math.round(((player.skills[sk] ?? 0) + add) * 10) / 10);
  }

  const allUnlocked = track.perks.every((p) => hasPerk(player, p.id));
  if (!allUnlocked) {
    const prev = player.skillXp?.[track.id] ?? 0;
    const next = Math.min(100, Math.round((prev + xpGain) * 10) / 10);
    player.skillXp = { ...player.skillXp, [track.id]: next };
    if (prev < 100 && next >= 100) {
      const nextPerk = track.perks.find((p) => !hasPerk(player, p.id));
      if (nextPerk) log.push(`${player.name}ฝึกฝนจนพร้อมสำเร็จวิชา "${nextPerk.name}" (เปิดแท็บวิชาเพื่อปลดล็อก)`);
    }
  }
  return log;
}
