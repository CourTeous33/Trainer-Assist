import { describe, it, expect } from 'vitest';
import { ABILITIES, getAbility } from '../abilities';

describe('ABILITIES', () => {
  it('contains the 36 Bundle A abilities', () => {
    const ids = new Set(ABILITIES.map((a) => a.id));
    const expected = [
      'adaptability', 'huge-power', 'pure-power', 'hustle',
      'tough-claws', 'iron-fist', 'strong-jaw', 'mega-launcher', 'sharpness',
      'reckless', 'punk-rock', 'technician',
      'aerilate', 'pixilate', 'refrigerate', 'galvanize',
      'steelworker', 'water-bubble', 'flash-fire',
      'levitate', 'sap-sipper', 'water-absorb', 'volt-absorb',
      'lightning-rod', 'storm-drain', 'motor-drive',
      'thick-fat', 'heatproof',
      'filter', 'solid-rock', 'prism-armor', 'tinted-lens', 'wonder-guard',
      'mold-breaker', 'teravolt', 'turboblaze',
    ];
    for (const id of expected) {
      expect(ids.has(id), `missing ability: ${id}`).toBe(true);
    }
    expect(ABILITIES.length).toBe(36);
  });

  it('every entry has en/ja/zh names', () => {
    for (const a of ABILITIES) {
      expect(a.names.en, `${a.id}.en`).toBeTruthy();
      expect(a.names.ja, `${a.id}.ja`).toBeTruthy();
      expect(a.names.zh, `${a.id}.zh`).toBeTruthy();
    }
  });

  it('getAbility returns undefined for null / unknown', () => {
    expect(getAbility(null)).toBeUndefined();
    expect(getAbility(undefined)).toBeUndefined();
    expect(getAbility('not-a-real-ability')).toBeUndefined();
  });

  it('getAbility returns the entry for a known id', () => {
    expect(getAbility('adaptability')?.stabFactor).toBe(2.0);
    expect(getAbility('huge-power')?.flatAtkMult).toEqual({ stat: 'attack', factor: 2.0 });
    expect(getAbility('mold-breaker')?.ignoresDefenderAbility).toBe(true);
  });

  it('Water Bubble has both offense type boost and defense type reduction', () => {
    const wb = getAbility('water-bubble')!;
    expect(wb.offenseTypeBoost).toEqual({ typeId: 11, factor: 2.0 });
    expect(wb.typeReduction).toEqual([{ typeId: 10, factor: 0.5 }]);
  });

  it('Punk Rock has conditionalDmgMult on sound and soundReduction', () => {
    const pr = getAbility('punk-rock')!;
    expect(pr.conditionalDmgMult).toEqual({ kind: 'flag', flag: 'sound', factor: 1.3 });
    expect(pr.soundReduction).toBe(0.5);
  });

  it('Flash Fire has Fire immunity and Fire offense boost', () => {
    const ff = getAbility('flash-fire')!;
    expect(ff.typeImmunity).toBe(10);
    expect(ff.offenseTypeBoost).toEqual({ typeId: 10, factor: 1.5 });
  });

  it('Thick Fat reduces both Fire and Ice', () => {
    const tf = getAbility('thick-fat')!;
    expect(tf.typeReduction).toEqual([{ typeId: 10, factor: 0.5 }, { typeId: 15, factor: 0.5 }]);
  });
});
