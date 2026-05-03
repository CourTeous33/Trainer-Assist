import { describe, it, expect } from 'vitest';
import { hasMoveFlag } from '../move-flags';
import type { MoveSummary } from '@/lib/types';

function moveWith(flags: string[]): MoveSummary {
  return {
    id: 1, name: 'x',
    names: { en: 'X' },
    type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } },
    power: 50, accuracy: 100, pp: 10, damage_class: 'physical', flags,
  };
}

describe('hasMoveFlag', () => {
  it('returns true when flag is present', () => {
    expect(hasMoveFlag(moveWith(['contact', 'punch']), 'punch')).toBe(true);
  });
  it('returns false when flag is absent', () => {
    expect(hasMoveFlag(moveWith(['contact']), 'punch')).toBe(false);
  });
  it('returns false when flags array is empty', () => {
    expect(hasMoveFlag(moveWith([]), 'sound')).toBe(false);
  });
});
