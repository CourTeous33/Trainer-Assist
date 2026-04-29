import type { Stats } from '@/lib/types';
import type { EVMode, NatureId } from './types';
import { clampEVsForMode, lockedIVsForMode, lockedLevelForMode } from './stats';

export interface CalcState {
  evMode: EVMode;
  attacker: AttackerState;
  defender: DefenderState;
}

export interface DefenderState {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
}

export interface AttackerState extends DefenderState {
  moveIds: [number | null, number | null, number | null, number | null];
}

const DEFAULT_ATTACKER_ID = 445;
const DEFAULT_DEFENDER_ID = 242;

export function defaultCalcState(): CalcState {
  const zero: Stats = { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
  const max31: Stats = { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 };
  return {
    evMode: 'traditional',
    attacker: {
      pokemonId: DEFAULT_ATTACKER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy', itemId: null,
      moveIds: [null, null, null, null],
    },
    defender: {
      pokemonId: DEFAULT_DEFENDER_ID,
      baseStatsOverride: null, typesOverride: null,
      level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy', itemId: null,
    },
  };
}

const NATURE_IDS: NatureId[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
];

function isNatureId(s: unknown): s is NatureId {
  return typeof s === 'string' && (NATURE_IDS as string[]).includes(s);
}

function clampStats(input: unknown, max: number): Stats {
  const obj = (input ?? {}) as Partial<Stats>;
  const c = (n: unknown) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)));
  return {
    hp: c(obj.hp), attack: c(obj.attack), defense: c(obj.defense),
    special_attack: c(obj.special_attack), special_defense: c(obj.special_defense), speed: c(obj.speed),
  };
}

function packSide(side: AttackerState | DefenderState, isAttacker: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    p: side.pokemonId,
    l: side.level,
    e: side.evs,
    i: side.ivs,
    n: side.nature,
    it: side.itemId,
    bso: side.baseStatsOverride,
    to: side.typesOverride,
  };
  if (isAttacker) base.mv = (side as AttackerState).moveIds;
  return base;
}

function unpackSide(raw: unknown, isAttacker: boolean, mode: EVMode): AttackerState | DefenderState {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lockedLevel = lockedLevelForMode(mode);
  const lockedIvs = lockedIVsForMode(mode);
  const rawLevel = Math.min(100, Math.max(1, Math.floor(Number(r.l) || 50)));
  const level = lockedLevel ?? rawLevel;
  const evsClamped = clampEVsForMode(clampStats(r.e, 252), mode);
  const ivs = lockedIvs ?? clampStats(r.i, 31);
  const nature = isNatureId(r.n) ? r.n : 'hardy';
  const pokemonId = Math.max(1, Math.floor(Number(r.p) || 1));
  const itemId = typeof r.it === 'string' ? r.it : null;
  const baseStatsOverride = r.bso ? clampStats(r.bso, 999) : null;
  const typesOverride = Array.isArray(r.to)
    ? (r.to as unknown[]).slice(0, 2).map((x) => Math.max(1, Math.floor(Number(x) || 1)))
    : null;
  const side: DefenderState = { pokemonId, level, ivs, evs: evsClamped, nature, itemId, baseStatsOverride, typesOverride };
  if (isAttacker) {
    const mv = Array.isArray(r.mv) ? r.mv : [];
    const moveIds: AttackerState['moveIds'] = [
      typeof mv[0] === 'number' ? mv[0] : null,
      typeof mv[1] === 'number' ? mv[1] : null,
      typeof mv[2] === 'number' ? mv[2] : null,
      typeof mv[3] === 'number' ? mv[3] : null,
    ];
    return { ...side, moveIds };
  }
  return side;
}

export function serializeState(state: CalcState): string {
  const blob = {
    v: 1,
    m: state.evMode === 'champion' ? 'c' : 't',
    a: packSide(state.attacker, true),
    d: packSide(state.defender, false),
  };
  return btoa(JSON.stringify(blob));
}

export function deserializeState(blob: string): CalcState {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(atob(blob)) as Record<string, unknown>;
  } catch {
    return defaultCalcState();
  }
  if (!parsed || typeof parsed !== 'object') return defaultCalcState();
  const mode: EVMode = parsed.m === 'c' ? 'champion' : 'traditional';
  return {
    evMode: mode,
    attacker: unpackSide(parsed.a, true, mode) as AttackerState,
    defender: unpackSide(parsed.d, false, mode),
  };
}
