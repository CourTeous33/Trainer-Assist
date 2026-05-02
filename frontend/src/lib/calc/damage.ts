import type { CalcInput, CalcOutcome, CalcResult, UnsupportedResult, UnsupportedReason } from './types';
import { computeAllStats, stageMultiplier } from './stats';
import { getNature } from './natures';
import { getItem } from './items';

type StatPickKey = 'attack' | 'defense' | 'special_attack' | 'special_defense';

interface MoveStatOverride {
  offenseSide?: 'attacker' | 'defender';
  offenseKey?: StatPickKey;
  defenseKey?: StatPickKey;
}

const MOVE_STAT_OVERRIDES: Record<string, MoveStatOverride> = {
  'body-press':   { offenseKey: 'defense' },
  'foul-play':    { offenseSide: 'defender', offenseKey: 'attack' },
  'psyshock':     { defenseKey: 'defense' },
  'psystrike':    { defenseKey: 'defense' },
  'secret-sword': { defenseKey: 'defense' },
};

const FIXED_DAMAGE_MOVES = new Set([
  'seismic-toss', 'night-shade', 'dragon-rage', 'sonic-boom', 'super-fang',
  'endeavor', 'final-gambit', 'psywave',
]);

const VARIABLE_POWER_MOVES = new Set([
  'gyro-ball', 'low-kick', 'grass-knot', 'electro-ball', 'heat-crash', 'heavy-slam',
  'return', 'frustration', 'punishment', 'flail', 'reversal', 'water-spout', 'eruption',
  'magnitude', 'present', 'fury-cutter', 'rollout', 'ice-ball', 'echoed-voice',
  'fling', 'natural-gift', 'judgment', 'techno-blast', 'multi-attack', 'wring-out',
  'crush-grip', 'stored-power', 'power-trip', 'spit-up',
]);

const MULTI_HIT_MOVES = new Set([
  'bullet-seed', 'icicle-spear', 'pin-missile', 'rock-blast', 'tail-slap',
  'fury-attack', 'fury-swipes', 'arm-thrust', 'comet-punch', 'spike-cannon',
  'double-slap', 'barrage', 'bonemerang', 'double-hit', 'double-kick',
  'gear-grind', 'dragon-darts', 'twineedle', 'water-shuriken', 'triple-kick',
  'triple-axel', 'population-bomb', 'surging-strikes',
]);

const OHKO_MOVES = new Set(['fissure', 'horn-drill', 'sheer-cold', 'guillotine']);

function unsupported(reason: UnsupportedReason): UnsupportedResult {
  return { unsupportedReason: reason };
}

