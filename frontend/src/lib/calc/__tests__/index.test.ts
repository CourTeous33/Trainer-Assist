import { describe, it, expect } from 'vitest';
import { calculate } from '../index';
import type { CalcInput } from '../types';

function baseInput(): CalcInput {
  const baseStats = { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 };
  const efficacy = Array.from({ length: 19 }, () => Array(19).fill(100));
  return {
    evMode: 'traditional',
    attacker: { pokemonId: 1, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null, abilityId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 } },
    defender: { pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null, abilityId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 } },
    attackerSpecies: { types: [1], baseStats },
    defenderSpecies: { types: [1], baseStats },
    move: { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical', flags: [] },
    typeEfficacy: efficacy,
  };
}

describe('calculate', () => {
  it('returns full result with KO numbers and qualifier', () => {
    const out = calculate(baseInput());
    if ('unsupportedReason' in out) throw new Error('expected supported');
    expect(out.rolls.length).toBe(16);
    expect(out.qualifier).toBeTruthy();
    expect(out.minPct).toBeGreaterThan(0);
    expect(out.ohkoPct).toBeGreaterThanOrEqual(0);
    expect(out.threeHkoPct).toBeGreaterThanOrEqual(out.twoHkoPct);
  });

  it('passes through unsupported moves', () => {
    const out = calculate({
      ...baseInput(),
      move: { id: 1, name: 'splash', names: { en: 'Splash' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: null, accuracy: null, pp: 40, damage_class: 'status', flags: [] },
    });
    expect('unsupportedReason' in out).toBe(true);
  });
});
