import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import MovePicker from '../MovePicker';
import type { MoveSummary, TypeRef } from '@/lib/types';

const TYPES: TypeRef[] = [
  { id: 1, name: 'normal', names: { en: 'Normal' } },
  { id: 10, name: 'fire', names: { en: 'Fire' } },
];

const MOVES: MoveSummary[] = [
  { id: 1, name: 'tackle', names: { en: 'Tackle' }, type_ref: TYPES[0], power: 40, accuracy: 100, pp: 35, damage_class: 'physical', flags: [] },
  { id: 2, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: TYPES[1], power: 90, accuracy: 100, pp: 15, damage_class: 'special', flags: [] },
  { id: 3, name: 'growl', names: { en: 'Growl' }, type_ref: TYPES[0], power: null, accuracy: 100, pp: 40, damage_class: 'status', flags: [] },
];

describe('MovePicker', () => {
  it('shows all attacker moves when no filter active', () => {
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={() => {}} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    expect(screen.getByText('Tackle')).toBeInTheDocument();
    expect(screen.getByText('Flamethrower')).toBeInTheDocument();
    expect(screen.getByText('Growl')).toBeInTheDocument();
  });

  it('damage-class filter narrows the list', async () => {
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={() => {}} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^physical$/i }));
    expect(screen.getByText('Tackle')).toBeInTheDocument();
    expect(screen.queryByText('Flamethrower')).not.toBeInTheDocument();
    expect(screen.queryByText('Growl')).not.toBeInTheDocument();
  });

  it('calls onPick when a move is clicked', async () => {
    const onPick = vi.fn();
    render(
      <LocaleProvider>
        <MovePicker open={true} onClose={() => {}} onPick={onPick} attackerMoves={MOVES} allTypes={TYPES} />
      </LocaleProvider>,
    );
    await userEvent.click(screen.getByText('Tackle'));
    expect(onPick).toHaveBeenCalledWith(MOVES[0]);
  });
});
