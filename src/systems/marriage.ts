import { isAlive, yearOf, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, CharacterId, Estate, MarriageStep } from '../core/types';
import { familiarity, setRelation } from './acquaintance';
import { livingParents, livingSpouse, wed } from './factory';
import { adjustBond } from './will';

// ============================================================================
// Marriage — แต่งงานเป็นเรื่องของสองบ้าน ไม่ใช่สองคน
//
//  เกี้ยวสำเร็จ (ใจหญิงตอบรับ) ──► propose: ผู้ใหญ่ยกขันหมากสามขันไปสู่ขอ ──┬─ ผู้ใหญ่ฝ่ายหญิงยอม → หมั้น
//  ผู้ใหญ่ทาบทาม / ฝากผู้ใหญ่ไปทาบทาม ──► betroth: ผู้ใหญ่ตกลงกันแล้ว ─────────┤
//                                                                          └─ ไม่ยอม → ทำใจ / รอ / พาหนีตามกัน
//  หมั้น ──► วันนัด: wed (จ่ายสินสอด) / wedService (จ่ายบางส่วน ไปช่วยงานบ้านพ่อตาแม่ยาย) / breakOff (ผิดนัด เสียขันหมาก)
//  หนีตามกัน ──► claimAfterMonths: พ่อแม่ฝ่ายหญิงมาทวงค่าน้ำนม → จ่าย / ผ่อนด้วยแรงงาน / ไม่จ่าย (เสียหน้า)
//
//  lore: kinship.parental_consent_three_seals (พ่อแม่หญิงต้องยกให้), kinship.betrothal_khanmak_three_seals (ขันหมาก
//  สามขัน วันนัด สินสอด), kinship.elopement_three_seals (หนีตามกัน → ค่าน้ำนม), kinship.courtship_liberty_1680s
//  (สามัญชนรักกันเองได้ ขุนนางผูกด้วยผู้ใหญ่), kinship.milk_money — ตัวเลขเงินเป็นค่าของเกม (balance.marriage)
// ============================================================================

const ESTATE_RANK: Record<Estate, number> = {
  royal: 6, noble: 5, monk: 4, merchant: 3, foreigner: 3, phrai_luang: 2, phrai_som: 2, that: 0,
};

const MONTH = 30;

/** เจ้าบ่าวกับเจ้าสาวของคู่นี้ */
function sides(a: Character, b: Character): { groom: Character; bride: Character } {
  return a.sex === 'm' ? { groom: a, bride: b } : { groom: b, bride: a };
}

/** สินสอดที่ผู้ใหญ่ฝ่ายหญิงเรียก: ตามฐานะฝ่ายหญิง แต่งกับคนที่ฐานะต่ำกว่าเรียกมากขึ้น */
export function sinsotFor(ctx: Ctx, a: Character, b: Character): number {
  const M = ctx.content.balance.marriage;
  const { groom, bride } = sides(a, b);
  const base = M.sinsotByEstate[bride.social.estate];
  return Math.round(base * (ESTATE_RANK[groom.social.estate] < ESTATE_RANK[bride.social.estate] ? M.marryUpFactor : 1));
}

/**
 * ใครออกเงิน: ตามตัวบทเจ้าบ่าวหรือพ่อแม่เจ้าบ่าว — มีเงินเองพอก็จ่ายเอง ไม่พอก็พ่อหรือแม่ที่เป็นหัวเรือนเดียวกัน
 * (lore: kinship.milk_money)
 */
function funds(ctx: Ctx, ch: Character): Character[] {
  const hh = ch.householdId ? ctx.state.households[ch.householdId] : undefined;
  const head = hh ? ctx.state.characters[hh.headId] : undefined;
  const parentHead = head && head !== ch && livingParents(ctx, ch).includes(head) ? head : undefined;
  return parentHead ? [ch, parentHead] : [ch];
}

export function canPay(ctx: Ctx, ch: Character, amount: number): boolean {
  return funds(ctx, ch).some((c) => c.social.wealth >= amount);
}

/** จ่ายจากคนแรกที่พอ ไม่มีใครพอก็จ่ายเท่าที่มีจากคนที่รวยที่สุด — คืนชื่อคนจ่ายและยอดที่จ่ายได้ */
function pay(ctx: Ctx, ch: Character, amount: number): { by: Character; paid: number } {
  const who = funds(ctx, ch);
  const by = who.find((c) => c.social.wealth >= amount) ?? who.sort((a, b) => b.social.wealth - a.social.wealth)[0]!;
  const paid = Math.min(amount, Math.max(0, by.social.wealth));
  by.social.wealth -= paid;
  return { by, paid };
}

