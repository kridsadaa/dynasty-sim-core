import { ageOf, must, newId, type Ctx } from '../core/ctx';
import { clamp01, softmax } from '../core/rng';
import type {
  Character, EventDefId, EventInstanceId, Memory, MemoryId, Percept, PerceptRole,
  Personality, TagId, TraitId, TraitKindId, WoundId,
} from '../core/types';
import { addOrReinforceTrait } from './traits';

// ============================================================================
// Trauma & Quirk Resolution
//
//  เหตุการณ์ ──► [1] Impact ──► [2] Attribution ──► [3] Memory ──► [4] Branch
//                (แรงแค่ไหน)    (สมองโทษอะไร)     (บันทึก)       ├─ เลือก fixation (สุ่มตามน้ำหนัก attribution)
//                                                               ├─ เลือก kind จาก personality (phobia/aversion/obsession/...)
//                                                               ├─ generalize ขึ้น ontology (มีด → ของมีคม)
//                                                               └─ merge กับปมเดิม
//
// จุดที่ทำให้เกิด "ปมเพี้ยน": ขั้น [2] — เด็กเล็ก + จินตนาการสูง ให้น้ำหนักกับ "ความสะดุดตา"
// มากกว่า "บทบาทเชิงเหตุ" ฟักทองสีส้มสดจึงแย่งน้ำหนักจากมีดได้ ไม่มี if-else พิเศษสำหรับแตงกวา
// แต่ขั้น [4] ให้ปมเพี้ยนฝังจริงเพียง misattributionKeep — เป็นเรื่องแปลกที่นานๆ เจอที
// ============================================================================

const CAUSAL_ROLES: ReadonlySet<PerceptRole> = new Set(['instrument', 'agent']);

export interface TraumaInput {
  characterId: Character['id'];
  eventInstanceId: EventInstanceId | null;
  eventDefId: EventDefId;
  percepts: Percept[];
  physicalSeverity: number; // ความรุนแรงของแผลที่เพิ่งเกิด (0 = ไม่บาดเจ็บ)
  baseImpact: number;       // ความรุนแรงทางใจของเหตุการณ์ (content)
  comforted: boolean;       // มีผู้ใหญ่ปลอบ
  witnessPanic: number;     // คนรอบตัวตื่นตระหนก → ขยายความกลัว
  woundIds: WoundId[];
}

export interface TraumaBranch {
  tag: TagId;
  role: PerceptRole;
  misattributed: boolean;
  kind: TraitKindId;
  target: TagId;
  generalizedSteps: number;
  intensity: number;
  traitId: TraitId;
  reinforced: boolean;
}

export interface TraumaResult {
  impact: number;
  rationality: number;
  attribution: Memory['attribution'];
  memoryId: MemoryId | null;
  branches: TraumaBranch[];
}

