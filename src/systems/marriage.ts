import { formatLunarDay, formatSolar } from '../core/calendar';
import { ageOf, isAlive, lunarOf, solarOf, yearOf, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, CharacterId, Estate, MarriageStep } from '../core/types';
import { familiarity, setRelation } from './acquaintance';
import { livingParents, livingSpouse, singleLabel, wed } from './factory';
import { adjustBond } from './will';

// ============================================================================
// Marriage — แต่งงานเป็นเรื่องของสองบ้าน ไม่ใช่สองคน
//
//  เกี้ยวสำเร็จ (ใจหญิงตอบรับ) ──► propose: ผู้ใหญ่ยกขันหมากสามขันไปสู่ขอ ──┬─ ผู้ใหญ่ฝ่ายหญิงยอม → หมั้น
//  ผู้ใหญ่ทาบทาม / ฝากผู้ใหญ่ไปทาบทาม ──► betroth: ผู้ใหญ่ตกลงกันแล้ว ─────────┤
//                                                                          └─ ไม่ยอม → ทำใจ / รอ / พาหนีตามกัน
//  หมั้น ──► วันนัด: wed (จ่ายสินสอด) / wedService (จ่ายบางส่วน ไปช่วยงานบ้านพ่อตาแม่ยาย) / breakOff (ผิดนัด เสียขันหมาก)
//  หนีตามกัน ──► อยู่ด้วยกันแต่ยังไม่เป็นผัวเมีย (ตัวบท ม.133) ไม่มีลูก ──► claimAfterMonths: พ่อแม่ฝ่ายหญิงตามมา
//              → จ่ายค่าน้ำนมค่าเลี้ยงดู+ค่าปรับแล้วแต่งตามประเพณี / จ่ายบางส่วน ช่วยงานบ้านเขาแล้วแต่ง / ส่งตัวคืน
//
//  ผู้เล่นเป็นฝ่ายหญิง (applyBrideStep): บ้านชายยกขันหมากมาสู่ขอ ผู้ใหญ่ทางบ้านตัวเองเป็นคนยอมหรือไม่ยอม
//  สินสอดเข้าบ้าน · ถอนหมั้นต้องคืนขันหมาก · หนีตามชายไปแล้วพ่อแม่คิดค่าน้ำนมเอากับลูกสาว ชายช่วยออกกึ่งหนึ่ง (ม.139)
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

/**
 * ผู้เล่นเป็นฝ่ายหญิง: ขันหมาก สินสอด ค่าปรับ มาจากบ้านเจ้าบ่าวที่อยู่นอกฉาก (เหมือน settleNpcSinsot)
 * ผู้เล่นไม่ได้ยกขันหมากไปสู่ขอใคร ผู้ใหญ่ทางบ้านตัวเองเป็นคนยอมหรือไม่ยอมยกให้
 */
const isBride = (ch: Character) => ch.sex === 'f';

/** เงินจากบ้านเจ้าบ่าวเข้าบ้านเจ้าสาว — เข้าพ่อหรือแม่ที่เป็นหัวเรือน (หรือตัวเธอเองถ้าไม่มี) */
function receive(ctx: Ctx, bride: Character, amount: number): Character {
  const to = funds(ctx, bride).at(-1)!;
  to.social.wealth += amount;
  return to;
}

/**
 * ลูกสาวหนีตามชายไป: พ่อแม่คิดค่าน้ำนมค่าเลี้ยงดูเอากับลูกสาว ชายที่พาไปช่วยออกกึ่งหนึ่ง (ม.139)
 * ส่วนของลูกสาวออกจากเงินของเธอเองเท่าที่มี — คืนยอดที่ชายออกและที่เธอออก
 */
function settleRunaway(ctx: Ctx, bride: Character, amount: number): { his: number; hers: number } {
  const his = Math.round(amount / 2);
  const parent = livingParents(ctx, bride)[0];
  const hers = Math.round(Math.min(amount - his, Math.max(0, bride.social.wealth)));
  bride.social.wealth -= hers;
  if (parent) parent.social.wealth += his + hers;
  return { his, hers };
}

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
  return isBride(actor)
    ? `หมั้นหมายกับ${other.name} บ้านเขาจะยกขันหมากใหญ่มาแต่งในอีก ${months} เดือน · สินสอด ${sinsot} ตำลึง`
    : `หมั้นหมายกับ${other.name} นัดยกขันหมากใหญ่ไปแต่งในอีก ${months} เดือน · สินสอด ${sinsot} ตำลึง`;
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
  /** event ถัดไป (ผู้ใหญ่ฝ่ายหญิงไม่ยอม — marriage.refused หรือ marriage.refused_f เมื่อผู้เล่นเป็นฝ่ายหญิง) */
  followUp?: string;
}

