import { describe, it, expect } from 'vitest';
import { localizedName } from '../i18n';
import type { LocalizedNames } from '../types';

describe('localizedName', () => {
  const names: LocalizedNames = {
    en: 'Pikachu',
    ja: 'ピカチュウ',
    zh: '皮卡丘',
  };

  it('returns English name for en locale', () => {
    expect(localizedName(names, 'en')).toBe('Pikachu');
  });

  it('returns Japanese name for ja locale', () => {
    expect(localizedName(names, 'ja')).toBe('ピカチュウ');
  });

  it('returns Chinese name for zh locale', () => {
    expect(localizedName(names, 'zh')).toBe('皮卡丘');
  });

  it('falls back to English for unknown locale', () => {
    expect(localizedName(names, 'fr')).toBe('Pikachu');
  });

  it('falls back to English when ja is undefined', () => {
    const partial: LocalizedNames = { en: 'Bulbasaur' };
    expect(localizedName(partial, 'ja')).toBe('Bulbasaur');
  });

  it('falls back to English when zh is undefined', () => {
    const partial: LocalizedNames = { en: 'Charmander' };
    expect(localizedName(partial, 'zh')).toBe('Charmander');
  });

  it('returns empty string for undefined names', () => {
    expect(localizedName(undefined, 'en')).toBe('');
  });
});