export function resolveTrauma(ctx: Ctx, input: TraumaInput): TraumaResult {
  const B = ctx.content.balance.trauma;
  const ch = must(ctx.state.characters[input.characterId], input.characterId);
  const P = ch.personality;
  const age = ageOf(ctx, ch);

  // ---------- [1] Impact ----------
  const impact = computeImpact(age, P, input, B.comfortFactor);
  if (impact < B.memoryThreshold) return { impact, rationality: 0, attribution: [], memoryId: null, branches: [] };

  // ---------- [2] Attribution ----------
  // rationality: เด็กเล็ก/จินตนาการสูง → ใช้เหตุผลเชิงสาเหตุน้อย
  const rationality = clamp01((age - 2) / 14) * (1 - 0.5 * P.imagination);
  const attribution = attribute(ctx, input.percepts, rationality, P.imagination);

  // ---------- [3] Memory ----------
  const memory: Memory = {
    id: newId(ctx, 'mem'),
    ownerId: ch.id,
    eventInstanceId: input.eventInstanceId,
    eventDefId: input.eventDefId,
    day: ctx.state.meta.day,
    ageAtTime: age,
    valence: -impact,
    intensity: impact,
    percepts: input.percepts,
    attribution,
    fidelity: age < 3 ? 0.2 : 1, // ก่อน 3 ขวบจำเหตุการณ์ไม่ได้ แต่ปมยังฝัง
    rehearsals: 0,
    formative: impact >= B.formativeThreshold,
    notability: impact * 0.5 + input.physicalSeverity * 0.5,
    woundIds: input.woundIds,
    spawnedTraitIds: [],
  };
  ctx.state.memories[memory.id] = memory;
  ch.memoryIds.push(memory.id);
  for (const wid of input.woundIds) {
    const w = ctx.state.wounds[wid];
    if (w) w.memoryId = memory.id;
  }

  // ---------- [4] Branch: สร้างปม ----------
  const branches: TraumaBranch[] = [];
  if (impact >= B.traitThreshold) {
    const fixations = impact >= B.secondTraitThreshold ? 2 : 1; // ช็อกหนัก → ฝังได้ 2 ปม (ตรง + เพี้ยน)
    const pool = [...attribution];
    for (let i = 0; i < fixations && pool.length; i++) {
      // สุ่มตามน้ำหนัก attribution (ไม่ใช่ argmax) → ผลลัพธ์หลากหลายแม้ input เดียวกัน
      let pick = must(ctx.rng.weighted(pool, (a) => a.weight), 'fixation');
      // ปมเพี้ยน (กลัวฟักทอง กลัวแม่) ให้เกิดยาก — ส่วนใหญ่ใจไปผูกกับต้นเหตุจริงแทน หรือไม่ฝังเลย
      if (!CAUSAL_ROLES.has(pick.role) && !ctx.rng.chance(B.misattributionKeep)) {
        const causal = pool.find((a) => CAUSAL_ROLES.has(a.role));
        if (!causal) continue;
        pick = causal;
      }
      pool.splice(pool.indexOf(pick), 1);

      const misattributed = !CAUSAL_ROLES.has(pick.role);
      const kind = chooseKind(ctx, P, misattributed);
      const kindDef = must(ctx.content.traitKinds[kind], kind);
      const { target, steps } = generalize(ctx, pick.tag, impact, kindDef.generalize, P.neuroticism);

      const relWeight = pick.weight / Math.max(...attribution.map((a) => a.weight));
      const intensity =
        clamp01(0.25 + ((impact - B.traitThreshold) / (1 - B.traitThreshold)) * 0.6) *
        (0.6 + 0.4 * relWeight) /
        (1 + 0.15 * steps) * // ปมที่ลามกว้างจะเจือจางลง
        (i === 0 ? 1 : 0.7);

      const { id, reinforced } = addOrReinforceTrait(ctx, ch, {
        kind,
        target,
        intensity,
        latent: age < 3,
        awareness: age < 3 ? 'unknown' : misattributed ? 'misremembers' : 'knows_cause',
        origin: { type: 'experience', memoryId: memory.id },
      });
      memory.spawnedTraitIds.push(id);
      branches.push({ tag: pick.tag, role: pick.role, misattributed, kind, target, generalizedSteps: steps, intensity, traitId: id, reinforced });
    }
  }
  return { impact, rationality, attribution, memoryId: memory.id, branches };
}

/** อายุ 3–10 เปราะบางที่สุด; neuroticism ขยาย, resilience/การปลอบ ลดทอน */
function computeImpact(age: number, P: Personality, input: TraumaInput, comfortFactor: number): number {
  const ageVuln = age < 3 ? 0.8 : age <= 10 ? 1 : age <= 16 ? 1 - (age - 10) * 0.06 : 0.6;
  const raw = 0.45 * input.baseImpact + 0.45 * input.physicalSeverity + 0.25 * input.witnessPanic;
  return clamp01(
    raw * ageVuln * (0.6 + 0.8 * P.neuroticism) * (1.25 - 0.5 * P.resilience) * (input.comforted ? comfortFactor : 1),
  );
}

