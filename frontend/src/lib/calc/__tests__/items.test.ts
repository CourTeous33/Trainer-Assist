import { describe, it, expect } from 'vitest';
import { ITEMS, getItem, ITEMS_BY_TIER } from '../items';

describe('ITEMS', () => {
  it('has unique ids', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ITEMS.length);
  });

  it('every item has en name', () => {
    for (const item of ITEMS) expect(item.names.en).toBeTruthy();
  });

  it('every item has at least one multiplier defined', () => {
    for (const item of ITEMS) {
      const hasMult = item.damageMult || item.attackMult || item.typeBoost || item.superEffectiveMult;
      expect(hasMult, `${item.id} has no multiplier`).toBeTruthy();
    }
  });

  it('groups items by tier', () => {
    expect(ITEMS_BY_TIER.top.length).toBeGreaterThan(0);
    expect(ITEMS_BY_TIER['type-boost'].length).toBe(18);
    expect(ITEMS_BY_TIER.other.length).toBeGreaterThan(0);
  });

  it('Life Orb is 1.3x final damage', () => {
    expect(getItem('life-orb')!.damageMult).toBe(1.3);
  });

  it('Choice Band boosts physical attack 1.5x', () => {
    const cb = getItem('choice-band')!;
    expect(cb.attackMult).toEqual({ stat: 'attack', factor: 1.5 });
  });

  it('Expert Belt only applies on super-effective hits', () => {
    expect(getItem('expert-belt')!.superEffectiveMult).toBe(1.2);
  });

  it('Light Ball is gated to Pikachu species', () => {
    expect(getItem('light-ball')!.speciesGate).toContain(25);
  });
});

describe('getItem', () => {
  it('returns undefined for unknown id', () => {
    expect(getItem('not-a-real-item')).toBeUndefined();
  });
});