const paidText = (ch: Character, r: { by: Character; paid: number }) =>
  `${r.by === ch ? '' : `${r.by.name}`}จ่าย${r.by === ch ? 'ไป ' : ' '}${Math.round(r.paid)} ตำลึง`;

/** โอกาสที่ผู้ใหญ่ฝ่ายหญิงยอมยกให้เมื่อยกขันหมากไปสู่ขอ — ฐานะฝ่ายชายสูงกว่าช่วยมาก ต่ำกว่าขวางมาก, เห็นหน้าค่าตากันมากช่วย */
export function consentChance(ctx: Ctx, a: Character, b: Character): number {
  const M = ctx.content.balance.marriage;
  const { groom, bride } = sides(a, b);
  const gap = ESTATE_RANK[groom.social.estate] - ESTATE_RANK[bride.social.estate];
  const fam = familiarity(ctx, a.id, b.id);
  return Math.min(0.95, Math.max(0.05, M.consentBase + (gap > 0 ? 0.08 * gap : 0.15 * gap) + (fam - 0.5) * 0.3));
}

function betroth(ctx: Ctx, actor: Character, other: Character): string {
  const M = ctx.content.balance.marriage;
  const months = Math.round(ctx.rng.range(M.betrothalMonths[0], M.betrothalMonths[1]));
  const sinsot = sinsotFor(ctx, actor, other);
  actor.betrothal = { toId: other.id, weddingDay: ctx.state.meta.day + months * MONTH, sinsot };
  setRelation(ctx, actor.id, other.id, 'acquaintance', Math.max(0.5, familiarity(ctx, actor.id, other.id)));
  return `หมั้นหมายกับ${other.name} นัดยกขันหมากใหญ่ไปแต่งในอีก ${months} เดือน · สินสอด ${sinsot} ตำลึง`;
}

function startService(ctx: Ctx, actor: Character, host: Character): void {
  const M = ctx.content.balance.marriage;
  actor.service = { hostId: host.id, untilDay: ctx.state.meta.day + M.serviceMonths * MONTH, labor: M.serviceLabor };
}

function losePrestige(ctx: Ctx, ch: Character, amount: number): void {
  const dyn = ch.dynastyId ? ctx.state.dynasties[ch.dynastyId] : undefined;
  if (dyn) dyn.prestige = Math.max(0, dyn.prestige - amount);
}

export interface StepResult {
  notes: string[];
  /** event ถัดไป (ผู้ใหญ่ฝ่ายหญิงไม่ยอม) */
  followUp?: string;
}

/** ทำขั้นตอนแต่งงานจาก effect ของ event — actor คือผู้เล่น other คืออีกฝ่าย */
export function applyMarriageStep(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): StepResult {
  const M = ctx.content.balance.marriage;
  const notes: string[] = [];
  const free = (c: Character) => isAlive(c) && !livingSpouse(ctx, c) && !c.local?.wed;
  switch (step) {
    case 'propose': {
      if (!free(actor) || !free(other)) break;
      const r = pay(ctx, actor, M.khanmak);
      notes.push(`ยกขันหมากสามขันไปสู่ขอ${other.name} (${paidText(actor, r)})`);
      if (ctx.rng.chance(consentChance(ctx, actor, other))) notes.push(`ผู้ใหญ่บ้าน${other.name}รับขันหมาก — ${betroth(ctx, actor, other)}`);
      else return { notes, followUp: 'marriage.refused' };
      break;
    }
    case 'betroth':
      if (free(actor) && free(other)) notes.push(betroth(ctx, actor, other));
      break;
    case 'wed':
    case 'wedService': {
      const b = actor.betrothal;
      delete actor.betrothal;
      if (!b || !free(actor) || !free(other)) break;
      const amount = step === 'wed' ? b.sinsot : Math.round(b.sinsot * M.servicePays);
      notes.push(`ยกขันหมากใหญ่ไปแต่ง${other.name} สินสอด${step === 'wed' ? '' : 'ส่วนแรก'} (${paidText(actor, pay(ctx, actor, amount))})`);
      notes.push(wed(ctx, actor, other));
      if (step === 'wedService') {
        startService(ctx, actor, other);
        notes.push(`${actor.name}ต้องไปช่วยงานบ้านพ่อตาแม่ยายแทนสินสอดที่เหลืออีก ${M.serviceMonths} เดือน`);
      }
      break;
    }
    case 'breakOff':
      delete actor.betrothal;
      losePrestige(ctx, actor, M.breakOffPrestige);
      setRelation(ctx, actor.id, other.id, 'acquaintance', familiarity(ctx, actor.id, other.id) * 0.5);
      notes.push(`ผิดนัดไม่ยกขันหมากไปแต่ง ขันหมากที่หมั้นไว้ตกเป็นของบ้าน${other.name} — ${other.name}เป็นอิสระจากการหมั้น`);
      break;
    case 'elope': {
      if (!free(actor) || !free(other)) break;
      delete actor.betrothal;
      notes.push(`${actor.name}พา${other.name}หนีตามกันไป — ผู้ใหญ่ทั้งสองบ้านเสียหน้า`);
      notes.push(wed(ctx, actor, other));
      losePrestige(ctx, actor, M.elopePrestige[actor.social.estate]);
      for (const p of livingParents(ctx, actor)) adjustBond(ctx, actor, p, 'affection', M.elopeAffection);
      actor.claim = { fromId: other.id, amount: sinsotFor(ctx, actor, other), dueDay: ctx.state.meta.day + M.claimAfterMonths * MONTH };
      break;
    }
    case 'payClaim': {
      const c = actor.claim;
      delete actor.claim;
      if (c) notes.push(`จ่ายค่าน้ำนมค่าเลี้ยงดูแก่บ้าน${other.name} (${paidText(actor, pay(ctx, actor, c.amount))}) — ผู้ใหญ่บ้านนั้นหายโกรธ`);
      break;
    }
    case 'serveClaim': {
      const c = actor.claim;
      delete actor.claim;
      if (!c) break;
      notes.push(`ไปขอขมาบ้าน${other.name} และรับไปช่วยงานชดใช้ค่าน้ำนม ${M.serviceMonths} เดือน`);
      startService(ctx, actor, other);
      break;
    }
    case 'refuseClaim':
      delete actor.claim;
      losePrestige(ctx, actor, M.refuseClaimPrestige);
      actor.stress = clamp01(actor.stress + 0.05);
      notes.push(`ไม่ยอมจ่ายค่าน้ำนม — ชาวบ้านติฉินนินทาว่า${actor.name}ไม่รู้จักคุณคน`);
      break;
  }
  return { notes };
}