/** ทำขั้นตอนแต่งงานจาก effect ของ event — actor คือผู้เล่น other คืออีกฝ่าย */
export function applyMarriageStep(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): StepResult {
  if (isBride(actor)) return applyBrideStep(ctx, step, actor, other);
  const M = ctx.content.balance.marriage;
  const notes: string[] = [];
  const free = isFree(ctx);
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
      const day = ctx.state.meta.day;
      actor.eloped = {
        withId: other.id, sinceDay: day, dueDay: day + M.claimAfterMonths * MONTH,
        amount: Math.round(sinsotFor(ctx, actor, other) * M.elopeClaimFactor),
      };
      notes.push(`${actor.name}พา${other.name}หนีมาอยู่ด้วยกัน — ตามกฎหมายยังไม่นับเป็นผัวเมีย ผู้ใหญ่ทั้งสองบ้านเสียหน้า`);
      losePrestige(ctx, actor, M.elopePrestige[actor.social.estate]);
      for (const p of livingParents(ctx, actor)) adjustBond(ctx, actor, p, 'affection', M.elopeAffection);
      break;
    }
    case 'settleElope':
    case 'serveElope': {
      const e = actor.eloped;
      delete actor.eloped;
      if (!e || !isAlive(other) || livingSpouse(ctx, actor) || livingSpouse(ctx, other)) break;
      const amount = step === 'settleElope' ? e.amount : Math.round(e.amount * M.servicePays);
      notes.push(`ไปขอขมาพ่อแม่${other.name} จ่ายค่าน้ำนมค่าเลี้ยงดูและค่าปรับ${step === 'settleElope' ? '' : 'ส่วนแรก'} (${paidText(actor, pay(ctx, actor, amount))})`);
      notes.push(`แต่งงานกันตามประเพณี — ${wed(ctx, actor, other)}`);
      if (step === 'serveElope') {
        startService(ctx, actor, other);
        notes.push(`${actor.name}ต้องไปช่วยงานบ้านพ่อแม่${other.name}ชดใช้ส่วนที่เหลืออีก ${M.serviceMonths} เดือน`);
      }
      break;
    }
    case 'returnBride': {
      const e = actor.eloped;
      delete actor.eloped;
      if (!e) break;
      // ชายช่วยออกกึ่งหนึ่ง (ม.139) — อีกครึ่งพ่อแม่คิดเอากับลูกสาวเอง
      notes.push(`ส่งตัว${other.name}คืนพ่อแม่ เสียค่าปรับ (${paidText(actor, pay(ctx, actor, Math.round(e.amount / 2)))})`);
      setRelation(ctx, actor.id, other.id, 'acquaintance', Math.min(0.3, familiarity(ctx, actor.id, other.id)));
      actor.stress = clamp01(actor.stress + 0.1);
      break;
    }
  }
  return { notes };
}

const isFree = (ctx: Ctx) => (c: Character) =>
  isAlive(c) && !livingSpouse(ctx, c) && !c.local?.wed && !c.eloped && !isElopedPartner(ctx, c);

