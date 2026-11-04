import { ageOf, isAlive, type Ctx } from '../core/ctx';
import type { Character, CampaignState, CharacterId, Condition, Effect } from '../core/types';
import { adjustFavor } from './career';
import { livingChildren } from './factory';
import { markDead, settleDeath } from './handover';

// ============================================================================
// ศึกหลังเสียกรุงที่เกณฑ์คนในเรือนผู้เล่น (docs/design-war-2328.md) — เก้าทัพ 2328–2329, ท่าดินแดง 2329–2330
//  หมายเกณฑ์ถึงเรือน → ผู้เล่นเลือกไปเอง / ส่งญาติชาย / ส่งบ่าวชาย / จ่ายเงินแทน / หลบ (meta.campaigns[key])
//  คนในเรือนผู้เล่นตายได้จากตัวเลือกเท่านั้น (ผู้ใช้ตัดสิน 2026-11-04) — shock สุ่มของปีนั้นข้ามคนเหล่านี้ (campaignShockExempt)
//  ผู้ที่ถูกส่งแทนไม่ใช่ผู้เล่น ผลคำนวณอัตโนมัติตอนศึกจบ (resolveCampaign) ด้วยความเสี่ยงเท่าตัวเลือก "ทำตามคำสั่ง"
//  lore: event.nine_armies_2328, event.tha_din_daeng_2329 (attested) · event.nine_armies_options (invented — ตัวเลขทุกตัวในไฟล์นี้เป็นของเกม)
// ============================================================================

export type CampaignKey = 'nine_armies' | 'tha_din_daeng';

export const CAMPAIGNS: Record<CampaignKey, { tag: `${string}:${string}`; victory: string }> = {
  nine_armies: { tag: 'history:nine_armies', victory: 'ข่าวชัยมาถึงกรุง ทัพหลวงตีทัพหลวงพม่าที่ลาดหญ้าแตก' },
  tha_din_daeng: { tag: 'history:tha_din_daeng', victory: 'ข่าวชัยมาถึงกรุง ไทยตีค่ายพม่าที่ท่าดินแดงแตก ทัพพม่าถอยกลับเมาะตะมะ' },
};

/** วัยถูกเกณฑ์ (ตรงกับ ages ของ history:nine_armies ใน rules.json) */
export const SOLDIER_AGES: [number, number] = [18, 50];
/** โอกาสตายของคนที่ถูกส่งแทน = เท่าตัวเลือก "ทำตามคำสั่ง" (war2328.front) — ทักษะ combat 100 ลดลงได้ COMBAT_RELIEF */
export const SUBSTITUTE_DEATH = 0.1;
export const COMBAT_RELIEF = 0.08;
export const SUBSTITUTE_FLOOR = 0.05; // เท่าขอบล่างของ riskChance (5%) เพื่อให้ผลของคนที่ถูกส่งแทนตรงกับตัวเลือก "ทำตามคำสั่ง"
/** บ่าวที่ส่งไปแล้วไม่ได้กลับ */
export const SERVANT_LOST = 0.2;

const keyOfTag = (tag: string): CampaignKey | undefined =>
  (Object.keys(CAMPAIGNS) as CampaignKey[]).find((k) => CAMPAIGNS[k].tag === tag);

export const campaignOf = (ctx: Ctx, key: string): CampaignState | undefined => ctx.state.meta.campaigns?.[key];

const stateOf = (ctx: Ctx, key: string): CampaignState => {
  const all = (ctx.state.meta.campaigns ??= {});
  return (all[key] ??= {});
};

/** ข้ามทอยตาย/ถูกกวาดต้อนของ history shock ที่เป็นศึกนี้ ถ้าเป็นคนในเรือนผู้เล่นที่ถูกเกณฑ์แล้ว (ตายได้เฉพาะตัวเลือก) */
export function campaignShockExempt(ctx: Ctx, c: Character, tag: string): boolean {
  const key = keyOfTag(tag);
  if (!key || campaignOf(ctx, key)?.mode === undefined) return false;
  const player = ctx.state.characters[ctx.state.meta.playerCharacterId];
  return !!player?.householdId && c.householdId === player.householdId;
}