/** สัดส่วนแรงงานที่หายไปเพราะไปช่วยงานบ้านพ่อตาแม่ยาย */
export const serviceLabor = (ch: Character): number => ch.service?.labor ?? 0;

export interface MarriageEventRequest {
  event: string;
  bindings: Record<string, CharacterId>;
}

/** เดือนละครั้ง: วันนัดแต่ง ค่าน้ำนมที่ถูกทวง และการช่วยงานบ้านพ่อตาแม่ยาย */
export function tickMarriage(ctx: Ctx): { lines: string[]; events: MarriageEventRequest[] } {
  const S = ctx.state;
  const lines: string[] = [];
  const events: MarriageEventRequest[] = [];
  const day = S.meta.day;
  for (const ch of Object.values(S.characters)) {
    if (!ch.betrothal && !ch.claim && !ch.service) continue;
    // ผู้เล่นเปลี่ยนรุ่นหรือตายไปแล้ว — เรื่องค้างของคนก่อนจบไปด้วย
    if (!isAlive(ch) || ch.id !== S.meta.playerCharacterId) {
      delete ch.betrothal;
      delete ch.claim;
      delete ch.service;
      continue;
    }
    const elder = livingParents(ctx, ch).find((p) => p.householdId === ch.householdId) ?? livingParents(ctx, ch)[0];
    const bind = (other: Character) => ({ actor: ch.id, target: other.id, ...(elder ? { elder: elder.id } : {}) });

    const b = ch.betrothal;
    if (b) {
      const to = S.characters[b.toId];
      if (!isAlive(to) || livingSpouse(ctx, ch) || livingSpouse(ctx, to) || to.local?.wed) {
        delete ch.betrothal;
        lines.push(to && !isAlive(to) ? `${to.name}คู่หมั้นถึงแก่กรรมก่อนวันแต่ง` : 'การหมั้นหมายเป็นอันยกเลิก');
      } else if (day >= b.weddingDay && !b.called) {
        b.called = true;
        events.push({ event: 'marriage.wedding', bindings: bind(to) });
      }
    }
    const c = ch.claim;
    if (c && day >= c.dueDay && !c.called) {
      const from = S.characters[c.fromId];
      if (from) {
        c.called = true;
        events.push({ event: 'marriage.milk_claim', bindings: bind(from) });
      } else delete ch.claim;
    }
    const s = ch.service;
    if (s) {
      if (day >= s.untilDay) {
        delete ch.service;
        lines.push(`${ch.name}ช่วยงานบ้านพ่อตาแม่ยายครบกำหนดแล้ว`);
      } else {
        // แรงงานที่หายไปจากเรือนตัวเอง ต้องจ้างคนแทน (ค่าเดียวกับความตั้งใจที่ต้องไปช่วยงานบ้านคนอื่น)
        const I = ctx.content.balance.intent;
        const r = pay(ctx, ch, s.labor * I.laborValue[ch.social.estate]);
        if (r.paid <= 0) ch.stress = clamp01(ch.stress + 0.02);
      }
    }
  }
  return { lines, events };
}

