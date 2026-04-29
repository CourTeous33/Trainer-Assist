import { describe, it, expect } from 'vitest';
import { computeKO, qualifier } from '../ko';

describe('computeKO', () => {
  const filledRolls = (n: number) => Array(16).fill(n);

  it('OHKO 100% when min roll ≥ hp', () => {
    const r = computeKO(filledRolls(100), 90);
    expect(r.ohkoPct).toBe(100);
    expect(r.twoHkoPct).toBe(100);
    expect(r.threeHkoPct).toBe(100);
  });

  it('OHKO 0% when max roll < hp', () => {
    const r = computeKO(filledRolls(50), 200);
    expect(r.ohkoPct).toBe(0);
    expect(r.twoHkoPct).toBe(0);
    expect(r.threeHkoPct).toBe(0);
  });

  it('partial OHKO matches (rolls ≥ hp).count / 16', () => {
    const rolls = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 100, 100, 100, 100];
    const r = computeKO(rolls, 90);
    expect(r.ohkoPct).toBeCloseTo((4 / 16) * 100, 5);
  });

  it('2HKO sums two roll distributions; guaranteed when min*2 ≥ hp', () => {
    const r = computeKO(filledRolls(50), 100);
    expect(r.twoHkoPct).toBe(100);
  });

  it('3HKO matches sum of three rolls', () => {
    const rolls = filledRolls(34);
    const r = computeKO(rolls, 100);
    expect(r.threeHkoPct).toBe(100);
  });
});

describe('qualifier', () => {
  it('returns "guaranteed OHKO" for 100% OHKO', () => {
    expect(qualifier({ ohkoPct: 100, twoHkoPct: 100, threeHkoPct: 100 })).toBe('guaranteed OHKO');
  });
  it('returns "possible OHKO" for partial OHKO', () => {
    expect(qualifier({ ohkoPct: 50, twoHkoPct: 100, threeHkoPct: 100 })).toBe('possible OHKO');
  });
  it('returns "guaranteed 2HKO" when 2HKO 100% but OHKO 0%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100 })).toBe('guaranteed 2HKO');
  });
  it('returns "possible 2HKO" for partial 2HKO', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 30, threeHkoPct: 100 })).toBe('possible 2HKO');
  });
  it('returns "guaranteed 3HKO" when 3HKO 100% but 2HKO 0%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 0, threeHkoPct: 100 })).toBe('guaranteed 3HKO');
  });
  it('returns "4HKO or worse" when 3HKO < 100%', () => {
    expect(qualifier({ ohkoPct: 0, twoHkoPct: 0, threeHkoPct: 60 })).toBe('4HKO or worse');
  });
});
