import { DAYS_PER_YEAR } from '../core/calendar';
import { ageOf, isAlive, must, type Ctx } from '../core/ctx';
import { clamp01 } from '../core/rng';
import type { Character, Household, HouseholdId, HouseholdRule, TagId, Trait, TraitKindId } from '../core/types';
import { addOrReinforceTrait } from './traits';

// ============================================================================
// Cultural / Quirk Inheritance ระหว่างมีชีวิต (รันปีละครั้งต่อเรือน)
//
//  ปมของผู้ใหญ่ ──(แรงพอ + เป็นหัวหน้าเรือน)──► HouseholdRule "ห้ามมีแตงกวาในเรือน"
//        │                                           │
//        └──(เห็นพ่อแม่แสดงอาการ)──► เด็ก ◄──(โตมาใต้กฎ)──┘
//                                     │
//                     ได้ปมแบบ awareness='unknown' — กลัว/รังเกียจโดยไม่รู้ต้นเหตุ
//                     + target อาจ drift (แตงกวา → ฟักทอง) + kind อาจกลายพันธุ์ (กลัว → ถือว่าอัปมงคล)
//
// ตอน handover กฎในเรือนที่อยู่นานพอจะตกผลึกเป็น FamilyTaboo (ดู handover.ts)
// ============================================================================

export function householdYearTick(ctx: Ctx, householdId: HouseholdId): string[] {
  const log: string[] = [];
  const hh = must(ctx.state.households[householdId], householdId);
  const members = hh.memberIds.map((id) => ctx.state.characters[id]).filter(isAlive);
  const adults = members.filter((m) => ageOf(ctx, m) >= 16);

  formRules(ctx, hh, log);

  const S = ctx.content.balance.social;
  for (const child of members) {
    const age = ageOf(ctx, child);
    if (age < S.susceptibleAge[0] || age > S.susceptibleAge[1]) continue;
    const susceptibility = (0.5 + 0.5 * child.personality.agreeableness) * (1 - 0.4 * child.personality.boldness);

    // (a) ซึมซับจากการเห็นผู้เลี้ยงดูแสดงอาการ
    for (const adult of adults) {
      if (!child.caregiverIds.includes(adult.id) && hh.headId !== adult.id) continue;
      for (const tid of adult.traitIds) {
        const t = ctx.state.traits[tid];
        if (!t || t.latent || !t.target) continue;
        const kd = must(ctx.content.traitKinds[t.kind], t.kind);
        const p = S.transmitBase * kd.heritability * kd.visibility * t.intensity * susceptibility;
        if (ctx.rng.chance(p)) transmit(ctx, adult, child, t.kind, t.target, t.intensity, log);
      }
    }
    // (b) ซึมซับจากกฎของเรือน — ยิ่งโตมาใต้กฎนานยิ่งฝัง
    for (const rule of hh.rules) {
      const years = (ctx.state.meta.day - Math.max(rule.sinceDay, child.birthDay)) / DAYS_PER_YEAR;
      const p = S.ruleTransmitBase * clamp01(years / 5) * susceptibility;
      if (!ctx.rng.chance(p)) continue;
      const kind: TraitKindId = rule.statedReason === 'inauspicious' ? 'superstition' : 'aversion';
      const imposer = ctx.state.characters[rule.imposedBy];
      if (imposer) transmit(ctx, imposer, child, kind, rule.target, 0.5, log);
    }
    // (c) ผู้ใหญ่ "สอน" ความกลัวโดยตั้งใจ — ขู่เด็กเล็กด้วยผีให้เชื่อฟัง (lore: psyche.frightening_children_with_ghosts)
    // เกิดได้ครั้งเดียวต่อเด็ก — การฝังลึกต่อจากนั้นไปทางช่องทาง (a) ตามปกติ
    const alreadyFearsPhi = child.traitIds.some((id) => ctx.state.traits[id]?.target === 'supernatural:phi');
    if (age <= S.ghostScareMaxAge && !alreadyFearsPhi) {
      for (const adult of adults) {
        if (!child.caregiverIds.includes(adult.id) && hh.headId !== adult.id) continue;
        const superstitious = adult.traitIds.some((id) => ctx.state.traits[id]?.kind === 'superstition');
        const p = S.ghostScareBase * adult.personality.piety * susceptibility * (superstitious ? 1.5 : 1);
        if (!ctx.rng.chance(p)) continue;
        const { reinforced } = addOrReinforceTrait(ctx, child, {
          kind: 'phobia',
          target: 'supernatural:phi',
          intensity: (0.25 + 0.3 * adult.personality.piety) * ctx.rng.range(0.7, 1),
          latent: false,
          awareness: 'knows_cause', // เด็กรู้ว่ากลัวเพราะถูกเล่าเรื่องผี
          origin: { type: 'social', fromNodeId: adult.familyNodeId, fromKind: 'superstition', fromTarget: 'supernatural:phi' },
        });
        log.push(`${child.name}${reinforced ? 'กลัวผีหนักขึ้น' : 'เริ่มกลัวผี'} เพราะ${adult.name}ขู่ให้เข้านอน`);
        break;
      }
    }
  }
  return log;
}