/** ข้อความสถานะในแผงตัวละคร */
export function marriageStatus(ctx: Ctx, ch: Character): string[] {
  const S = ctx.state;
  const out: string[] = [];
  const dateOf = (day: number) => `เดือน ${Math.floor((day % ctx.content.balance.daysPerYear) / MONTH) + 1} พ.ศ. ${yearOf(ctx, day)}`;
  if (ch.betrothal) {
    const to = S.characters[ch.betrothal.toId];
    const ok = canPay(ctx, ch, ch.betrothal.sinsot);
    out.push(`หมั้นกับ${to?.name ?? '-'} · นัดยกขันหมากแต่ง${dateOf(ch.betrothal.weddingDay)} · สินสอด ${ch.betrothal.sinsot} ตำลึง${ok ? '' : ' (เงินยังไม่พอ)'}`);
  }
  if (ch.claim) out.push(`บ้าน${S.characters[ch.claim.fromId]?.name ?? '-'}จะมาทวงค่าน้ำนม ราว ${ch.claim.amount} ตำลึง`);
  if (ch.service) {
    const months = Math.max(0, Math.ceil((ch.service.untilDay - S.meta.day) / MONTH));
    out.push(`ช่วยงานบ้านพ่อแม่ของ${S.characters[ch.service.hostId]?.name ?? 'คู่ครอง'}ชดใช้ อีก ${months} เดือน`);
  }
  return out;
}

/** ข้อความใต้ตัวเลือกใน event แต่งงาน — ให้เห็นราคาและโอกาสก่อนเลือก */
export function marriageHint(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): string | undefined {
  const M = ctx.content.balance.marriage;
  switch (step) {
    case 'propose':
      return `ขันหมาก ${M.khanmak} ตำลึง · สินสอดราว ${sinsotFor(ctx, actor, other)} ตำลึง · ผู้ใหญ่บ้าน${other.name}น่าจะยอม ${Math.round(consentChance(ctx, actor, other) * 100)}%`;
    case 'betroth':
      return `สินสอดราว ${sinsotFor(ctx, actor, other)} ตำลึง`;
    case 'wed':
      return `จ่ายสินสอด ${actor.betrothal?.sinsot ?? sinsotFor(ctx, actor, other)} ตำลึง`;
    case 'wedService': {
      const total = actor.betrothal?.sinsot ?? sinsotFor(ctx, actor, other);
      return `จ่ายก่อน ${Math.round(total * M.servicePays)} ตำลึง แล้วไปช่วยงานบ้านพ่อตาแม่ยาย ${M.serviceMonths} เดือน (แรงงานที่บ้านหายครึ่งหนึ่ง)`;
    }
    case 'breakOff':
      return `เสียขันหมาก · บารมีตระกูล −${M.breakOffPrestige}`;
    case 'elope':
      return `ไม่ต้องจ่ายสินสอด แต่พ่อแม่ทั้งสองฝ่ายโกรธ · บารมีตระกูล −${M.elopePrestige[actor.social.estate]} · อีก ${M.claimAfterMonths} เดือนบ้าน${other.name}จะมาทวงค่าน้ำนม`;
    case 'payClaim':
      return `จ่าย ${actor.claim?.amount ?? 0} ตำลึง`;
    case 'serveClaim':
      return `ไปช่วยงานบ้าน${other.name} ${M.serviceMonths} เดือน (แรงงานที่บ้านหายครึ่งหนึ่ง)`;
    case 'refuseClaim':
      return `บารมีตระกูล −${M.refuseClaimPrestige} · ถูกนินทา`;
  }
}

/** สินสอดของ NPC ในตระกูลที่แต่งงานแบบย่อ (marryOut): ลูกชายจ่ายออก ลูกสาวได้เข้าเรือนพ่อแม่ — คืนยอด */
export function settleNpcSinsot(ctx: Ctx, member: Character, spouse: Character): number {
  const amount = sinsotFor(ctx, member, spouse);
  if (!amount) return 0;
  if (member.sex === 'm') return Math.round(pay(ctx, member, amount).paid);
  // ฝั่งเจ้าบ่าวอยู่นอกฉาก — เงินเข้าพ่อหรือแม่ที่เป็นหัวเรือนของเจ้าสาว (หรือตัวเธอเองถ้าไม่มี)
  const to = funds(ctx, member).at(-1)!;
  to.social.wealth += amount;
  return amount;
}
