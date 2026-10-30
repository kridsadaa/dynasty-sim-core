// ============================================================================
// ปฏิทิน — วันในเกม (state.meta.day) นับเป็นวันจริงตั้งแต่ 1 ม.ค. ของปี epochYear (พ.ศ.)
//
//  สุริยคติ: วันที่แบบสากล (ปฏิทินเกรกอเรียน) แสดงเป็น พ.ศ. = ค.ศ. + 543 — สำหรับผู้เล่น และชาวต่างชาติในเรื่อง
//  จันทรคติ: เดือนอ้าย–เดือน 12 ขึ้น/แรม ค่ำ ปีนักษัตร จุลศักราช ตามคัมภีร์สุริยยาตร์ — สำหรับคนในโลกเกม
//    (lore: vocab.lunar_months_1680s, vocab.lunar_calendar_mechanics, vocab.calendar_eras)
//    เดือนขาด 29 วัน/เดือนเต็ม 30 วันสลับกัน, ปีอธิกวารเดือน 7 มี 30 วัน, ปีอธิกมาสมีเดือน 8 สองหน
//    จุลศักราชขึ้นปีใหม่ที่วันเถลิงศก (ราวเมษายน) ไม่ใช่เดือนอ้าย
//
//  การคำนวณจันทรคติดัดแปลงจาก pythaidate (https://github.com/hmmbug/pythaidate) ซึ่งทำตาม
//  J.C. Eade และ Gislén & Eade (JAHH 22(3), 2019) — สัญญาอนุญาต MIT:
//    Copyright 2023 Mark Hollow
//    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
//    associated documentation files (the "Software"), to deal in the Software without restriction,
//    including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
//    and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
//    subject to the following conditions: The above copyright notice and this permission notice shall be
//    included in all copies or substantial portions of the Software.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
//    LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
//    NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
//    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ============================================================================

/** ความยาวปีเฉลี่ย — ใช้แปลงช่วงเวลาเป็นวัน (อายุ ระยะรอ) */
export const DAYS_PER_YEAR = 365.2425;
export const BE_OFFSET = 543;

/** n ปีเป็นจำนวนวัน (ปัดเป็นวันเต็ม) */
export const yearsToDays = (n: number): number => Math.round(n * DAYS_PER_YEAR);

// --- สุริยคติ ---------------------------------------------------------------

