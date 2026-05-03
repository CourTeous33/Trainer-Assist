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
];

describe('AbilityDropdown', () => {
  it('renders a "no ability" leading option and the full roster', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={[]} />);
    expect(screen.getByRole('option', { name: 'No ability' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Adaptability' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Mold Breaker' })).toBeTruthy();
  });

  it('shows the "This Pokémon" group when the species has roster-known abilities', () => {
    const { container } = wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={sampleSpeciesAbilities} />);
    expect(container.querySelector('optgroup[label="This Pokémon"]')).not.toBeNull();
  });

  it('hides the "This Pokémon" group when no species ability is in the roster', () => {
    const { container } = wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={[
      { name: 'unknown-1', names: { en: 'Unknown 1' }, description: { en: '' }, is_hidden: false },
    ]} />);
    expect(container.querySelector('optgroup[label="This Pokémon"]')).toBeNull();
  });

  it('fires onChange(null) when "No ability" is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={'tough-claws'} onChange={onChange} speciesAbilities={[]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('fires onChange(id) when a roster entry is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={null} onChange={onChange} speciesAbilities={[]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'levitate' } });
    expect(onChange).toHaveBeenCalledWith('levitate');
  });
});
