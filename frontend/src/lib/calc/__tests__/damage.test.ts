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
      nature: 'hardy', itemId: null, abilityId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
    defender: {
      pokemonId: 2, baseStatsOverride: null, typesOverride: null, level: 50,
      ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
      evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
      nature: 'hardy', itemId: null, abilityId: null,
      stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 0 },
    },
    attackerSpecies: { types: [1], baseStats },
    defenderSpecies: { types: [1], baseStats },
    move: { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical', flags: [] },
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
      move: { id: 1, name: 'splash', names: { en: 'Splash' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: null, accuracy: null, pp: 40, damage_class: 'status', flags: [] },
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
      move: { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical', flags: [] },
      typeEfficacy: eff,
    })) as { rolls: number[]; modifiers: { stab: number; typeEff: number } };
    expect(out.modifiers.stab).toBe(1.5);
    expect(out.modifiers.typeEff).toBe(1.0);
    expect(out.rolls[0]).toBeGreaterThan(0);
    expect(out.rolls[15]).toBeGreaterThan(out.rolls[0]);
  });

  it('+2 SpA roughly doubles rolls vs the same defender on a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const boosted = calculateDamage(input({
      move: specialMove,
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 0, special_attack: 2, special_defense: 0 } },
    })) as { rolls: number[] };
    expect(boosted.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 1.9);
    expect(boosted.rolls[15]).toBeLessThan(baseline.rolls[15] * 2.1);
  });

  it('-1 defender SpD increases damage from a special move', () => {
    const specialMove = { id: 94, name: 'psychic', names: { en: 'Psychic' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const baseline = calculateDamage(input({ move: specialMove })) as { rolls: number[] };
    const dropped = calculateDamage(input({
      move: specialMove,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: -1 } },
    })) as { rolls: number[] };
    expect(dropped.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 1.4);
    expect(dropped.rolls[0]).toBeLessThan(baseline.rolls[0] * 1.6);
  });

  it('+6 attacker Atk produces ~4x attackerStat and ~3.8x rolls on a physical move', () => {
    const baseline = calculateDamage(input({})) as { rolls: number[]; attackerStat: number };
    const max = calculateDamage(input({
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { rolls: number[]; attackerStat: number };
    expect(max.attackerStat).toBeGreaterThan(baseline.attackerStat * 3.9);
    expect(max.attackerStat).toBeLessThan(baseline.attackerStat * 4.1);
    expect(max.rolls[0]).toBeGreaterThan(baseline.rolls[0] * 3);
    expect(max.rolls[0]).toBeLessThan(baseline.rolls[0] * 4.1);
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

  it('Chople Berry halves super-effective Fighting damage', () => {
    const eff = identityEfficacy();
    eff[2][1] = 200; // Fighting super-effective vs Normal
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const, flags: [] };
    const noBerry = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
    })) as { rolls: number[]; modifiers: { berry: number } };
    const withBerry = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { rolls: number[]; modifiers: { berry: number } };
    expect(withBerry.modifiers.berry).toBe(0.5);
    expect(noBerry.modifiers.berry).toBe(1);
    for (let i = 0; i < 16; i++) {
      expect(withBerry.rolls[i]).toBeGreaterThanOrEqual(Math.floor(noBerry.rolls[i] * 0.5) - 1);
      expect(withBerry.rolls[i]).toBeLessThanOrEqual(Math.floor(noBerry.rolls[i] * 0.5) + 1);
    }
  });

  it('Chople Berry does NOT apply to a not-very-effective Fighting move', () => {
    const eff = identityEfficacy();
    eff[2][14] = 50; // Fighting not-very-effective vs Psychic
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const, flags: [] };
    const out = calculateDamage(input({
      defenderSpecies: { types: [14], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Chople Berry does NOT apply to non-Fighting super-effective move', () => {
    const eff = identityEfficacy();
    eff[10][7] = 200; // Fire super-effective vs Bug
    const fireMove = { id: 1, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      defenderSpecies: { types: [7], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fireMove,
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Chilan Berry halves Normal moves regardless of effectiveness', () => {
    const normalMove = { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' as const, flags: [] };
    const neutral = calculateDamage(input({
      move: normalMove,
      defender: { ...input({}).defender, itemId: 'chilan-berry' },
    })) as { modifiers: { berry: number } };
    expect(neutral.modifiers.berry).toBe(0.5);
  });

  it('Chilan Berry does NOT apply to non-Normal moves', () => {
    const fireMove = { id: 1, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, itemId: 'chilan-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(1);
  });

  it('Choice Band on attacker composes with Chople on defender', () => {
    const eff = identityEfficacy();
    eff[2][1] = 200; // Fighting super-effective vs Normal
    const fightingMove = { id: 1, name: 'close-combat', names: { en: 'Close Combat' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 120, accuracy: 100, pp: 5, damage_class: 'physical' as const, flags: [] };
    const out = calculateDamage(input({
      defenderSpecies: { types: [1], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: eff,
      move: fightingMove,
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
      defender: { ...input({}).defender, itemId: 'chople-berry' },
    })) as { modifiers: { berry: number } };
    expect(out.modifiers.berry).toBe(0.5);
  });

  it('Body Press uses attacker Defense as offense stat', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    // High Defense, low Attack on the attacker.
    const aDefHigh = { ...input({}).attacker, baseStatsOverride: { hp: 100, attack: 50, defense: 200, special_attack: 50, special_defense: 50, speed: 50 } };
    const aAtkHigh = { ...input({}).attacker, baseStatsOverride: { hp: 100, attack: 200, defense: 50, special_attack: 50, special_defense: 50, speed: 50 } };
    const bp = calculateDamage(input({ move: bodyPress, attacker: aDefHigh })) as { attackerStat: number };
    const tackleHighDef = calculateDamage(input({ attacker: aDefHigh })) as { attackerStat: number };
    const tackleHighAtk = calculateDamage(input({ attacker: aAtkHigh })) as { attackerStat: number };
    // Body Press attackerStat reflects Defense (high), not Attack (low).
    expect(bp.attackerStat).toBe(tackleHighAtk.attackerStat); // both read the "high" stat (200 base)
    expect(bp.attackerStat).toBeGreaterThan(tackleHighDef.attackerStat); // tackle on aDefHigh reads its low Attack
  });

  it('Body Press is unaffected by attacker Atk stage but reads attacker Def stage', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    const baseline = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const atkBoosted = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    const defBoosted = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, stages: { attack: 0, defense: 6, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(atkBoosted.attackerStat).toBe(baseline.attackerStat);
    expect(defBoosted.attackerStat).toBe(Math.floor(baseline.attackerStat * 4));
  });

  it('Choice Band does not boost Body Press', () => {
    const bodyPress = { id: 1, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    const noItem = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const withBand = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, itemId: 'choice-band' },
    })) as { attackerStat: number };
    expect(withBand.attackerStat).toBe(noItem.attackerStat);
  });

  it('Foul Play uses defender Attack and defender Atk stage', () => {
    const foulPlay = { id: 1, name: 'foul-play', names: { en: 'Foul Play' }, type_ref: { id: 17, name: 'dark', names: { en: 'Dark' } }, power: 95, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: [] };
    // Defender has high Attack, low everything else.
    const dHighAtk = { ...input({}).defender, baseStatsOverride: { hp: 100, attack: 200, defense: 50, special_attack: 50, special_defense: 50, speed: 50 } };
    const baseline = calculateDamage(input({ move: foulPlay, defender: dHighAtk })) as { attackerStat: number };
    // Defender +6 Atk should ~4x attackerStat.
    const dBoosted = calculateDamage(input({
      move: foulPlay,
      defender: { ...dHighAtk, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(dBoosted.attackerStat).toBe(Math.floor(baseline.attackerStat * 4));
    // Attacker stages don't affect Foul Play.
    const aBoosted = calculateDamage(input({
      move: foulPlay,
      defender: dHighAtk,
      attacker: { ...input({}).attacker, stages: { attack: 6, defense: 0, special_attack: 0, special_defense: 0 } },
    })) as { attackerStat: number };
    expect(aBoosted.attackerStat).toBe(baseline.attackerStat);
  });

  it('Psyshock divides by defender Defense (not SpD) and reads defender Def stage', () => {
    const psyshock = { id: 1, name: 'psyshock', names: { en: 'Psyshock' }, type_ref: { id: 14, name: 'psychic', names: { en: 'Psychic' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const baseline = calculateDamage(input({ move: psyshock })) as { defenderStat: number };
    const defBoost = calculateDamage(input({
      move: psyshock,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 2, special_attack: 0, special_defense: 0 } },
    })) as { defenderStat: number };
    const spdBoost = calculateDamage(input({
      move: psyshock,
      defender: { ...input({}).defender, stages: { attack: 0, defense: 0, special_attack: 0, special_defense: 6 } },
    })) as { defenderStat: number };
    expect(defBoost.defenderStat).toBe(Math.floor(baseline.defenderStat * 2));
    expect(spdBoost.defenderStat).toBe(baseline.defenderStat); // SpD stage irrelevant
  });

  // ---- Abilities (Bundle A) ----

  it('Adaptability raises STAB to 2.0 on STAB moves', () => {
    const out = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'adaptability' },
    })) as { modifiers: { stab: number } };
    expect(out.modifiers.stab).toBe(2.0);
  });

  it('Adaptability does not affect non-STAB moves', () => {
    const out = calculateDamage(input({
      attackerSpecies: { types: [10], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'adaptability' },
    })) as { modifiers: { stab: number } };
    expect(out.modifiers.stab).toBe(1.0);
  });

  it('Huge Power doubles physical Attack', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const huge = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(huge.attackerStat).toBe(Math.floor(baseline.attackerStat * 2));
  });

  it('Huge Power does NOT apply to Body Press (offenseKey is defense)', () => {
    const bodyPress = { id: 776, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: ['contact'] };
    const baseline = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const huge = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(huge.attackerStat).toBe(baseline.attackerStat);
  });

  it('Huge Power does NOT apply to Foul Play (offenseSide is defender)', () => {
    const foulPlay = { id: 492, name: 'foul-play', names: { en: 'Foul Play' }, type_ref: { id: 17, name: 'dark', names: { en: 'Dark' } }, power: 95, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact'] };
    const baseline = calculateDamage(input({ move: foulPlay })) as { attackerStat: number };
    const huge = calculateDamage(input({
      move: foulPlay,
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(huge.attackerStat).toBe(baseline.attackerStat);
  });

  it('Tough Claws boosts contact moves by 1.3', () => {
    const contactMove = { id: 33, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' as const, flags: ['contact'] };
    const out = calculateDamage(input({
      move: contactMove,
      attacker: { ...input({}).attacker, abilityId: 'tough-claws' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.3, 5);
  });

  it('Tough Claws does NOT boost non-contact moves', () => {
    const noContactMove = { id: 999, name: 'special-move', names: { en: 'Special Move' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 40, accuracy: 100, pp: 35, damage_class: 'physical' as const, flags: [] };
    const out = calculateDamage(input({
      move: noContactMove,
      attacker: { ...input({}).attacker, abilityId: 'tough-claws' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBe(1.0);
  });

  it('Iron Fist boosts punch moves by 1.2', () => {
    const punchMove = { id: 8, name: 'ice-punch', names: { en: 'Ice Punch' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 75, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact', 'punch'] };
    const out = calculateDamage(input({
      move: punchMove,
      attacker: { ...input({}).attacker, abilityId: 'iron-fist' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('Strong Jaw boosts bite moves by 1.5', () => {
    const biteMove = { id: 305, name: 'ice-fang', names: { en: 'Ice Fang' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 65, accuracy: 95, pp: 15, damage_class: 'physical' as const, flags: ['contact', 'bite'] };
    const out = calculateDamage(input({
      move: biteMove,
      attacker: { ...input({}).attacker, abilityId: 'strong-jaw' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Mega Launcher boosts pulse moves by 1.5', () => {
    const pulseMove = { id: 396, name: 'aura-sphere', names: { en: 'Aura Sphere' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 20, damage_class: 'special' as const, flags: ['pulse'] };
    const out = calculateDamage(input({
      move: pulseMove,
      attacker: { ...input({}).attacker, abilityId: 'mega-launcher' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Sharpness boosts slicing moves by 1.5', () => {
    const slicingMove = { id: 14, name: 'cut', names: { en: 'Cut' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 50, accuracy: 95, pp: 30, damage_class: 'physical' as const, flags: ['contact', 'slicing'] };
    const out = calculateDamage(input({
      move: slicingMove,
      attacker: { ...input({}).attacker, abilityId: 'sharpness' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Reckless boosts recoil moves by 1.2', () => {
    const recoilMove = { id: 38, name: 'double-edge', names: { en: 'Double-Edge' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 120, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact', 'recoil'] };
    const out = calculateDamage(input({
      move: recoilMove,
      attacker: { ...input({}).attacker, abilityId: 'reckless' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('Punk Rock: sound moves boosted ×1.3 offense, ×0.5 defense', () => {
    const soundMove = { id: 304, name: 'hyper-voice', names: { en: 'Hyper Voice' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: ['sound'] };
    const off = calculateDamage(input({
      move: soundMove,
      attacker: { ...input({}).attacker, abilityId: 'punk-rock' },
    })) as { modifiers: { abilityAtk: number; abilityDef: number } };
    expect(off.modifiers.abilityAtk).toBeCloseTo(1.3, 5);
    const def = calculateDamage(input({
      move: soundMove,
      defender: { ...input({}).defender, abilityId: 'punk-rock' },
    })) as { modifiers: { abilityDef: number } };
    expect(def.modifiers.abilityDef).toBe(0.5);
  });

  it('Technician boosts power<=60 by 1.5', () => {
    const lowPower = { id: 33, name: 'tackle', names: { en: 'Tackle' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 60, accuracy: 100, pp: 35, damage_class: 'physical' as const, flags: [] };
    const highPower = { ...lowPower, power: 61 };
    const low = calculateDamage(input({
      move: lowPower,
      attacker: { ...input({}).attacker, abilityId: 'technician' },
    })) as { modifiers: { abilityAtk: number } };
    const high = calculateDamage(input({
      move: highPower,
      attacker: { ...input({}).attacker, abilityId: 'technician' },
    })) as { modifiers: { abilityAtk: number } };
    expect(low.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
    expect(high.modifiers.abilityAtk).toBe(1.0);
  });

  it('Pixilate Hyper Voice on Sylveon: type → Fairy, ×1.2, STAB applies', () => {
    const hyperVoice = { id: 304, name: 'hyper-voice', names: { en: 'Hyper Voice' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: ['sound'] };
    const out = calculateDamage(input({
      move: hyperVoice,
      attackerSpecies: { types: [18], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'pixilate' },
    })) as { modifiers: { stab: number; abilityAtk: number } };
    expect(out.modifiers.stab).toBe(1.5);
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('Aerilate Body Slam on Salamence-Mega: type → Flying, ×1.2', () => {
    const bodySlam = { id: 34, name: 'body-slam', names: { en: 'Body Slam' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 85, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact'] };
    const out = calculateDamage(input({
      move: bodySlam,
      attackerSpecies: { types: [16, 3], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'aerilate' },
    })) as { modifiers: { stab: number; abilityAtk: number } };
    expect(out.modifiers.stab).toBe(1.5);
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('typeChange does not fire on a non-Normal move', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      move: fireMove,
      attacker: { ...input({}).attacker, abilityId: 'pixilate' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBe(1.0);
  });

  it('Levitate makes defender immune to Ground; Mold Breaker bypasses', () => {
    const earthquake = { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    const eff = identityEfficacy();
    const blocked = calculateDamage(input({
      move: earthquake,
      typeEfficacy: eff,
      defender: { ...input({}).defender, abilityId: 'levitate' },
    })) as { modifiers: { typeEff: number }; rolls: number[] };
    expect(blocked.modifiers.typeEff).toBe(0);
    expect(blocked.rolls.every((r) => r === 0)).toBe(true);
    const through = calculateDamage(input({
      move: earthquake,
      typeEfficacy: eff,
      attacker: { ...input({}).attacker, abilityId: 'mold-breaker' },
      defender: { ...input({}).defender, abilityId: 'levitate' },
    })) as { modifiers: { typeEff: number } };
    expect(through.modifiers.typeEff).toBe(1.0);
  });

  it('Wonder Guard: neutral → 0; SE → through; Mold Breaker → through', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const eff = identityEfficacy();
    eff[10][12] = 200; // Fire SE on Grass
    const neutral = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      defender: { ...input({}).defender, abilityId: 'wonder-guard' },
    })) as { modifiers: { typeEff: number } };
    expect(neutral.modifiers.typeEff).toBe(0);
    const se = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      defenderSpecies: { types: [12], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      defender: { ...input({}).defender, abilityId: 'wonder-guard' },
    })) as { modifiers: { typeEff: number } };
    expect(se.modifiers.typeEff).toBe(2.0);
    const bypass = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      attacker: { ...input({}).attacker, abilityId: 'mold-breaker' },
      defender: { ...input({}).defender, abilityId: 'wonder-guard' },
    })) as { modifiers: { typeEff: number } };
    expect(bypass.modifiers.typeEff).toBe(1.0);
  });

  it('Filter / Solid Rock reduce SE damage to 0.75', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const eff = identityEfficacy();
    eff[10][12] = 200;
    const out = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      defenderSpecies: { types: [12], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      defender: { ...input({}).defender, abilityId: 'filter' },
    })) as { modifiers: { typeEff: number } };
    expect(out.modifiers.typeEff).toBeCloseTo(1.5, 5);
  });

  it('Tinted Lens: 0.5 → 1.0; 0.25 → 0.5', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const eff = identityEfficacy();
    eff[10][11] = 50;
    const single = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      defenderSpecies: { types: [11], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'tinted-lens' },
    })) as { modifiers: { typeEff: number } };
    expect(single.modifiers.typeEff).toBeCloseTo(1.0, 5);
    const double = calculateDamage(input({
      move: fireMove,
      typeEfficacy: eff,
      defenderSpecies: { types: [11, 11], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'tinted-lens' },
    })) as { modifiers: { typeEff: number } };
    expect(double.modifiers.typeEff).toBeCloseTo(0.5, 5);
  });

  it('Thick Fat reduces Fire and Ice by 0.5', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const iceMove = { id: 58, name: 'ice-beam', names: { en: 'Ice Beam' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const fire = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, abilityId: 'thick-fat' },
    })) as { modifiers: { typeEff: number } };
    const ice = calculateDamage(input({
      move: iceMove,
      defender: { ...input({}).defender, abilityId: 'thick-fat' },
    })) as { modifiers: { typeEff: number } };
    expect(fire.modifiers.typeEff).toBe(0.5);
    expect(ice.modifiers.typeEff).toBe(0.5);
  });

  it('Heatproof reduces only Fire by 0.5 (not Ice)', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const iceMove = { id: 58, name: 'ice-beam', names: { en: 'Ice Beam' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const fire = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, abilityId: 'heatproof' },
    })) as { modifiers: { typeEff: number } };
    const ice = calculateDamage(input({
      move: iceMove,
      defender: { ...input({}).defender, abilityId: 'heatproof' },
    })) as { modifiers: { typeEff: number } };
    expect(fire.modifiers.typeEff).toBe(0.5);
    expect(ice.modifiers.typeEff).toBe(1.0);
  });

  it('Water Absorb: Water move → 0 damage', () => {
    const surf = { id: 57, name: 'surf', names: { en: 'Surf' }, type_ref: { id: 11, name: 'water', names: { en: 'Water' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      move: surf,
      defender: { ...input({}).defender, abilityId: 'water-absorb' },
    })) as { modifiers: { typeEff: number } };
    expect(out.modifiers.typeEff).toBe(0);
  });

  it('Flash Fire: Fire move on defender → 0; Fire offense ×1.5', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const blocked = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, abilityId: 'flash-fire' },
    })) as { modifiers: { typeEff: number } };
    expect(blocked.modifiers.typeEff).toBe(0);
    const offBoost = calculateDamage(input({
      move: fireMove,
      attackerSpecies: { types: [10], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'flash-fire' },
    })) as { modifiers: { abilityAtk: number } };
    expect(offBoost.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Steelworker boosts Steel moves by 1.5', () => {
    const steelMove = { id: 442, name: 'iron-head', names: { en: 'Iron Head' }, type_ref: { id: 9, name: 'steel', names: { en: 'Steel' } }, power: 80, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact'] };
    const out = calculateDamage(input({
      move: steelMove,
      attacker: { ...input({}).attacker, abilityId: 'steelworker' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Water Bubble: ×2 on Water offense, ×0.5 on Fire defense', () => {
    const waterMove = { id: 57, name: 'surf', names: { en: 'Surf' }, type_ref: { id: 11, name: 'water', names: { en: 'Water' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const off = calculateDamage(input({
      move: waterMove,
      attacker: { ...input({}).attacker, abilityId: 'water-bubble' },
    })) as { modifiers: { abilityAtk: number } };
    expect(off.modifiers.abilityAtk).toBeCloseTo(2.0, 5);
    const def = calculateDamage(input({
      move: fireMove,
      defender: { ...input({}).defender, abilityId: 'water-bubble' },
    })) as { modifiers: { typeEff: number } };
    expect(def.modifiers.typeEff).toBe(0.5);
  });

  it('Choice Band + Huge Power: two successive floors on Atk', () => {
    const out = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'huge-power', itemId: 'choice-band' },
    })) as { attackerStat: number };
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const expected = Math.floor(Math.floor(baseline.attackerStat * 2) * 1.5);
    expect(out.attackerStat).toBe(expected);
  });
});