/**
 * ชายวัยถูกเกณฑ์ที่มีชีวิตในเรือนเดียวกับ head — ไม่นับ head เอง หัวเรือน และผู้นำตระกูล
 * (คนที่ตายแล้วต้องแบ่งมรดกและส่งต่อตำแหน่ง ซึ่งผลตอนศึกจบไม่ได้ทำให้ครบ)
 */
function householdMen(ctx: Ctx, head: Character): Character[] {
  const hh = head.householdId ? ctx.state.households[head.householdId] : undefined;
  const dynastyHead = (c: Character) => !!c.dynastyId && ctx.state.dynasties[c.dynastyId]?.headNodeId === c.familyNodeId;
  return (hh?.memberIds ?? [])
    .map((id) => ctx.state.characters[id])
    .filter((c): c is Character => !!c && c.id !== head.id && c.id !== hh?.headId && !dynastyHead(c) && c.sex === 'm' && isAlive(c)
      && ageOf(ctx, c) >= SOLDIER_AGES[0] && ageOf(ctx, c) <= SOLDIER_AGES[1]);
}

/** คนที่หัวเรือนส่งแทนได้: son = ลูกชายในเรือน · kin = ญาติชายคนอื่นในเรือน (น้อง หลาน เขย) — เลือกคนที่อายุมากสุดก่อน */
export function substituteFor(ctx: Ctx, head: Character, kind: 'son' | 'kin'): Character | undefined {
  const sons = new Set(livingChildren(ctx, head).map((c) => c.id));
  return householdMen(ctx, head)
    .filter((c) => (kind === 'son') === sons.has(c.id))
    .sort((a, b) => ageOf(ctx, b) - ageOf(ctx, a))[0];
}

/** role ที่ event ศึกใช้ (son, kin) ผูกกับคนในเรือนของ head — ไม่มีคนก็ไม่ผูก ตัวเลือก hasRole จะหายไปเอง */
export function campaignBindings(ctx: Ctx, head: Character, roles: readonly string[]): Record<string, CharacterId> {
  const out: Record<string, CharacterId> = {};
  for (const r of roles) {
    if (r !== 'son' && r !== 'kin') continue;
    const who = head.householdId ? substituteFor(ctx, head, r) : undefined;
    if (who) out[r] = who.id;
  }
  return out;
}

/** ผู้เล่นหรือใครก็ตามที่ถูกเกณฑ์เอง ควรเห็นเงื่อนไขนี้: self = ผู้เล่นไปเอง · other = ส่งคนอื่น · none = ไม่มีใครไป */
export function campaignIs(ctx: Ctx, ch: Character, c: Extract<Condition, { type: 'campaign' }>): boolean {
  const st = campaignOf(ctx, c.key);
  switch (c.is) {
    case 'self': return st?.mode === 'self' && st.soldier === ch.id;
    case 'other': return st?.mode === 'send' || st?.mode === 'servant';
    case 'none': return st?.mode === 'pay' || st?.mode === 'dodge';
    case 'stocked': return !!st?.stocked;
    case 'retainers': {
      const r = ch.householdId ? ctx.state.households[ch.householdId]?.retainers : undefined;
      return (r ? r.that + r.phrai : 0) >= (c.min ?? 1);
    }
  }
}

type CampaignEffect = Extract<Effect, { op: 'campaign' }>;

