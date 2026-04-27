import type { TypeEfficacy, TypeRef } from './types';

export type QuizDirection = 'offensive' | 'defensive';
export type QuizPolarity = 'super_effective' | 'not_effective';

export interface QuizQuestion {
  subject: TypeRef[];
  direction: QuizDirection;
  polarity: QuizPolarity;
}

export interface AnswerSlot {
  type: TypeRef;
  multiplier: number;
  /**
   * Per-subject contributions in the same order as `question.subject`.
   * Only present when the question has 2 subject types.
   */
  breakdown?: SubjectMultiplier[];
}

export interface SubjectMultiplier {
  subject: TypeRef;
  multiplier: number;
}

export interface QuizAnswer {
  correct: AnswerSlot[];
  all: AnswerSlot[];
}

export interface AnswerCheck {
  correctSelected: AnswerSlot[];
  missed: AnswerSlot[];
  extra: AnswerSlot[];
  isPerfect: boolean;
}

export type EfficacyLookup = (attackerId: number, defenderId: number) => number;

export function buildEfficacyLookup(efficacy: TypeEfficacy[]): EfficacyLookup {
  const m = new Map<string, number>();
  for (const e of efficacy) {
    m.set(`${e.attacking_type_id}:${e.defending_type_id}`, e.damage_factor / 100);
  }
  return (a, d) => m.get(`${a}:${d}`) ?? 1;
}

export function pickQuestion(
  types: TypeRef[],
  rng: () => number = Math.random,
): QuizQuestion {
  if (types.length < 2) {
    throw new Error('pickQuestion requires at least 2 types');
  }
  const numTypes = rng() < 0.5 ? 1 : 2;
  const direction: QuizDirection = rng() < 0.5 ? 'offensive' : 'defensive';
  const polarity: QuizPolarity = rng() < 0.5 ? 'super_effective' : 'not_effective';

  const pool = types.slice();
  const subject: TypeRef[] = [];
  for (let i = 0; i < numTypes; i++) {
    const idx = Math.floor(rng() * pool.length);
    subject.push(pool.splice(idx, 1)[0]);
  }
  return { subject, direction, polarity };
}

export function computeAnswer(
  types: TypeRef[],
  lookup: EfficacyLookup,
  question: QuizQuestion,
): QuizAnswer {
  const isDual = question.subject.length === 2;
  const all: AnswerSlot[] = types.map((t) => {
    const parts: SubjectMultiplier[] = question.subject.map((s) => ({
      subject: s,
      multiplier: question.direction === 'defensive' ? lookup(t.id, s.id) : lookup(s.id, t.id),
    }));
    const mult = question.direction === 'defensive'
      ? parts.reduce((acc, p) => acc * p.multiplier, 1)
      : parts.reduce((acc, p) => Math.max(acc, p.multiplier), 0);
    return isDual
      ? { type: t, multiplier: mult, breakdown: parts }
      : { type: t, multiplier: mult };
  });
  const correct = all.filter((slot) => slot.multiplier >= 2);
  return { correct, all };
}

export function checkAnswer(
  selectedIds: number[],
  answer: QuizAnswer,
): AnswerCheck {
  const sel = new Set(selectedIds);
  const correctIds = new Set(answer.correct.map((s) => s.type.id));

  const correctSelected: AnswerSlot[] = [];
  const missed: AnswerSlot[] = [];
  const extra: AnswerSlot[] = [];

  for (const slot of answer.correct) {
    if (sel.has(slot.type.id)) correctSelected.push(slot);
    else missed.push(slot);
  }
  for (const slot of answer.all) {
    if (sel.has(slot.type.id) && !correctIds.has(slot.type.id)) extra.push(slot);
  }
  return {
    correctSelected,
    missed,
    extra,
    isPerfect: missed.length === 0 && extra.length === 0,
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
