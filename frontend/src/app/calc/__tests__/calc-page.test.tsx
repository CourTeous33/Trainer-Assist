import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import CalcPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  getTypes: vi.fn(async () => [
    { id: 1, name: 'normal', names: { en: 'Normal' } },
    { id: 5, name: 'ground', names: { en: 'Ground' } },
    { id: 16, name: 'dragon', names: { en: 'Dragon' } },
  ]),
  getTypeEfficacy: vi.fn(async () => []),
  getMoves: vi.fn(async () => [
    { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical', flags: [] },
  ]),
  getPokemon: vi.fn(async (id: number) => ({
    id, species_id: id, name: `mon-${id}`, names: { en: `Mon ${id}` }, species_names: { en: `Mon ${id}` },
    types: [{ id: 16, name: 'dragon', names: { en: 'Dragon' } }, { id: 5, name: 'ground', names: { en: 'Ground' } }],
    sprite_url: '/test.png', stats: { hp: 108, attack: 130, defense: 95, special_attack: 80, special_defense: 85, speed: 102 },
    // 'overgrow' is not in the Bundle-A roster, so it auto-binds as a no-op default.
    abilities: [
      { name: 'overgrow', names: { en: 'Overgrow' }, description: { en: '' }, is_hidden: false },
      { name: 'mold-breaker', names: { en: 'Mold Breaker' }, description: { en: '' }, is_hidden: false },
      { name: 'levitate', names: { en: 'Levitate' }, description: { en: '' }, is_hidden: true },
    ],
    moves: [{ id: 89, name: 'earthquake', names: { en: 'Earthquake' } }], height: 1, weight: 1, generation: 4,
  })),
  getPokemonList: vi.fn(async () => ({ items: [], total: 0 })),
}));

describe('CalcPage smoke', () => {
  it('renders default attacker/defender and shows a damage result after picking a move', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 94').length).toBeGreaterThan(0));
    await userEvent.click(screen.getAllByText(/tap to add/i)[0]);
    await userEvent.click(screen.getByText('Earthquake'));
    await waitFor(() => {
      expect(screen.getAllByText(/%/).length).toBeGreaterThan(0);
    });
  });

  it('clicking attacker Atk +1 changes the displayed damage', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 94').length).toBeGreaterThan(0));

    // Pick Earthquake into slot 1 so a result renders.
    await userEvent.click(screen.getAllByText(/tap to add/i)[0]);
    await userEvent.click(screen.getByText('Earthquake'));

    // Wait for the damage range line (format: "X.X% – Y.Y% (avg Z.Z%)").
    await waitFor(() => expect(screen.getAllByText(/^\d+(?:\.\d+)?%/).length).toBeGreaterThan(0));

    // Capture the damage range text before the stage change.
    const firstPctBefore = screen.getAllByText(/^\d+(?:\.\d+)?%/)[0].textContent;

    // Earthquake is physical → bump attacker's Atk stage by clicking the first "Atk +1" (attacker side).
    const plusBtns = screen.getAllByRole('button', { name: /Atk \+1/i });
    await userEvent.click(plusBtns[0]);

    await waitFor(() => {
      const firstPctAfter = screen.getAllByText(/^\d+(?:\.\d+)?%/)[0].textContent;
      expect(firstPctAfter).not.toBe(firstPctBefore);
    });
  });

  it('Mold Breaker on attacker neutralizes Levitate on defender', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 94').length).toBeGreaterThan(0));

    await userEvent.click(screen.getAllByText(/tap to add/i)[0]);
    await userEvent.click(screen.getByText('Earthquake'));
    await waitFor(() => expect(screen.getAllByText(/^\d+(?:\.\d+)?%/).length).toBeGreaterThan(0));

    const abilityDropdowns = screen.getAllByLabelText('Ability') as HTMLSelectElement[];
    expect(abilityDropdowns).toHaveLength(2);
    const [attackerAbility, defenderAbility] = abilityDropdowns;

    await userEvent.selectOptions(defenderAbility, 'levitate');
    await waitFor(() => {
      const pcts = screen.getAllByText(/^\d+(?:\.\d+)?%/);
      const firstPct = pcts[0].textContent ?? '';
      expect(firstPct.startsWith('0')).toBe(true);
    });

    await userEvent.selectOptions(attackerAbility, 'mold-breaker');
    await waitFor(() => {
      const firstPct = screen.getAllByText(/^\d+(?:\.\d+)?%/)[0].textContent ?? '';
      expect(firstPct.startsWith('0')).toBe(false);
    });
  });
});