/** ผลของตัวเลือกเรื่องหมายเกณฑ์ — คืนบรรทัดบันทึก */
export function applyCampaign(ctx: Ctx, ch: Character, e: CampaignEffect, soldier?: Character): string[] {
  const st = stateOf(ctx, e.key);
  switch (e.action) {
    case 'stock':
      st.stocked = true;
      return [];
    case 'serve':
      st.mode = 'self';
      st.soldier = ch.id;
      return [`${ch.name}รับหมายไปรวมพล`];
    case 'pay':
      st.mode = 'pay';
      return [`${ch.name}จ่ายเงินให้ทางการจ้างคนไปแทน`];
    case 'dodge':
      st.mode = 'dodge';
      return [];
    case 'conduct':
      st.conduct = e.conduct;
      return [];
    case 'send':
      if (!soldier) return [];
      st.mode = 'send';
      st.soldier = soldier.id;
      return [`${soldier.name}ออกจากเรือนไปรวมพลแทน${ch.name}`];
    case 'servant': {
      const r = ch.householdId ? ctx.state.households[ch.householdId]?.retainers : undefined;
      if (!r || r.that + r.phrai < 1) return [];
      if (r.that > 0) r.that--;
      else r.phrai--;
      st.mode = 'servant';
      return [`${ch.name}ส่งบ่าวชายไปรวมพลแทนหนึ่งคน`];
    }
  }
}

/** ผู้เล่นปัจจุบัน (หัวเรือนที่รับผลของคนที่ส่งไป) */
const playerOf = (ctx: Ctx): Character | undefined => ctx.state.characters[ctx.state.meta.playerCharacterId];

/** โอกาสตายของคนที่ถูกส่งแทน — ทักษะ combat ช่วยลด */
export const substituteDeathChance = (c: Character): number =>
  Math.max(SUBSTITUTE_FLOOR, SUBSTITUTE_DEATH - ((c.skills.combat ?? 0) / 100) * COMBAT_RELIEF);

/** ศึกจบ: ข่าวชัย + ผลของคนที่ไปแทน (อัตโนมัติ) — เรียกจากตารางนัดหมาย `resolve` ไม่ต้องมีผู้เล่นมีชีวิต */
export function resolveCampaign(ctx: Ctx, key: string): string[] {
  const def = CAMPAIGNS[key as CampaignKey];
  if (!def) return [];
  const lines = [def.victory];
  const st = campaignOf(ctx, key);
  const head = playerOf(ctx);
  if (!st?.mode) return lines;
  if (st.mode === 'send' && st.soldier) {
    const sol = ctx.state.characters[st.soldier];
    if (sol && isAlive(sol)) {
      if (ctx.rng.chance(substituteDeathChance(sol))) {
        markDead(ctx, sol, def.tag);
        lines.push(`${sol.name}ไม่ได้กลับมาจากทัพ — เพื่อนร่วมหมู่เล่าว่าล้มลงกลางแนว`, ...settleDeath(ctx, sol).lines);
        if (head && isAlive(head)) head.stress = Math.min(1, head.stress + 0.08);
      } else {
        sol.skills.combat = Math.min(100, (sol.skills.combat ?? 0) + 3);
        sol.merit += 1;
        sol.social.wealth += 4;
        lines.push(`${sol.name}กลับจากทัพ พร้อมของที่ได้รางวัลมาแบ่งให้เรือน`);
        if (head && isAlive(head)) adjustFavor(head, 0.1);
      }
    }
  } else if (st.mode === 'servant') {
    const hh = head?.householdId ? ctx.state.households[head.householdId] : undefined;
    if (hh?.retainers && !ctx.rng.chance(SERVANT_LOST)) {
      hh.retainers.that++;
      lines.push('บ่าวที่ส่งไปกลับมาถึงเรือน');
    } else {
      lines.push('บ่าวที่ส่งไปไม่ได้กลับมา');
    }
  } else if (st.mode === 'self' && st.soldier && !st.conduct) {
    // ผู้เล่นไปทัพแต่ไม่เคยได้ event ในสนาม (เช่น เสียชีวิตก่อน/ผู้สืบรับต่อ) — ผลเหมือนทำตามคำสั่ง
    const sol = ctx.state.characters[st.soldier];
    if (sol && isAlive(sol) && ctx.rng.chance(substituteDeathChance(sol))) {
      markDead(ctx, sol, def.tag);
      lines.push(`${sol.name}ไม่ได้กลับมาจากทัพ`);
    }
  }
  return lines;
}
