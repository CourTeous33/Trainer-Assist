import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n';
import AbilityDropdown from '../AbilityDropdown';
import type { AbilityInfo } from '@/lib/types';

function wrap(node: React.ReactNode) {
  return render(<LocaleProvider>{node}</LocaleProvider>);
}

const sampleSpeciesAbilities: AbilityInfo[] = [
  { name: 'tough-claws',  names: { en: 'Tough Claws' },  description: { en: '' }, is_hidden: false },
  { name: 'unknown-thing', names: { en: 'Unknown Thing' }, description: { en: '' }, is_hidden: false },
  { name: 'levitate',     names: { en: 'Levitate' },     description: { en: '' }, is_hidden: true },
];

describe('AbilityDropdown', () => {
  it('renders only the species abilities plus a leading "no ability" option', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={sampleSpeciesAbilities} />);
    expect(screen.getByRole('option', { name: 'No ability' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Tough Claws' })).toBeTruthy();
    // An out-of-species roster entry like Adaptability must NOT appear.
    expect(screen.queryByRole('option', { name: 'Adaptability' })).toBeNull();
  });

  it('marks abilities outside the Bundle-A roster as "(No effect)"', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={sampleSpeciesAbilities} />);
    expect(screen.getByRole('option', { name: 'Unknown Thing (No effect)' })).toBeTruthy();
  });

  it('marks the hidden ability with a "(Hidden)" suffix', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={sampleSpeciesAbilities} />);
    // Levitate is in the roster but is_hidden=true.
    expect(screen.getByRole('option', { name: 'Levitate (Hidden)' })).toBeTruthy();
  });

  it('shows only the leading "no ability" option when species has no abilities', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={[]} />);
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(1);
    expect(opts[0].textContent).toBe('No ability');
  });

  it('fires onChange(null) when "No ability" is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={'tough-claws'} onChange={onChange} speciesAbilities={sampleSpeciesAbilities} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('fires onChange(id) when a species ability is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={null} onChange={onChange} speciesAbilities={sampleSpeciesAbilities} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tough-claws' } });
    expect(onChange).toHaveBeenCalledWith('tough-claws');
  });
});
