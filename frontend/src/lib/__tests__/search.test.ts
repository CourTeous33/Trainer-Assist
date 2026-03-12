import { describe, it, expect, vi } from 'vitest';
import { matchesSearch } from '../search';
import type { LocalizedNames } from '../types';

// Mock pinyin-pro to avoid loading the full dictionary in tests
vi.mock('pinyin-pro', () => ({
  pinyin: (zh: string, opts: { pattern?: string; toneType?: string; type?: string }) => {
    // Simple mock: return each char as-is for testing
    const chars = zh.split('');
    if (opts.pattern === 'first') return chars;
    return chars;
  },
}));

describe('matchesSearch', () => {
  const pikachu: LocalizedNames = {
    en: 'Pikachu',
    ja: 'ピカチュウ',
    zh: '皮卡丘',
    zh_pinyin: 'pikaqiu pkq',
  };

  const englishOnly: LocalizedNames = {
    en: 'Bulbasaur',
  };

  it('returns true for empty query', () => {
    expect(matchesSearch('', pikachu)).toBe(true);
  });

  it('matches English name (case-insensitive)', () => {
    expect(matchesSearch('pika', pikachu)).toBe(true);
    expect(matchesSearch('PIKACHU', pikachu)).toBe(true);
    expect(matchesSearch('Pikachu', pikachu)).toBe(true);
  });

  it('does not match unrelated query', () => {
    expect(matchesSearch('charizard', pikachu)).toBe(false);
  });

  it('matches Japanese name', () => {
    expect(matchesSearch('ピカ', pikachu)).toBe(true);
    expect(matchesSearch('チュウ', pikachu)).toBe(true);
  });

  it('matches Chinese name', () => {
    expect(matchesSearch('皮卡', pikachu)).toBe(true);
    expect(matchesSearch('卡丘', pikachu)).toBe(true);
  });

  it('matches full pinyin (pre-computed)', () => {
    expect(matchesSearch('pikaqiu', pikachu)).toBe(true);
  });

  it('matches pinyin initials (pre-computed)', () => {
    expect(matchesSearch('pkq', pikachu)).toBe(true);
  });

  it('works with English-only names', () => {
    expect(matchesSearch('bulba', englishOnly)).toBe(true);
    expect(matchesSearch('saur', englishOnly)).toBe(true);
    expect(matchesSearch('pika', englishOnly)).toBe(false);
  });

  it('does not match when ja/zh are undefined', () => {
    expect(matchesSearch('ピカ', englishOnly)).toBe(false);
    expect(matchesSearch('皮卡', englishOnly)).toBe(false);
  });

  it('falls back to client-side pinyin when zh_pinyin is not set', () => {
    const withoutPinyin: LocalizedNames = {
      en: 'Pikachu',
      zh: '皮卡丘',
      // no zh_pinyin — should use client-side mock
    };
    // With our mock, clientPinyin returns "皮卡丘 皮卡丘"
    // so searching for the Chinese chars still works
    expect(matchesSearch('皮卡', withoutPinyin)).toBe(true);
  });

  it('handles partial substring matches', () => {
    expect(matchesSearch('ka', pikachu)).toBe(true); // "piKAchu"
    expect(matchesSearch('chu', pikachu)).toBe(true); // "pikaCHU"
  });
});
