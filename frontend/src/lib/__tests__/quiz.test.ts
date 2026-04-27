import { describe, it, expect } from 'vitest';
import {
  buildEfficacyLookup,
  computeAnswer,
  checkAnswer,
  pickQuestion,
  mulberry32,
} from '../quiz';
import type { TypeEfficacy, TypeRef } from '../types';

// Minimal type fixture covering the cases we exercise.
// IDs are arbitrary but distinct.
const FIRE: TypeRef = { id: 10, name: 'fire', names: { en: 'Fire' } };
const FLYING: TypeRef = { id: 3, name: 'flying', names: { en: 'Flying' } };
const ROCK: TypeRef = { id: 6, name: 'rock', names: { en: 'Rock' } };
const ELECTRIC: TypeRef = { id: 13, name: 'electric', names: { en: 'Electric' } };
const WATER: TypeRef = { id: 11, name: 'water', names: { en: 'Water' } };
const GRASS: TypeRef = { id: 12, name: 'grass', names: { en: 'Grass' } };
const BUG: TypeRef = { id: 7, name: 'bug', names: { en: 'Bug' } };
const FIGHTING: TypeRef = { id: 2, name: 'fighting', names: { en: 'Fighting' } };
const NORMAL: TypeRef = { id: 1, name: 'normal', names: { en: 'Normal' } };
const GHOST: TypeRef = { id: 8, name: 'ghost', names: { en: 'Ghost' } };
const DARK: TypeRef = { id: 17, name: 'dark', names: { en: 'Dark' } };

const TYPES: TypeRef[] = [
  NORMAL, FIGHTING, FLYING, ROCK, BUG, GHOST, FIRE, WATER, GRASS, ELECTRIC, DARK,
];

// damage_factor is stored ×100 (Pokemon CSV convention): 200 = 2x, 50 = 0.5x, 0 = 0x.
// Missing entries default to 100 (1x).
const EFFICACY: TypeEfficacy[] = [
  // Rock attacking
  { attacking_type_id: ROCK.id, defending_type_id: FIRE.id, damage_factor: 200 },
  { attacking_type_id: ROCK.id, defending_type_id: FLYING.id, damage_factor: 200 },
  { attacking_type_id: ROCK.id, defending_type_id: BUG.id, damage_factor: 200 },
  // Electric attacking
  { attacking_type_id: ELECTRIC.id, defending_type_id: FLYING.id, damage_factor: 200 },
  { attacking_type_id: ELECTRIC.id, defending_type_id: WATER.id, damage_factor: 200 },
  // Water attacking
  { attacking_type_id: WATER.id, defending_type_id: FIRE.id, damage_factor: 200 },
  { attacking_type_id: WATER.id, defending_type_id: ROCK.id, damage_factor: 200 },
  // Fire attacking
  { attacking_type_id: FIRE.id, defending_type_id: GRASS.id, damage_factor: 200 },
  { attacking_type_id: FIRE.id, defending_type_id: BUG.id, damage_factor: 200 },
  { attacking_type_id: FIRE.id, defending_type_id: ROCK.id, damage_factor: 50 },
  { attacking_type_id: FIRE.id, defending_type_id: WATER.id, damage_factor: 50 },
  // Grass attacking
  { attacking_type_id: GRASS.id, defending_type_id: FIRE.id, damage_factor: 50 },
  { attacking_type_id: GRASS.id, defending_type_id: FLYING.id, damage_factor: 50 },
  { attacking_type_id: GRASS.id, defending_type_id: WATER.id, damage_factor: 200 },
  { attacking_type_id: GRASS.id, defending_type_id: ROCK.id, damage_factor: 200 },
  // Flying attacking
  { attacking_type_id: FLYING.id, defending_type_id: GRASS.id, damage_factor: 200 },
  { attacking_type_id: FLYING.id, defending_type_id: FIGHTING.id, damage_factor: 200 },
  { attacking_type_id: FLYING.id, defending_type_id: BUG.id, damage_factor: 200 },
  { attacking_type_id: FLYING.id, defending_type_id: ROCK.id, damage_factor: 50 },
  { attacking_type_id: FLYING.id, defending_type_id: ELECTRIC.id, damage_factor: 50 },
  // Normal/Ghost interactions for the dual-defender test
  { attacking_type_id: GHOST.id, defending_type_id: NORMAL.id, damage_factor: 0 },
  { attacking_type_id: GHOST.id, defending_type_id: GHOST.id, damage_factor: 200 },
  { attacking_type_id: FIGHTING.id, defending_type_id: NORMAL.id, damage_factor: 200 },
  { attacking_type_id: FIGHTING.id, defending_type_id: GHOST.id, damage_factor: 0 },
  { attacking_type_id: DARK.id, defending_type_id: GHOST.id, damage_factor: 200 },
];

const lookup = buildEfficacyLookup(EFFICACY);