/** หัวหน้าเรือนที่มีปมแรงพอจะตั้งกฎ — และ "เหตุผล" ที่บอกคนในเรือนขึ้นกับว่าตัวเองรู้ต้นเหตุจริงไหม */
function formRules(ctx: Ctx, hh: Household, log: string[]): void {
  const head = ctx.state.characters[hh.headId];
  if (!isAlive(head)) return;
  for (const tid of head.traitIds) {
    const t = ctx.state.traits[tid];
    if (!t?.target || t.latent || t.intensity < ctx.content.balance.social.ruleThreshold) continue;
    const kd = ctx.content.traitKinds[t.kind];
    if (!kd?.imposesRule || hh.rules.some((r) => r.target === t.target)) continue;
    const rule: HouseholdRule = {
      id: `rule_${hh.id}_${t.target}`,
      kind: kd.imposesRule,
      target: t.target,
      sinceDay: ctx.state.meta.day,
      imposedBy: head.id,
      originTraitId: t.id,
      statedReason: reasonFor(t),
    };
    hh.rules.push(rule);
    log.push(`${head.name}ตั้งกฎในเรือน: ${rule.kind === 'ban' ? 'ห้ามมี' : 'ต้องทำพิธีเมื่อเจอ'}${ctx.tags.label(t.target)} (เหตุผลที่บอก: ${rule.statedReason})`);
  }
}

function reasonFor(t: Trait): HouseholdRule['statedReason'] {
  if (t.kind === 'superstition' || t.awareness === 'unknown') return 'inauspicious';
  return t.awareness === 'misremembers' ? 'false_cause' : 'true_cause';
}

function transmit(
  ctx: Ctx, from: Character, child: Character, kind: TraitKindId, target: TagId, srcIntensity: number, log: string[],
): void {
  const S = ctx.content.balance.social;
  const kd = must(ctx.content.traitKinds[kind], kind);
  let newKind = kind;
  let newTarget = target;
  // เด็กจำผิด: เป้า drift ไปพี่น้อง/พ่อแม่ใน ontology (พ่อเกลียดแตงกวา → ลูกเกลียด "พืชตระกูลแตง" หรือฟักทอง)
  if (ctx.rng.chance(S.targetDriftChance)) {
    const options = [...ctx.tags.siblings(target), ...ctx.tags.parents(target)].filter((t) => !ctx.tags.def(t)?.generalizeStop);
    newTarget = ctx.rng.pick(options) ?? target;
  }
  if (kd.mutatesTo?.length && ctx.rng.chance(S.kindMutateChance)) newKind = must(ctx.rng.pick(kd.mutatesTo), 'mutate');

  const fromNode = from.familyNodeId;
  const { reinforced } = addOrReinforceTrait(ctx, child, {
    kind: newKind,
    target: newTarget,
    intensity: srcIntensity * ctx.rng.range(0.4, 0.8),
    latent: false,
    awareness: 'unknown',
    origin: { type: 'social', fromNodeId: fromNode, fromKind: kind, fromTarget: target },
  });
  const label = must(ctx.content.traitKinds[newKind], newKind).label.th;
  log.push(`${child.name}${reinforced ? 'ฝังลึกขึ้น' : 'ซึมซับ'}: ${label}${ctx.tags.label(newTarget)} จาก${from.name}${newTarget !== target ? ` (เพี้ยนจาก${ctx.tags.label(target)})` : ''}`);
}
