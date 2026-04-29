import { describe, it, expect } from 'vitest';
import { NATURES, getNature, NATURE_MULTIPLIER } from '../natures';

describe('NATURES', () => {
  it('has exactly 25 entries', () => {
    expect(NATURES.length).toBe(25);
  });

  it('has unique ids', () => {
    const ids = NATURES.map((n) => n.id);
    expect(new Set(ids).size).toBe(25);
  });

  it('5 neutral natures have null boosted/lowered', () => {
    const neutral = NATURES.filter((n) => n.boosted === null && n.lowered === null);
    expect(neutral.map((n) => n.id).sort()).toEqual(
      ['bashful', 'docile', 'hardy', 'quirky', 'serious'],
    );
  });

  it('non-neutral natures have both boosted and lowered set', () => {
    const nonNeutral = NATURES.filter((n) => n.boosted || n.lowered);
    for (const n of nonNeutral) {
      expect(n.boosted).not.toBeNull();
      expect(n.lowered).not.toBeNull();
    }
  });
});

describe('getNature', () => {
  it('returns the nature with the given id', () => {
    expect(getNature('adamant').boosted).toBe('attack');
    expect(getNature('adamant').lowered).toBe('special_attack');
  });
});

describe('NATURE_MULTIPLIER', () => {
  it('returns 1.1 for boosted, 0.9 for lowered, 1.0 for unaffected, 1.0 for neutral natures', () => {
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'attack')).toBe(1.1);
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'special_attack')).toBe(0.9);
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'speed')).toBe(1.0);
    expect(NATURE_MULTIPLIER(getNature('hardy'), 'attack')).toBe(1.0);
  });

  it('does not apply nature to HP', () => {
    expect(NATURE_MULTIPLIER(getNature('adamant'), 'hp')).toBe(1.0);
  });
});
