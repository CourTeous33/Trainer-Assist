import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, defaultCalcState, type CalcState } from '../url';

describe('url serialization', () => {
  it('roundtrips a default state', () => {
    const s = defaultCalcState();
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('roundtrips a fully specified traditional state', () => {
    const base = defaultCalcState();
    const s: CalcState = {
      ...base,
      attacker: {
        ...base.attacker,
        pokemonId: 445,
        evs: { hp: 0, attack: 252, defense: 0, special_attack: 0, special_defense: 4, speed: 252 },
        nature: 'adamant',
        itemId: 'choice-band',
        moveIds: [89, 232, 442, null],
      },
      defender: { ...base.defender, pokemonId: 376 },
    };
    expect(deserializeState(serializeState(s))).toEqual(s);
  });

  it('returns defaults on malformed base64', () => {
    expect(deserializeState('nonsense!@#')).toEqual(defaultCalcState());
  });

  it('clamps out-of-range numeric inputs on deserialize', () => {
    const bad = btoa(JSON.stringify({
      v: 1, m: 't',
      a: { p: 1, l: 9999,
        e: { hp: 9999, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 99, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null, mv: [null, null, null, null] },
      d: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null },
    }));
    const s = deserializeState(bad);
    expect(s.attacker.level).toBeLessThanOrEqual(100);
    expect(s.attacker.evs.hp).toBeLessThanOrEqual(252);
    expect(s.attacker.ivs.hp).toBeLessThanOrEqual(31);
  });

  it('enforces Champion invariants on load', () => {
    const champ = btoa(JSON.stringify({
      v: 1, m: 'c',
      a: { p: 1, l: 75,
        e: { hp: 100, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 0, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null, mv: [null, null, null, null] },
      d: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null },
    }));
    const s = deserializeState(champ);
    expect(s.evMode).toBe('champion');
    expect(s.attacker.level).toBe(50);
    expect(s.attacker.ivs.hp).toBe(31);
    expect(s.attacker.evs.hp).toBeLessThanOrEqual(32);
    const total =
      s.attacker.evs.hp + s.attacker.evs.attack + s.attacker.evs.defense +
      s.attacker.evs.special_attack + s.attacker.evs.special_defense + s.attacker.evs.speed;
    expect(total).toBeLessThanOrEqual(66);
  });

  it('serialized output contains v=1', () => {
    const blob = serializeState(defaultCalcState());
    const json = JSON.parse(atob(blob));
    expect(json.v).toBe(1);
  });
});