/**
 * score(percept) = rationality × causalWeight[role] + (1 − rationality) × vividness × imaginationGain
 * แล้ว softmax ด้วย temperature ที่สูงขึ้นเมื่อ rationality ต่ำ (ความคิดเด็ก "กระจาย" กว่า)
 *
 * ตัวอย่าง เด็ก 7 ขวบ imagination 0.5 (rationality ≈ 0.27):
 *   มีด (instrument, causal 1.0, vivid 0.6)  → 0.71
 *   ฟักทอง (target, causal 0.35, vivid 0.85) → 0.72  ← สูสีกับมีด!
 *   แตงกวา (target, causal 0.35, vivid 0.5)  → 0.46  ← จืดกว่า โอกาสเพี้ยนน้อยกว่า
 *   เด็ก 13 ขวบ: มีดได้ ~55% ฟักทอง ~17% → โตขึ้นปมเพี้ยนน้อยลงเอง
 */
function attribute(ctx: Ctx, percepts: Percept[], rationality: number, imagination: number): Memory['attribution'] {
  const causal = ctx.content.balance.trauma.causalWeight;
  const scored = percepts
    .filter((p) => (causal[p.role] ?? 0) > 0)
    .map((p) => {
      const vivid = Math.max(p.salience, ctx.tags.salience(p.tag));
      return {
        tag: p.tag,
        role: p.role,
        score: rationality * causal[p.role] + (1 - rationality) * vivid * (0.6 + 0.8 * imagination),
      };
    });
  if (!scored.length) return [];
  const weights = softmax(scored.map((s) => s.score), 0.08 + 0.25 * (1 - rationality));
  return scored
    .map((s, i) => ({ tag: s.tag, role: s.role, weight: weights[i] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * บุคลิกเลือก "รูปแบบ" ของปม:
 *  neuroticism สูง → phobia (กลัว), agreeableness ต่ำ → aversion (เกลียด/รังเกียจ)
 *  boldness สูง → obsession (counter-phobic: โดนมีดบาดแล้วหมกมุ่นกับมีด จนโตไปเป็นช่างตีดาบ)
 *  piety สูง → superstition (ฟักทองเป็นของอัปมงคล)
 */
function chooseKind(ctx: Ctx, P: Personality, misattributed: boolean): TraitKindId {
  const kinds = Object.values(ctx.content.traitKinds);
  const scores = kinds.map((k) => {
    let s = k.bias + (misattributed ? k.misattributionBias ?? 0 : 0);
    for (const [trait, w] of Object.entries(k.personalityWeights)) s += (w ?? 0) * P[trait as keyof Personality];
    return s;
  });
  const probs = softmax(scores, 0.5);
  return must(ctx.rng.weighted(kinds.map((k, i) => ({ k, p: probs[i] ?? 0 })), (x) => x.p), 'kind').k.id;
}

/** ปีนขึ้น ontology N ขั้น (มีดทำครัว → ของมีคม) หยุดก่อน tag ที่ generalizeStop */
function generalize(
  ctx: Ctx, tag: TagId, impact: number, kindGeneralize: number, neuroticism: number,
): { target: TagId; steps: number } {
  const max = ctx.content.balance.trauma.maxGeneralizeSteps;
  const expected = impact * kindGeneralize * (0.5 + neuroticism) * max * 0.6;
  const want = Math.min(max, Math.floor(expected + ctx.rng.next()));
  let cur = tag;
  let steps = 0;
  while (steps < want) {
    const ups = ctx.tags.parents(cur).filter((p) => !ctx.tags.def(p)?.generalizeStop);
    const next = ctx.rng.pick(ups);
    if (!next) break;
    cur = next;
    steps++;
  }
  return { target: cur, steps };
}