/** Julian Day Number ของวันที่เกรกอเรียน */
export function gregorianToJd(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdToGregorian(jd: number): { year: number; month: number; day: number } {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

/** JD ของวันที่ 0 ในเกม = 1 ม.ค. ของ epochYear */
export const epochJd = (epochYear: number): number => gregorianToJd(epochYear - BE_OFFSET, 1, 1);

export interface SolarDate {
  /** พ.ศ. */
  year: number;
  month: number;
  day: number;
  /** วันที่เท่าไรของปี เริ่ม 0 = 1 ม.ค. */
  dayOfYear: number;
}

export function solarDate(epochYear: number, day: number): SolarDate {
  const jd = epochJd(epochYear) + day;
  const g = jdToGregorian(jd);
  return { year: g.year + BE_OFFSET, month: g.month, day: g.day, dayOfYear: jd - gregorianToJd(g.year, 1, 1) };
}

/** ครบกี่ปีเต็มจากวัน from ถึงวัน to (นับวันเกิดตามปฏิทิน) */
export function fullYears(epochYear: number, from: number, to: number): number {
  const a = solarDate(epochYear, from);
  const b = solarDate(epochYear, to);
  return b.year - a.year - (b.month < a.month || (b.month === a.month && b.day < a.day) ? 1 : 0);
}

/** จำนวนวันในปี พ.ศ. year */
export const daysInYear = (year: number): number =>
  gregorianToJd(year - BE_OFFSET + 1, 1, 1) - gregorianToJd(year - BE_OFFSET, 1, 1);

/** วันในเกมของ 1 ม.ค. ปี พ.ศ. year */
export const yearStartDay = (epochYear: number, year: number): number => gregorianToJd(year - BE_OFFSET, 1, 1) - epochJd(epochYear);

const SOLAR_MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** "10 เม.ย. 2223" */
export const formatSolar = (d: SolarDate): string => `${d.day} ${SOLAR_MONTHS_TH[d.month - 1]} ${d.year}`;

const SOLAR_MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** "10 de Abril de 1680" — วันที่ที่ชาวยุโรปและล่ามในเรื่องใช้ (lore: vocab.portuguese_lingua_franca) */
export const formatPortuguese = (d: SolarDate): string =>
  `${d.day} de ${SOLAR_MONTHS_PT[d.month - 1]} de ${d.year - BE_OFFSET}`;

// --- จันทรคติ (สุริยยาตร์) ----------------------------------------------------

const DAYS_IN_800_YEARS = 292207;
const TIME_UNITS_IN_1_DAY = 800;
const EPOCH_OFFSET = 373;
/** JD ก่อนวันแรกของจุลศักราช 1 วัน — หรคุณ = JD − ค่านี้ */
const CS_JD_OFFSET = 1954167;

type CalType = 'A' | 'B' | 'C' | 'c';
const CAL_DAYS: Record<CalType, number> = { A: 354, B: 355, C: 384, c: 384 };

interface LsYear {
  horakhun: number;
  kammacapon: number;
  avoman: number;
  tithi: number;
  weekday: number;
  langsak: number;
  nyd: number;
  nextNyd: number;
  leapday: boolean;
  calType: CalType;
  offset: boolean;
  offsetDays: number;
}

/** ค่าประจำปีจุลศักราช ณ วันเถลิงศก */
function lsYear(year: number): LsYear {
  const horakhun = Math.floor((year * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_1_DAY) + 1;
  const kammacapon = TIME_UNITS_IN_1_DAY - ((year * DAYS_IN_800_YEARS + EPOCH_OFFSET) % TIME_UNITS_IN_1_DAY);
  const avoQuot = Math.floor((horakhun * 11 + 650) / 692);
  let avoman = (horakhun * 11 + 650) % 692;
  if (avoman === 0) avoman = 692;
  let tithi = (avoQuot + horakhun) % 30;
  if (avoman === 692) tithi -= 1;
  const weekday = horakhun % 7;

  const horakhun1 = Math.floor(((year + 1) * DAYS_IN_800_YEARS + EPOCH_OFFSET) / TIME_UNITS_IN_1_DAY) + 1;
  const tithi1 = (Math.floor((horakhun1 * 11 + 650) / 692) + horakhun1) % 30;

  const langsak = Math.max(1, tithi);
  let nyd = langsak;
  if (nyd < 6) nyd += 29;
  nyd = (weekday - nyd + 1 + 35) % 7;
  const leapday = kammacapon <= 207;

  // A ปีปกติ 354 วัน · B อธิกวาร 355 วัน · C อธิกมาส 384 วัน · c อธิกมาสที่ชนกับอธิกวาร (แก้ทีหลัง)
  let calType: CalType = 'A';
  if (tithi > 24 || tithi < 6) calType = 'C';
  if (tithi === 25 && tithi1 === 5) calType = 'A';
  if ((leapday && avoman <= 126) || (!leapday && avoman <= 137)) calType = calType !== 'C' ? 'B' : 'c';
  const nextNyd = (nyd + (calType === 'A' ? 4 : calType === 'B' ? 5 : 6)) % 7;
  return { horakhun, kammacapon, avoman, tithi, weekday, langsak, nyd, nextNyd, leapday, calType, offset: false, offsetDays: 0 };
}

const year0Cache = new Map<number, LsYear>();

/** ปีจุลศักราชที่ปรับอธิกมาส/อธิกวารเทียบกับปีข้างเคียงแล้ว */
function year0(year: number): LsYear {
  const hit = year0Cache.get(year);
  if (hit) return hit;
  const y = [lsYear(year - 2), lsYear(year - 1), lsYear(year), lsYear(year + 1), lsYear(year + 2)];
  if (y[2]!.tithi === 24 && y[3]!.tithi === 6) {
    for (const v of y) {
      v.calType = 'C';
      v.nextNyd = (v.nextNyd + 2) % 7;
    }
  }
  // อธิกมาสกับอธิกวารอยู่ปีเดียวกันไม่ได้ — ย้ายอธิกวารไปปีก่อนหรือหลังให้วันในสัปดาห์ต่อกัน
  for (const i of [1, 2, 3]) {
    if (y[i]!.calType !== 'c') continue;
    const j = y[i]!.nyd === y[i - 1]!.nextNyd ? 1 : -1;
    y[i + j]!.calType = 'B';
    y[i + j]!.nextNyd = (y[i + j]!.nextNyd + 1) % 7;
  }
  for (const i of [1, 2, 3]) {
    if (y[i - 1]!.nextNyd !== y[i]!.nyd && y[i]!.nextNyd !== y[i + 1]!.nyd) {
      y[i]!.offset = true;
      y[i]!.langsak += 1;
      y[i]!.nyd = (y[i]!.nyd + 6) % 7;
      y[i]!.nextNyd = (y[i]!.nextNyd + 6) % 7;
    }
  }
  for (const v of y) if (v.calType === 'c') v.calType = 'C';
  const r = y[2]!;
  r.offsetDays = r.langsak < 6 + Number(r.offset) ? r.langsak + 29 : r.langsak;
  if (year0Cache.size > 512) year0Cache.clear();
  year0Cache.set(year, r);
  return r;
}

// ลำดับเดือนในปีจุลศักราช: 88 = เดือน 8 หลัง, 15/16 = เดือน 5/6 ปลายปีก่อนเถลิงศก
const LUNAR_MONTHS = [0, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 8, 88, 15, 16];
const FIND_DATE: Record<'A' | 'B' | 'C', Array<[number, number]>> = {
  A: [[383, 16], [354, 15], [324, 12], [295, 11], [265, 10], [236, 9], [206, 8], [177, 7], [147, 6], [118, 5], [88, 4], [59, 3], [29, 2]],
  B: [[384, 16], [355, 15], [325, 12], [296, 11], [266, 10], [237, 9], [207, 8], [178, 7], [148, 6], [119, 5], [89, 4], [59, 3], [29, 2]],
  C: [[384, 15], [354, 12], [325, 11], [295, 10], [266, 9], [236, 8], [207, 7], [177, 6], [148, 5], [118, 14], [88, 13], [59, 3], [29, 2]],
};

/** ปีจุลศักราช เดือน (5..12, 1..4, 88, 15, 16) และวันที่ 1–30 ของ JD */
function csFromJd(jd: number): { year: number; month: number; day: number; horakhun: number } {
  const hk = jd - CS_JD_OFFSET;
  let year = Math.floor((hk * 800 - 373) / DAYS_IN_800_YEARS);
  let days: number;
  if (hk % DAYS_IN_800_YEARS === 95333) {
    // ทุก 800 ปี วันสุดท้ายของปีอธิกสุรทินที่ตรงกับปีอธิกมาส สูตรข้างบนเลยไปหนึ่งปี
    year -= 1;
    days = 365;
  } else {
    days = hk - year0(year).horakhun;
  }
  let y0 = year0(year);
  let inYear = 365 + Number(y0.leapday);
  while (days > inYear) {
    year += 1;
    days -= inYear;
    y0 = year0(year);
    inYear = 365 + Number(y0.leapday);
  }
  let d = y0.offsetDays + days;
  let month = 5;
  for (const [a, b] of FIND_DATE[y0.calType === 'c' ? 'C' : y0.calType]) {
    if (d > a) {
      d -= a;
      month = LUNAR_MONTHS[b]!;
      break;
    }
  }
  return { year, month, day: d, horakhun: hk };
}

const NAKSAT = ['ชวด', 'ฉลู', 'ขาล', 'เถาะ', 'มะโรง', 'มะเส็ง', 'มะเมีย', 'มะแม', 'วอก', 'ระกา', 'จอ', 'กุน'];
const WEEKDAYS_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export interface LunarDate {
  /** จุลศักราช */
  csYear: number;
  /** 1 = เดือนอ้าย … 12 */
  month: number;
  /** เดือน 8 หลังของปีอธิกมาส */
  secondEighth: boolean;
  /** วันที่ในเดือน 1–30: 1–15 ข้างขึ้น, 16 ขึ้นไปข้างแรม */
  day: number;
  waxing: boolean;
  /** ขึ้น/แรมกี่ค่ำ */
  phaseDay: number;
  /** วันสุดท้ายของเดือน (แรม 14 ค่ำเดือนขาด / แรม 15 ค่ำเดือนเต็ม) = เดือนดับ */
  lastDay: boolean;
  /** 0 = อาทิตย์ */
  weekday: number;
  naksat: string;
}

export function lunarFromJd(jd: number): LunarDate {
  const cs = csFromJd(jd);
  const month = cs.month === 88 ? 8 : cs.month > 12 ? cs.month - 10 : cs.month;
  const waxing = cs.day <= 15;
  // พงศาวดารขึ้นศักราชและปีนักษัตรใหม่ตั้งแต่ขึ้น 1 ค่ำเดือน 5 แม้ยังไม่ถึงวันเถลิงศก
  // (เสียกรุง 7 เม.ย. 2310 = "ขึ้น 9 ค่ำ เดือน 5 ปีกุน จ.ศ. 1129" ทั้งที่เถลิงศกปีนั้นราว 11 เม.ย.)
  const year = cs.year + (cs.month === 15 || cs.month === 16 ? 1 : 0);
  return {
    csYear: year,
    month,
    secondEighth: cs.month === 88,
    day: cs.day,
    waxing,
    phaseDay: waxing ? cs.day : cs.day - 15,
    lastDay: csFromJd(jd + 1).day === 1,
    weekday: (cs.horakhun + 6) % 7,
    naksat: NAKSAT[(year + 10) % 12]!,
  };
}

export const lunarDate = (epochYear: number, day: number): LunarDate => lunarFromJd(epochJd(epochYear) + day);

const monthName = (l: LunarDate) =>
  l.month === 1 ? 'อ้าย' : l.month === 2 ? 'ยี่' : l.secondEighth ? '8 หลัง' : String(l.month);

/** "ขึ้น 12 ค่ำ เดือน 5" */
export const formatLunarDay = (l: LunarDate): string => `${l.waxing ? 'ขึ้น' : 'แรม'} ${l.phaseDay} ค่ำ เดือน${l.month <= 2 ? '' : ' '}${monthName(l)}`;

/** "วันพุธ ขึ้น 12 ค่ำ เดือน 5 ปีวอก จ.ศ. 1042" — รูปแบบลงวันที่ในพงศาวดาร (vocab.chronicle_date_format) */
export const formatLunar = (l: LunarDate): string =>
  `วัน${WEEKDAYS_TH[l.weekday]} ${formatLunarDay(l)} ปี${l.naksat} จ.ศ. ${l.csYear}`;