/** ขั้นตอนเดียวกันเมื่อผู้เล่นเป็นฝ่ายหญิง — other คือชาย บ้านเขาเป็นฝ่ายมาสู่ขอและออกเงิน */
function applyBrideStep(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): StepResult {
  const M = ctx.content.balance.marriage;
  const notes: string[] = [];
  const free = isFree(ctx);
  switch (step) {
    case 'propose':
      if (!free(actor) || !free(other)) break;
      notes.push(`ผู้ใหญ่บ้าน${other.name}ยกขันหมากสามขันมาสู่ขอ${actor.name}`);
      if (ctx.rng.chance(consentChance(ctx, actor, other))) notes.push(`ผู้ใหญ่ทางบ้านรับขันหมาก — ${betroth(ctx, actor, other)}`);
      else return { notes, followUp: 'marriage.refused_f' };
      break;
    case 'betroth':
      if (free(actor) && free(other)) notes.push(betroth(ctx, actor, other));
      break;
    case 'wed':
    case 'wedService': {
      const b = actor.betrothal;
      delete actor.betrothal;
      if (!b || !free(actor) || !free(other)) break;
      const to = receive(ctx, actor, b.sinsot);
      notes.push(`บ้าน${other.name}ยกขันหมากใหญ่มาแต่ง สินสอด ${b.sinsot} ตำลึงเข้า${to === actor ? 'มือ' : 'บ้าน'}${to.name}`);
      notes.push(wed(ctx, actor, other));
      break;
    }
    case 'breakOff': {
      // ฝ่ายหญิงถอนหมั้นเอง — ขันหมากที่รับไว้ต้องคืนบ้านเขา
      delete actor.betrothal;
      losePrestige(ctx, actor, M.breakOffPrestige);
      setRelation(ctx, actor.id, other.id, 'acquaintance', familiarity(ctx, actor.id, other.id) * 0.5);
      notes.push(`ไม่ยอมแต่งตามนัด คืนขันหมากให้บ้าน${other.name} (${paidText(actor, pay(ctx, actor, M.khanmak))}) — ${actor.name}เป็นอิสระจากการหมั้น`);
      break;
    }
    case 'elope': {
      if (!free(actor) || !free(other)) break;
      delete actor.betrothal;
      const day = ctx.state.meta.day;
      actor.eloped = {
        withId: other.id, sinceDay: day, dueDay: day + M.claimAfterMonths * MONTH,
        amount: Math.round(sinsotFor(ctx, actor, other) * M.elopeClaimFactor),
      };
      notes.push(`${actor.name}หนีตาม${other.name}ไปอยู่ด้วยกัน — ตามกฎหมายยังไม่นับเป็นผัวเมีย ผู้ใหญ่ทั้งสองบ้านเสียหน้า`);
      losePrestige(ctx, actor, M.elopePrestige[actor.social.estate]);
      for (const p of livingParents(ctx, actor)) adjustBond(ctx, actor, p, 'affection', M.elopeAffection);
      break;
    }
    case 'settleElope':
    case 'serveElope': {
      const e = actor.eloped;
      delete actor.eloped;
      if (!e || !isAlive(other) || livingSpouse(ctx, actor) || livingSpouse(ctx, other)) break;
      const { his, hers } = settleRunaway(ctx, actor, e.amount);
      notes.push(`กลับไปกราบขอขมาพ่อแม่ ${other.name}ช่วยออกค่าน้ำนมค่าเลี้ยงดูกึ่งหนึ่ง ${his} ตำลึง${hers ? ` ${actor.name}ออกเองอีก ${hers} ตำลึง` : ''}`);
      notes.push(`แต่งงานกันตามประเพณี — ${wed(ctx, actor, other)}`);
      break;
    }
    case 'returnBride': {
      const e = actor.eloped;
      delete actor.eloped;
      if (!e) break;
      // กลับบ้านไม่ได้แต่ง — ชายถูกปรับฐานพาลูกสาวท่านไปโดยไม่ได้คำนับ เงินเข้าพ่อแม่หญิง
      const fine = Math.round(e.amount / 2);
      const parent = livingParents(ctx, actor)[0];
      if (parent) parent.social.wealth += fine;
      notes.push(`${actor.name}กลับไปอยู่กับพ่อแม่ ไม่ได้แต่งกับ${other.name} — ${other.name}ถูกปรับ ${fine} ตำลึง`);
      setRelation(ctx, actor.id, other.id, 'acquaintance', Math.min(0.3, familiarity(ctx, actor.id, other.id)));
      actor.stress = clamp01(actor.stress + 0.1);
      break;
    }
  }
  return { notes };
}

