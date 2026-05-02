import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import PokemonPicker from '../PokemonPicker';
import type { TypeRef } from '@/lib/types';

const getPokemonList = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ getPokemonList }));

const TYPES: TypeRef[] = [
  { id: 9, name: 'steel', names: { en: 'Steel' } },
  { id: 17, name: 'dark', names: { en: 'Dark' } },
  { id: 16, name: 'dragon', names: { en: 'Dragon' } },
];

beforeEach(() => {
  getPokemonList.mockReset();
  getPokemonList.mockResolvedValue({ items: [], total: 0 });
});

describe('PokemonPicker', () => {
  it('passes both type and type2 when two types are selected', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await userEvent.click(screen.getByRole('button', { name: /Steel/i }));
    await waitFor(() => {
      expect(getPokemonList).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dark', type2: 'steel' }),
      );
    });
  });

  it('rotates out the oldest type when a third is added', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    await userEvent.click(screen.getByRole('button', { name: /Steel/i }));
    await userEvent.click(screen.getByRole('button', { name: /Dragon/i }));
    await waitFor(() => {
      const last = getPokemonList.mock.calls[getPokemonList.mock.calls.length - 1][0];
      // After rotation: Steel (kept) + Dragon (new). Dark was rotated out.
      expect(last.type).toBe('steel');
      expect(last.type2).toBe('dragon');
    });
  });

  it('clicking an already-selected type clears it', async () => {
    render(<LocaleProvider><PokemonPicker allTypes={TYPES} onSelect={() => {}} /></LocaleProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    // Wait for the first fetch to fire (type=dark selected).
    await waitFor(() => {
      expect(getPokemonList).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dark' }),
      );
    });
    const callsBefore = getPokemonList.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: /Dark/i }));
    // After deselect, active becomes false; no new fetch should fire.
    // We wait a tick then verify no additional calls were made.
    await waitFor(() => {
      expect(getPokemonList.mock.calls.length).toBe(callsBefore);
    });
  });
});
