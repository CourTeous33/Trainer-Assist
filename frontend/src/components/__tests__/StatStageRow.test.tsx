import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import StatStageRow from '../StatStageRow';
import type { StatStages } from '@/lib/calc';

const ZERO: StatStages = { attack: 0, defense: 0, special_attack: 0, special_defense: 0 };

function renderRow(props: { side?: 'attacker' | 'defender'; stages?: StatStages; onChange?: (stat: keyof StatStages, value: number) => void }) {
  const onChange = props.onChange ?? vi.fn();
  return {
    onChange,
    ...render(
      <LocaleProvider>
        <StatStageRow stages={props.stages ?? ZERO} onChange={onChange} />
      </LocaleProvider>,
    ),
  };
}

describe('StatStageRow', () => {
  it('attacker side renders all four stat steppers', () => {
    renderRow({ side: 'attacker' });
    for (const label of ['Atk', 'Def', 'SpA', 'SpD']) {
      expect(screen.getByRole('button', { name: new RegExp(`${label} \\+1`, 'i') })).toBeTruthy();
    }
  });

  it('defender side renders all four stat steppers', () => {
    renderRow({ side: 'defender' });
    for (const label of ['Atk', 'Def', 'SpA', 'SpD']) {
      expect(screen.getByRole('button', { name: new RegExp(`${label} \\+1`, 'i') })).toBeTruthy();
    }
  });

  it('+ button calls onChange with value+1', async () => {
    const onChange = vi.fn();
    renderRow({ side: 'attacker', stages: { ...ZERO, attack: 2 }, onChange });
    await userEvent.click(screen.getByRole('button', { name: 'Atk +1' }));
    expect(onChange).toHaveBeenCalledWith('attack', 3);
  });

  it('− button calls onChange with value-1', async () => {
    const onChange = vi.fn();
    renderRow({ side: 'attacker', stages: { ...ZERO, attack: 2 }, onChange });
    await userEvent.click(screen.getByRole('button', { name: 'Atk -1' }));
    expect(onChange).toHaveBeenCalledWith('attack', 1);
  });

  it('reset button calls onChange with 0', async () => {
    const onChange = vi.fn();
    renderRow({ side: 'attacker', stages: { ...ZERO, attack: 3 }, onChange });
    await userEvent.click(screen.getByRole('button', { name: 'Atk Reset' }));
    expect(onChange).toHaveBeenCalledWith('attack', 0);
  });

  it('+ button is disabled at +6', () => {
    renderRow({ side: 'attacker', stages: { ...ZERO, attack: 6 } });
    expect(screen.getByRole('button', { name: 'Atk +1' })).toBeDisabled();
  });

  it('− button is disabled at -6', () => {
    renderRow({ side: 'attacker', stages: { ...ZERO, attack: -6 } });
    expect(screen.getByRole('button', { name: 'Atk -1' })).toBeDisabled();
  });

  it('displays signed value correctly for positive, zero, and negative stages', () => {
    const { rerender } = render(
      <LocaleProvider>
        <StatStageRow stages={{ ...ZERO, attack: 2 }} onChange={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole('button', { name: 'Atk Reset' })).toHaveTextContent('+2');

    rerender(
      <LocaleProvider>
        <StatStageRow stages={{ ...ZERO, attack: 0 }} onChange={vi.fn()} />
      </LocaleProvider>,
    );
    expect(screen.getByRole('button', { name: 'Atk Reset' })).toHaveTextContent('0');

    rerender(
      <LocaleProvider>
        <StatStageRow stages={{ ...ZERO, attack: -3 }} onChange={vi.fn()} />
      </LocaleProvider>,
    );
    // Component uses Unicode minus U+2212 (−) for negative values
    expect(screen.getByRole('button', { name: 'Atk Reset' })).toHaveTextContent('−3');
  });
});