/** คนที่ถูกใครสักคนพาหนีมาอยู่ด้วย (ยังไม่ได้แต่ง) — ไม่ว่าง ให้คนอื่นเกี้ยว/แต่งไม่ได้ */
export function isElopedPartner(ctx: Ctx, ch: Character): boolean {
  return Object.values(ctx.state.characters).some((c) => c.eloped?.withId === ch.id && isAlive(c));
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
    if (!ch.betrothal && !ch.eloped && !ch.service) continue;
    // ผู้เล่นเปลี่ยนรุ่นหรือตายไปแล้ว — เรื่องค้างของคนก่อนจบไปด้วย
    if (!isAlive(ch) || ch.id !== S.meta.playerCharacterId) {
      delete ch.betrothal;
      delete ch.eloped;
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
        events.push({ event: isBride(ch) ? 'marriage.wedding_f' : 'marriage.wedding', bindings: bind(to) });
      }
    }
    const e = ch.eloped;
    if (e) {
      const partner = S.characters[e.withId];
      if (!isAlive(partner)) {
        delete ch.eloped;
        if (partner) lines.push(`${partner.name}ถึงแก่กรรมก่อนได้แต่งงานกันตามประเพณี`);
      } else if (day >= e.dueDay && !e.called && isBride(ch) && !livingParents(ctx, ch).length) {
        // ไม่มีพ่อแม่จะตามมาทวงค่าน้ำนม — อยู่กินกันไปจนนับเป็นผัวเมีย
        delete ch.eloped;
        lines.push(`ไม่มีพ่อแม่ตามมาทวง ${ch.name}กับ${partner.name}อยู่กินกันจนคนนับเป็นผัวเมีย — ${wed(ctx, ch, partner)}`);
      } else if (day >= e.dueDay && !e.called) {
        e.called = true;
        events.push({ event: isBride(ch) ? 'marriage.milk_claim_f' : 'marriage.milk_claim', bindings: bind(partner) });
      }
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
  const dateOf = (day: number) => `${formatLunarDay(lunarOf(ctx, day))} (${formatSolar(solarOf(ctx, day))})`;
  if (ch.betrothal && isBride(ch)) {
    const to = S.characters[ch.betrothal.toId];
    out.push(`หมั้นกับ${to?.name ?? '-'} · บ้านเขาจะยกขันหมากมาแต่ง${dateOf(ch.betrothal.weddingDay)} · สินสอด ${ch.betrothal.sinsot} ตำลึง`);
  } else if (ch.betrothal) {
    const to = S.characters[ch.betrothal.toId];
    const ok = canPay(ctx, ch, ch.betrothal.sinsot);
    out.push(`หมั้นกับ${to?.name ?? '-'} · นัดยกขันหมากแต่ง${dateOf(ch.betrothal.weddingDay)} · สินสอด ${ch.betrothal.sinsot} ตำลึง${ok ? '' : ' (เงินยังไม่พอ)'}`);
  }
  if (ch.eloped && isBride(ch)) {
    const who = S.characters[ch.eloped.withId]?.name ?? '-';
    out.push(`หนีตาม${who}ไปอยู่ด้วยกัน — ยังไม่นับเป็นผัวเมีย · พ่อแม่จะตามมาราว${dateOf(ch.eloped.dueDay)} เรียกค่าน้ำนมค่าเลี้ยงดูราว ${ch.eloped.amount} ตำลึง ${who}ช่วยออกกึ่งหนึ่ง`);
  } else if (ch.eloped) {
    const who = S.characters[ch.eloped.withId]?.name ?? '-';
    out.push(`พา${who}หนีมาอยู่ด้วยกัน — ยังไม่นับเป็นผัวเมีย · พ่อแม่${who}จะตามมาราว${dateOf(ch.eloped.dueDay)} เรียกค่าน้ำนมและค่าปรับราว ${ch.eloped.amount} ตำลึง${canPay(ctx, ch, ch.eloped.amount) ? '' : ' (เงินยังไม่พอ)'}`);
  }
  if (ch.service) {
    const months = Math.max(0, Math.ceil((ch.service.untilDay - S.meta.day) / MONTH));
    out.push(`ช่วยงานบ้านพ่อแม่ของ${S.characters[ch.service.hostId]?.name ?? 'คู่ครอง'}ชดใช้ อีก ${months} เดือน`);
  }
  // พ้นวัยออกเรือนแล้วยังไม่เคยมีคู่
  const age = ageOf(ctx, ch);
  const never = (S.familyNodes[ch.familyNodeId]?.spouseIds.length ?? 0) === 0 && !ch.betrothal && !ch.eloped;
  if (never && age > ctx.content.balance.world.marriageAge[ch.sex][1]) out.push(`${singleLabel(ctx, ch.sex, age)} — พ้นวัยออกเรือนแล้วยังไม่มีคู่`);
  return out;
}

