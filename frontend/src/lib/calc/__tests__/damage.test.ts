import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../damage';
import type { CalcInput } from '../types';

function identityEfficacy(): number[][] {
  return Array.from({ length: 19 }, () => Array(19).fill(100));
}

function input(over: Partial<CalcInput>): CalcInput {
  const baseStats = { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 };
  return {
    evMode: 'traditional',
    attacker: {
      pokemonId: 1, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
    defender: {
      pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
    attackerSpecies: { types: [1], baseStats },
    defenderSpecies: { types: [1], baseStats },
    move: { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' },
    typeEfficacy: identityEfficacy(),
    ...over,
  };
}

describe('calculateDamage', () => {
  it('returns 16 rolls in non-decreasing order', () => {
    const out = calculateDamage(input({}));
    if ('unsupportedReason' in out) throw new Error('expected supported');
    expect(out.rolls.length).toBe(16);
    for (let i = 1; i < 16; i++) {
      expect(out.rolls[i]).toBeGreaterThanOrEqual(out.rolls[i - 1]);
    }
  });

  it('returns unsupported for status moves (power null)', () => {
    const out = calculateDamage(input({
      move: { id: 1, name: 'splash', names: { en: 'Splash' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: null, accuracy: null, pp: 40, damage_class: 'status' },
    }));
    expect('unsupportedReason' in out).toBe(true);
  });

  it('STAB applies when move type is in attacker types', () => {
    // attackerSpecies.types = [1] and move is normal-type (id 1) → STAB.
    const stab = calculateDamage(input({})) as { modifiers: { stab: number } };
    expect(stab.modifiers.stab).toBe(1.5);
  });

  it('STAB does not apply when move type not in attacker types', () => {
    const noStab = calculateDamage(input({
      attackerSpecies: { types: [10], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
    })) as { modifiers: { stab: number } };
    expect(noStab.modifiers.stab).toBe(1.0);
  });

  it('type effectiveness multiplies; 0× → all rolls 0', () => {
    const eff = identityEfficacy();
    eff[1][2] = 0;
    const out = calculateDamage(input({
      defenderSpecies: { types: [2], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
    })) as { rolls: number[]; modifiers: { typeEff: number } };
    expect(out.rolls.every((r) => r === 0)).toBe(true);
    expect(out.modifiers.typeEff).toBe(0);
  });

  it('Life Orb multiplies final by 1.3', () => {
    const noItem = calculateDamage(input({})) as { rolls: number[] };
    const withOrb = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'life-orb' },
    })) as { rolls: number[]; modifiers: { item: number } };
    expect(withOrb.modifiers.item).toBe(1.3);
    for (let i = 0; i < 16; i++) {
      expect(withOrb.rolls[i]).toBeGreaterThanOrEqual(Math.floor(noItem.rolls[i] * 1.3) - 1);
      expect(withOrb.rolls[i]).toBeLessThanOrEqual(Math.floor(noItem.rolls[i] * 1.3) + 1);
    }
  });

  it('Choice Band boosts physical attack stat 1.5x', () => {
    const physical = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
    })) as { attackerStat: number };
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    expect(physical.attackerStat).toBe(Math.floor(baseline.attackerStat * 1.5));
  });

  it('Expert Belt only applies when type effectiveness > 1', () => {
    const eff = identityEfficacy();
    eff[1][3] = 200;
    const superEff = calculateDamage(input({
      defenderSpecies: { types: [3], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      attacker: { ...input({}).attacker, itemId: 'expert-belt' },
    })) as { modifiers: { item: number } };
    expect(superEff.modifiers.item).toBe(1.2);

    const neutral = calculateDamage(input({
      attacker: { ...input({}).attacker, itemId: 'expert-belt' },
    })) as { modifiers: { item: number } };
    expect(neutral.modifiers.item).toBe(1.0);
  });

  it('baseStatsOverride substitutes for species base stats', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const override = calculateDamage(input({
      attacker: {
        ...input({}).attacker,
        baseStatsOverride: { hp: 100, attack: 200, defense: 100, special_attack: 100, special_defense: 100, speed: 100 },
      },
    })) as { attackerStat: number };
    expect(override.attackerStat).toBeGreaterThan(baseline.attackerStat);
  });

  it('Mega Garchomp Earthquake STAB and shape', () => {
    const eff = identityEfficacy();
    const out = calculateDamage(input({
      attacker: {
        ...input({}).attacker,
        baseStatsOverride: { hp: 108, attack: 170, defense: 115, special_attack: 120, special_defense: 95, speed: 92 },
        evs: { hp: 0, attack: 252, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        nature: 'adamant',
      },
      defender: {
        ...input({}).defender,
        baseStatsOverride: { hp: 108, attack: 130, defense: 95, special_attack: 80, special_defense: 85, speed: 102 },
        evs: { hp: 4, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      },
      attackerSpecies: { types: [16, 5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      defenderSpecies: { types: [16, 5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      move: { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' },
      typeEfficacy: eff,
    })) as { rolls: number[]; modifiers: { stab: number; typeEff: number } };
    expect(out.modifiers.stab).toBe(1.5);
    expect(out.modifiers.typeEff).toBe(1.0);
    expect(out.rolls[0]).toBeGreaterThan(0);
    expect(out.rolls[15]).toBeGreaterThan(out.rolls[0]);
  });

  it('+2 SpA roughly doubles rolls vs the same defender on a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const boosted = calculateDamage(input({
      move: specialMove,
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 0, special_attack: 2, special_defense: 0 } },
    })) as { rolls: number[] };
    expect(boosted.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 1.9);
    expect(boosted.rolls[15]).toBeLessThan(baseline.rolls[15] * 2.1);
  });

  it('-1 defender SpD increases damage from a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const dropped = calculateDamage(input({
      move: specialMove,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: -1 } },
    })) as { rolls: number[] };
    expect(dropped.rolls[0]).toBeGreaterThan(baseline.rolls[0]);
  });

  it('+6 attacker Atk produces ~4x attackerStat on a physical move', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const max = calculateDamage(input({
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(max.attackerStat).toBeGreaterThan(baseline.attackerStat * 3.9);
    expect(max.attackerStat).toBeLessThan(baseline.attackerStat * 4.1);
  });

  it('stages on stats irrelevant to the move do not change damage', () => {
    const baseline = calculateDamage(input({})) as { rolls: number[]; attackerStat: number; defenderStat: number };
    const irrelevant = calculateDamage(input({
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 6, special_attack: 6, special_defense: 6 } },
      defender: { ...input({}).defender, stages: { attack: 6, defense: 0, special_attack: 6, special_defense: 6 } },
    })) as { rolls: number[]; attackerStat: number; defenderStat: number };
    expect(irrelevant.attackerStat).toBe(baseline.attackerStat);
    expect(irrelevant.defenderStat).toBe(baseline.defenderStat);
    expect(irrelevant.rolls).toEqual(baseline.rolls);
  });
});
