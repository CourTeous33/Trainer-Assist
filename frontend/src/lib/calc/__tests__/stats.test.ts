import { describe, it, expect } from 'vitest';
import {
  computeStat, computeAllStats, clampEVsForMode, isLevelLockedForMode,
  evTotal, MAX_TOTAL_EV_TRADITIONAL, MAX_PER_STAT_EV_TRADITIONAL,
  MAX_TOTAL_EV_CHAMPION, MAX_PER_STAT_EV_CHAMPION,
} from '../stats';
import { getNature } from '../natures';

describe('computeStat', () => {
  it('Garchomp Lv50 252 Atk EV / 31 IV / Adamant → 200 Atk (Showdown canonical)', () => {
    expect(computeStat('attack', 130, 31, 252, 50, getNature('adamant'))).toBe(200);
  });

  it('Blissey Lv50 252 HP EV / 31 IV → 362 HP (Showdown canonical)', () => {
    expect(computeStat('hp', 255, 31, 252, 50, getNature('hardy'))).toBe(362);
  });

  it('neutral nature applies 1.0', () => {
    // base 100, IV 31, 0 EV, Lv50, Hardy: floor((2*100+31)*50/100)+5 = 115+5 = 120
    expect(computeStat('speed', 100, 31, 0, 50, getNature('hardy'))).toBe(120);
  });

  it('boosted nature multiplies after stat formula and floors', () => {
    // pre-nature 120, ×1.1 = 132 (no flooring loss at this point)
    expect(computeStat('special_attack', 100, 31, 0, 50, getNature('modest'))).toBe(132);
  });
});

describe('computeAllStats', () => {
  it('returns full Stats object with HP slot', () => {
    const stats = computeAllStats(
      { hp: 255, attack: 10, defense: 10, special_attack: 75, special_defense: 135, speed: 55 },
      { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      { hp: 252, attack: 0, defense: 252, special_attack: 0, special_defense: 4, speed: 0 },
      50,
      getNature('bold'),
    );
    expect(stats.hp).toBe(362);
    expect(stats.defense).toBeGreaterThan(stats.attack);
  });
});

describe('Champion mode caps', () => {
  it('clamps per-stat EV to 32 and total to 66', () => {
    const clamped = clampEVsForMode(
      { hp: 100, attack: 60, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      'champion',
    );
    expect(clamped.hp).toBe(32);
    expect(clamped.attack).toBe(32);
    expect(evTotal(clamped)).toBeLessThanOrEqual(66);
  });

  it('Traditional mode allows 510 total / 252 per stat', () => {
    const clamped = clampEVsForMode(
      { hp: 252, attack: 252, defense: 252, special_attack: 0, special_defense: 0, speed: 0 },
      'traditional',
    );
    expect(clamped.hp).toBe(252);
    expect(evTotal(clamped)).toBeLessThanOrEqual(510);
  });

  it('exposes the right caps via constants', () => {
    expect(MAX_TOTAL_EV_TRADITIONAL).toBe(510);
    expect(MAX_PER_STAT_EV_TRADITIONAL).toBe(252);
    expect(MAX_TOTAL_EV_CHAMPION).toBe(66);
    expect(MAX_PER_STAT_EV_CHAMPION).toBe(32);
  });
});

describe('isLevelLockedForMode', () => {
  it('locks level in champion mode', () => {
    expect(isLevelLockedForMode('champion')).toBe(true);
    expect(isLevelLockedForMode('traditional')).toBe(false);
  });
});

import { stageMultiplier } from '../stats';

describe('stageMultiplier', () => {
  it('returns 1 at stage 0', () => {
    expect(stageMultiplier(0)).toBe(1);
  });

  it('returns (2+n)/2 for positive stages', () => {
    expect(stageMultiplier(1)).toBeCloseTo(1.5, 10);
    expect(stageMultiplier(2)).toBe(2);
    expect(stageMultiplier(6)).toBe(4);
  });

  it('returns 2/(2+|n|) for negative stages', () => {
    expect(stageMultiplier(-1)).toBeCloseTo(2 / 3, 10);
    expect(stageMultiplier(-2)).toBe(0.5);
    expect(stageMultiplier(-6)).toBe(0.25);
  });

  it('clamps inputs outside [-6, 6]', () => {
    expect(stageMultiplier(7)).toBe(stageMultiplier(6));
    expect(stageMultiplier(-99)).toBe(stageMultiplier(-6));
  });
});