/** ข้อความใต้ตัวเลือกใน event แต่งงาน — ให้เห็นราคาและโอกาสก่อนเลือก */
export function marriageHint(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): string | undefined {
  const M = ctx.content.balance.marriage;
  if (isBride(actor)) return brideHint(ctx, step, actor, other);
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
    case 'elope': {
      const claim = Math.round(sinsotFor(ctx, actor, other) * M.elopeClaimFactor);
      return `ตามกฎหมายยังไม่เป็นผัวเมีย ยังมีลูกด้วยกันไม่ได้ · พ่อแม่ทั้งสองฝ่ายโกรธ · บารมีตระกูล −${M.elopePrestige[actor.social.estate]} · อีก ${M.claimAfterMonths} เดือนพ่อแม่${other.name}จะตามมาเรียกค่าน้ำนมและค่าปรับราว ${claim} ตำลึง`;
    }
    case 'settleElope':
      return `จ่าย ${actor.eloped?.amount ?? 0} ตำลึง แล้วแต่งงานตามประเพณี`;
    case 'serveElope':
      return `จ่ายก่อน ${Math.round((actor.eloped?.amount ?? 0) * M.servicePays)} ตำลึง แต่งงาน แล้วไปช่วยงานบ้านพ่อแม่${other.name} ${M.serviceMonths} เดือน (แรงงานที่บ้านหายครึ่งหนึ่ง)`;
    case 'returnBride':
      return `เสียค่าปรับ ${Math.round((actor.eloped?.amount ?? 0) / 2)} ตำลึง (ชายช่วยออกกึ่งหนึ่ง) · ${other.name}กลับไปอยู่บ้านพ่อแม่`;
  }
}

function brideHint(ctx: Ctx, step: MarriageStep, actor: Character, other: Character): string | undefined {
  const M = ctx.content.balance.marriage;
  const claim = actor.eloped?.amount ?? Math.round(sinsotFor(ctx, actor, other) * M.elopeClaimFactor);
  switch (step) {
    case 'propose':
      return `สินสอดราว ${sinsotFor(ctx, actor, other)} ตำลึงเข้าบ้าน · ผู้ใหญ่ทางบ้านน่าจะยอม ${Math.round(consentChance(ctx, actor, other) * 100)}%`;
    case 'betroth':
      return `สินสอดราว ${sinsotFor(ctx, actor, other)} ตำลึงเข้าบ้าน`;
    case 'wed':
    case 'wedService':
      return `สินสอด ${actor.betrothal?.sinsot ?? sinsotFor(ctx, actor, other)} ตำลึงเข้าบ้าน`;
    case 'breakOff':
      return `คืนขันหมาก ${M.khanmak} ตำลึง · บารมีตระกูล −${M.breakOffPrestige}`;
    case 'elope':
      return `ตามกฎหมายยังไม่เป็นผัวเมีย ยังมีลูกด้วยกันไม่ได้ · พ่อแม่ทั้งสองฝ่ายโกรธ · บารมีตระกูล −${M.elopePrestige[actor.social.estate]} · อีก ${M.claimAfterMonths} เดือนพ่อแม่จะตามมาเรียกค่าน้ำนมค่าเลี้ยงดูราว ${claim} ตำลึง ${other.name}ช่วยออกกึ่งหนึ่ง`;
    case 'settleElope':
    case 'serveElope': {
      const his = Math.round(claim / 2);
      return `${other.name}ออก ${his} ตำลึง · ส่วนที่เหลือ ${claim - his} ตำลึงออกจากเงินของ${actor.name}เท่าที่มี แล้วแต่งงานตามประเพณี`;
    }
    case 'returnBride':
      return `ไม่ได้แต่งกับ${other.name} · ${other.name}ถูกปรับ ${Math.round(claim / 2)} ตำลึง`;
  }
}

/** สินสอดของ NPC ในตระกูลที่แต่งงานแบบย่อ (marryOut): ลูกชายจ่ายออก ลูกสาวได้เข้าเรือนพ่อแม่ — คืนยอด */
export function settleNpcSinsot(ctx: Ctx, member: Character, spouse: Character): number {
  const amount = sinsotFor(ctx, member, spouse);
  if (!amount) return 0;
  if (member.sex === 'm') return Math.round(pay(ctx, member, amount).paid);
  // ฝั่งเจ้าบ่าวอยู่นอกฉาก — เงินเข้าพ่อหรือแม่ที่เป็นหัวเรือนของเจ้าสาว (หรือตัวเธอเองถ้าไม่มี)
  receive(ctx, member, amount);
  return amount;
}
