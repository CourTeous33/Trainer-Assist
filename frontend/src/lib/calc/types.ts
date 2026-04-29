import type { Stats, MoveSummary, LocalizedNames } from '@/lib/types';

export type EVMode = 'traditional' | 'champion';

export type NatureId =
  | 'hardy' | 'lonely' | 'brave' | 'adamant' | 'naughty'
  | 'bold' | 'docile' | 'relaxed' | 'impish' | 'lax'
  | 'timid' | 'hasty' | 'serious' | 'jolly' | 'naive'
  | 'modest' | 'mild' | 'quiet' | 'bashful' | 'rash'
  | 'calm' | 'gentle' | 'sassy' | 'careful' | 'quirky';

export type StatKey = keyof Stats;

export interface Nature {
  id: NatureId;
  names: LocalizedNames;
  boosted: StatKey | null;
  lowered: StatKey | null;
}

export type ItemTier = 'top' | 'type-boost' | 'other';

export interface Item {
  id: string;
  names: LocalizedNames;
  tier: ItemTier;
  damageMult?: number;
  attackMult?: { stat: 'attack' | 'special_attack'; factor: number };
  typeBoost?: { typeId: number; factor: number };
  superEffectiveMult?: number;
  speciesGate?: number[];
  speciesGateNote?: string;
}

export interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
}

export interface CalcInput {
  evMode: EVMode;
  attacker: PokemonConfig;
  defender: PokemonConfig;
  attackerSpecies: { types: number[]; baseStats: Stats };
  defenderSpecies: { types: number[]; baseStats: Stats };
  move: MoveSummary;
  typeEfficacy: number[][];
}

export type UnsupportedReason =
  | 'no-power'
  | 'fixed-damage'
  | 'variable-power'
  | 'multi-hit'
  | 'ohko-move';

export interface CalcResult {
  rolls: number[];
  defenderHp: number;
  minPct: number;
  maxPct: number;
  avgPct: number;
  ohkoPct: number;
  twoHkoPct: number;
  threeHkoPct: number;
  qualifier: string;
  modifiers: { stab: number; typeEff: number; item: number };
  attackerStat: number;
  defenderStat: number;
}

export interface UnsupportedResult {
  unsupportedReason: UnsupportedReason;
}

export type CalcOutcome = CalcResult | UnsupportedResult;

export const STAT_KEYS: StatKey[] = [
  'hp', 'attack', 'defense', 'special_attack', 'special_defense', 'speed',
];

export const ZERO_EVS: Stats = {
  hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0,
};

export const MAX_IVS: Stats = {
  hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31,
};