export function calculateDamage(input: CalcInput): CalcOutcome {
  const { move, attacker, defender, attackerSpecies, defenderSpecies, typeEfficacy } = input;

  if (move.power == null || move.damage_class === 'status') return unsupported('no-power');
  if (FIXED_DAMAGE_MOVES.has(move.name))    return unsupported('fixed-damage');
  if (VARIABLE_POWER_MOVES.has(move.name))  return unsupported('variable-power');
  if (MULTI_HIT_MOVES.has(move.name))       return unsupported('multi-hit');
  if (OHKO_MOVES.has(move.name))            return unsupported('ohko-move');

  const aBase = attacker.baseStatsOverride ?? attackerSpecies.baseStats;
  const dBase = defender.baseStatsOverride ?? defenderSpecies.baseStats;
  const aTypes = attacker.typesOverride ?? attackerSpecies.types;
  const dTypes = defender.typesOverride ?? defenderSpecies.types;

  const aStats = computeAllStats(aBase, attacker.ivs, attacker.evs, attacker.level, getNature(attacker.nature));
  const dStats = computeAllStats(dBase, defender.ivs, defender.evs, defender.level, getNature(defender.nature));

  const isPhysical = move.damage_class === 'physical';
  const ovr = MOVE_STAT_OVERRIDES[move.name];
  const offenseSide = ovr?.offenseSide ?? 'attacker';
  const offenseKey: StatPickKey = ovr?.offenseKey ?? (isPhysical ? 'attack' : 'special_attack');
  const defenseKey: StatPickKey = ovr?.defenseKey ?? (isPhysical ? 'defense' : 'special_defense');
  const offenseStats = offenseSide === 'attacker' ? aStats : dStats;
  const offenseStages = offenseSide === 'attacker' ? attacker.stages : defender.stages;
  let A = offenseStats[offenseKey];
  let D = dStats[defenseKey];

  let itemMultDamage = 1.0;
  const item = attacker.itemId ? getItem(attacker.itemId) : undefined;
  const speciesOk = !item || !item.speciesGate || item.speciesGate.includes(attacker.pokemonId);

  if (item && speciesOk) {
    if (item.attackMult && offenseSide === 'attacker') {
      if (item.id === 'light-ball' && offenseKey === 'attack') {
        A = Math.floor(A * 2);
      } else if (item.attackMult.stat === offenseKey) {
        A = Math.floor(A * item.attackMult.factor);
      }
    }
    if (item.typeBoost && item.typeBoost.typeId === move.type_ref.id) {
      itemMultDamage *= item.typeBoost.factor;
    }
    if (item.damageMult) {
      const skipMuscle = item.id === 'muscle-band' && !isPhysical;
      const skipWise = item.id === 'wise-glasses' && isPhysical;
      if (!skipMuscle && !skipWise) {
        itemMultDamage *= item.damageMult;
      }
    }
  }

  // Stages applied after item mults (commutative under multiplication; sub-1% drift from Showdown's stage-first ordering due to Math.floor between steps).
  A = Math.floor(A * stageMultiplier(offenseStages[offenseKey]));
  D = Math.floor(D * stageMultiplier(defender.stages[defenseKey]));

  let typeEff = 1.0;
  for (const dType of dTypes) {
    const factor = (typeEfficacy[move.type_ref.id]?.[dType] ?? 100) / 100;
    typeEff *= factor;
  }

  if (item && speciesOk && item.superEffectiveMult && typeEff > 1) {
    itemMultDamage *= item.superEffectiveMult;
  }

  let berryMultDamage = 1.0;
  const defenderItem = defender.itemId ? getItem(defender.itemId) : undefined;
  if (defenderItem?.defenderResistance) {
    const r = defenderItem.defenderResistance;
    const matchesType = move.type_ref.id === r.typeId;
    const meetsThreshold = !r.requireSuperEffective || typeEff > 1;
    if (matchesType && meetsThreshold) {
      berryMultDamage *= r.factor;
    }
  }

  const stab = aTypes.includes(move.type_ref.id) ? 1.5 : 1.0;

  const L = attacker.level;
  const P = move.power;
  const inner = Math.floor(((2 * L) / 5 + 2) * P * A / D);
  const baseDamage = Math.floor(inner / 50) + 2;

  const rolls: number[] = [];
  for (let i = 85; i <= 100; i++) {
    const roll = i / 100;
    const dmg = typeEff === 0 ? 0 : Math.floor(baseDamage * stab * typeEff * itemMultDamage * berryMultDamage * roll);
    rolls.push(dmg);
  }

  const defenderHp = dStats.hp;
  const minPct = (rolls[0] / defenderHp) * 100;
  const maxPct = (rolls[15] / defenderHp) * 100;
  const avgPct = (rolls.reduce((a, b) => a + b, 0) / 16 / defenderHp) * 100;

  const result: CalcResult = {
    rolls,
    defenderHp,
    minPct,
    maxPct,
    avgPct,
    ohkoPct: 0,
    twoHkoPct: 0,
    threeHkoPct: 0,
    qualifier: '',
    modifiers: { stab, typeEff, item: itemMultDamage, berry: berryMultDamage },
    attackerStat: A,
    defenderStat: D,
  };
  return result;
}
