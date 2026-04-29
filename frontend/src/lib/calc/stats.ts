import type { Stats } from '@/lib/types';
import type { EVMode, Nature, StatKey } from './types';
import { NATURE_MULTIPLIER } from './natures';
import { STAT_KEYS } from './types';

export const MAX_TOTAL_EV_TRADITIONAL = 510;
export const MAX_PER_STAT_EV_TRADITIONAL = 252;
export const MAX_TOTAL_EV_CHAMPION = 66;
export const MAX_PER_STAT_EV_CHAMPION = 32;

export function computeStat(
  stat: StatKey,
  base: number,
  iv: number,
  ev: number,
  level: number,
  nature: Nature,
): number {
  const evContribution = Math.floor(ev / 4);
  const inner = Math.floor(((2 * base + iv + evContribution) * level) / 100);
  if (stat === 'hp') {
    return inner + level + 10;
  }
  const withBase = inner + 5;
  const natured = Math.floor(withBase * NATURE_MULTIPLIER(nature, stat));
  return natured;
}

export function computeAllStats(
  base: Stats,
  ivs: Stats,
  evs: Stats,
  level: number,
  nature: Nature,
): Stats {
  return {
    hp: computeStat('hp', base.hp, ivs.hp, evs.hp, level, nature),
    attack: computeStat('attack', base.attack, ivs.attack, evs.attack, level, nature),
    defense: computeStat('defense', base.defense, ivs.defense, evs.defense, level, nature),
    special_attack: computeStat('special_attack', base.special_attack, ivs.special_attack, evs.special_attack, level, nature),
    special_defense: computeStat('special_defense', base.special_defense, ivs.special_defense, evs.special_defense, level, nature),
    speed: computeStat('speed', base.speed, ivs.speed, evs.speed, level, nature),
  };
}

export function evTotal(evs: Stats): number {
  return STAT_KEYS.reduce((sum, k) => sum + (evs[k] ?? 0), 0);
}

function perStatCap(mode: EVMode): number {
  return mode === 'champion' ? MAX_PER_STAT_EV_CHAMPION : MAX_PER_STAT_EV_TRADITIONAL;
}

function totalCap(mode: EVMode): number {
  return mode === 'champion' ? MAX_TOTAL_EV_CHAMPION : MAX_TOTAL_EV_TRADITIONAL;
}

export function clampEVsForMode(evs: Stats, mode: EVMode): Stats {
  const perStat = perStatCap(mode);
  const total = totalCap(mode);
  const stepped: Stats = {
    hp: Math.min(perStat, Math.max(0, evs.hp)),
    attack: Math.min(perStat, Math.max(0, evs.attack)),
    defense: Math.min(perStat, Math.max(0, evs.defense)),
    special_attack: Math.min(perStat, Math.max(0, evs.special_attack)),
    special_defense: Math.min(perStat, Math.max(0, evs.special_defense)),
    speed: Math.min(perStat, Math.max(0, evs.speed)),
  };
  let over = evTotal(stepped) - total;
  if (over <= 0) return stepped;
  const result = { ...stepped };
  const trimOrder: StatKey[] = ['speed', 'special_defense', 'special_attack', 'defense', 'attack', 'hp'];
  for (const key of trimOrder) {
    if (over <= 0) break;
    const reducible = Math.min(over, result[key]);
    result[key] -= reducible;
    over -= reducible;
  }
  return result;
}

export function isLevelLockedForMode(mode: EVMode): boolean {
  return mode === 'champion';
}

export function lockedLevelForMode(mode: EVMode): number | null {
  return mode === 'champion' ? 50 : null;
}

export function lockedIVsForMode(mode: EVMode): Stats | null {
  return mode === 'champion'
    ? { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 }
    : null;
}