describe('buildEfficacyLookup', () => {
  it('returns stored multiplier as decimal', () => {
    expect(lookup(ROCK.id, FIRE.id)).toBe(2);
    expect(lookup(FIRE.id, ROCK.id)).toBe(0.5);
    expect(lookup(GHOST.id, NORMAL.id)).toBe(0);
  });
  it('defaults missing entries to 1x', () => {
    expect(lookup(NORMAL.id, FIRE.id)).toBe(1);
  });
});

describe('computeAnswer — defensive', () => {
  it('multiplies multipliers across a dual-type defender (Fire/Flying weak to Rock 4x, Electric/Water 2x)', () => {
    const q = { subject: [FIRE, FLYING], direction: 'defensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);

    const byName = (n: string) => a.all.find((s) => s.type.name === n)!.multiplier;
    expect(byName('rock')).toBe(4);
    expect(byName('electric')).toBe(2);
    expect(byName('water')).toBe(2);
    expect(byName('grass')).toBe(0.25);
    expect(byName('normal')).toBe(1);

    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['electric', 'rock', 'water']);
  });

  it('handles immunities — Normal/Ghost is immune to Fighting and Ghost, weak only to Dark', () => {
    const q = { subject: [NORMAL, GHOST], direction: 'defensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);

    const byName = (n: string) => a.all.find((s) => s.type.name === n)!.multiplier;
    expect(byName('fighting')).toBe(0);
    expect(byName('ghost')).toBe(0);
    expect(byName('dark')).toBe(2);

    expect(a.correct.map((s) => s.type.name)).toEqual(['dark']);
  });

  it('single-type defender uses the lookup directly', () => {
    const q = { subject: [FIRE], direction: 'defensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['rock', 'water']);
  });
});

describe('computeAnswer — offensive', () => {
  it('uses the BEST multiplier across a dual attacker (Fire/Flying super-effective vs Bug/Grass/Ice/Steel union)', () => {
    const q = { subject: [FIRE, FLYING], direction: 'offensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);

    const correctNames = a.correct.map((s) => s.type.name).sort();
    // From the fixture: Fire→{grass,bug}, Flying→{grass,fighting,bug}. Union = bug, fighting, grass.
    expect(correctNames).toEqual(['bug', 'fighting', 'grass']);
  });

  it('single-type attacker uses the lookup directly', () => {
    const q = { subject: [WATER], direction: 'offensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['fire', 'rock']);
  });
});

describe('computeAnswer — breakdown', () => {
  it('includes per-subject breakdown only for dual-type questions', () => {
    const dual = { subject: [FIRE, FLYING], direction: 'defensive' as const, polarity: 'super_effective' as const };
    const single = { subject: [FIRE], direction: 'defensive' as const, polarity: 'super_effective' as const };

    const dualA = computeAnswer(TYPES, lookup, dual);
    const singleA = computeAnswer(TYPES, lookup, single);

    expect(dualA.all.every((s) => s.breakdown?.length === 2)).toBe(true);
    expect(singleA.all.every((s) => s.breakdown === undefined)).toBe(true);
  });

  it('defensive breakdown reports each subject multiplier and they multiply to the result', () => {
    const q = { subject: [FIRE, FLYING], direction: 'defensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);

    const rock = a.all.find((s) => s.type.name === 'rock')!;
    expect(rock.multiplier).toBe(4);
    const byName = (n: string) => rock.breakdown!.find((p) => p.subject.name === n)!.multiplier;
    expect(byName('fire')).toBe(2);
    expect(byName('flying')).toBe(2);

    const grass = a.all.find((s) => s.type.name === 'grass')!;
    expect(grass.multiplier).toBe(0.25);
    expect(grass.breakdown!.find((p) => p.subject.name === 'fire')!.multiplier).toBe(0.5);
    expect(grass.breakdown!.find((p) => p.subject.name === 'flying')!.multiplier).toBe(0.5);
  });

  it('offensive breakdown reports each subject multiplier and the result is the max', () => {
    const q = { subject: [FIRE, FLYING], direction: 'offensive' as const, polarity: 'super_effective' as const };
    const a = computeAnswer(TYPES, lookup, q);

    // Fire→Fighting = 1x (default), Flying→Fighting = 2x. Max = 2x.
    const fighting = a.all.find((s) => s.type.name === 'fighting')!;
    expect(fighting.multiplier).toBe(2);
    const fireMult = fighting.breakdown!.find((p) => p.subject.name === 'fire')!.multiplier;
    const flyingMult = fighting.breakdown!.find((p) => p.subject.name === 'flying')!.multiplier;
    expect(fireMult).toBe(1);
    expect(flyingMult).toBe(2);
    expect(fighting.multiplier).toBe(Math.max(fireMult, flyingMult));
  });
});

describe('checkAnswer', () => {
  const q = { subject: [FIRE, FLYING], direction: 'defensive' as const, polarity: 'super_effective' as const };
  const ans = computeAnswer(TYPES, lookup, q);
  // Correct set for Fire/Flying defensive: rock, electric, water.

  it('flags perfect answer', () => {
    const result = checkAnswer([ROCK.id, ELECTRIC.id, WATER.id], ans);
    expect(result.isPerfect).toBe(true);
    expect(result.missed).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.correctSelected.map((s) => s.type.name).sort()).toEqual([
      'electric', 'rock', 'water',
    ]);
  });

  it('reports missed and extra selections with their multipliers', () => {
    const result = checkAnswer([ROCK.id, GRASS.id], ans);
    expect(result.isPerfect).toBe(false);
    expect(result.correctSelected.map((s) => s.type.name)).toEqual(['rock']);
    expect(result.missed.map((s) => s.type.name).sort()).toEqual(['electric', 'water']);
    expect(result.extra).toHaveLength(1);
    expect(result.extra[0].type.name).toBe('grass');
    expect(result.extra[0].multiplier).toBe(0.25);
  });

  it('an empty selection yields all correct as missed and no extras', () => {
    const result = checkAnswer([], ans);
    expect(result.correctSelected).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
    expect(result.missed).toHaveLength(3);
  });
});

describe('pickQuestion', () => {
  it('produces a 1- or 2-type subject and a valid direction', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const q = pickQuestion(TYPES, rng);
      expect([1, 2]).toContain(q.subject.length);
      expect(['offensive', 'defensive']).toContain(q.direction);
      expect(['super_effective', 'not_effective']).toContain(q.polarity);
      if (q.subject.length === 2) {
        expect(q.subject[0].id).not.toBe(q.subject[1].id);
      }
    }
  });

  it('is deterministic given a seeded RNG', () => {
    const a = pickQuestion(TYPES, mulberry32(1));
    const b = pickQuestion(TYPES, mulberry32(1));
    expect(a.direction).toBe(b.direction);
    expect(a.polarity).toBe(b.polarity);
    expect(a.subject.map((s) => s.id)).toEqual(b.subject.map((s) => s.id));
  });

  it('produces both polarities across many rolls', () => {
    const rng = mulberry32(7);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(pickQuestion(TYPES, rng).polarity);
      if (seen.size === 2) break;
    }
    expect(seen).toEqual(new Set(['super_effective', 'not_effective']));
  });

  it('polarity is deterministic given a seeded RNG', () => {
    const a = pickQuestion(TYPES, mulberry32(42));
    const b = pickQuestion(TYPES, mulberry32(42));
    expect(a.polarity).toBe(b.polarity);
  });
});

describe('computeAnswer — defensive × not_effective', () => {
  it('single-type defender — picks attackers with ≤ 0.5× into Fire', () => {
    const q = {
      subject: [FIRE],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // From the fixture: Grass→Fire = 0.5x. (No others ≤ 0.5x in fixture.)
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['grass']);
  });

  it('dual-type defender — multiplied product ≤ 0.5× (Fire/Flying resists Grass at 0.25×)', () => {
    const q = {
      subject: [FIRE, FLYING],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const grass = a.all.find((s) => s.type.name === 'grass')!;
    expect(grass.multiplier).toBe(0.25);
    expect(a.correct.some((s) => s.type.name === 'grass')).toBe(true);
  });

  it('immunity — 0× attackers count as not_effective (Normal/Ghost resists Fighting & Ghost)', () => {
    const q = {
      subject: [NORMAL, GHOST],
      direction: 'defensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toContain('fighting');
    expect(correctNames).toContain('ghost');
  });
});

describe('computeAnswer — offensive × not_effective', () => {
  it('single-type attacker — picks defenders that take ≤ 0.5× from Fire', () => {
    const q = {
      subject: [FIRE],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // Fire→Rock = 0.5x and Fire→Water = 0.5x in the fixture.
    const correctNames = a.correct.map((s) => s.type.name).sort();
    expect(correctNames).toEqual(['rock', 'water']);
  });

  it('dual-type attacker — defender resists both (Fire/Flying are both ≤ 0.5× into Rock)', () => {
    const q = {
      subject: [FIRE, FLYING],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const a = computeAnswer(TYPES, lookup, q);
    // Fire→Rock = 0.5, Flying→Rock = 0.5, max = 0.5 → in set.
    expect(a.correct.some((s) => s.type.name === 'rock')).toBe(true);
    // Fire→Grass = 2x, so Grass is NOT in the resisted set even though Flying→Grass = 2x.
    expect(a.correct.some((s) => s.type.name === 'grass')).toBe(false);
  });
});

describe('checkAnswer — not_effective polarity', () => {
  it('flags a perfect resisted answer', () => {
    const q = {
      subject: [FIRE],
      direction: 'offensive' as const,
      polarity: 'not_effective' as const,
    };
    const ans = computeAnswer(TYPES, lookup, q);
    const result = checkAnswer([ROCK.id, WATER.id], ans);
    expect(result.isPerfect).toBe(true);
  });
});
