import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import DamageResultCard from '../DamageResultCard';
import type { MoveSummary } from '@/lib/types';

const MOVE: MoveSummary = {
  id: 1, name: 'tackle', names: { en: 'Tackle' },
  type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } },
  power: 40, accuracy: 100, pp: 35, damage_class: 'physical',
};

describe('DamageResultCard', () => {
  it('renders empty state when no move', () => {
    render(<LocaleProvider><DamageResultCard move={null} result={null} /></LocaleProvider>);
    expect(screen.getByText(/pick a move/i)).toBeInTheDocument();
  });

  it('renders min/max/avg and KO numbers from CalcResult', () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{
            rolls: Array(16).fill(50),
            defenderHp: 100,
            minPct: 50, maxPct: 50, avgPct: 50,
            ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100,
            qualifier: 'guaranteed 2HKO',
            modifiers: { stab: 1.5, typeEff: 1.0, item: 1.0 },
            attackerStat: 100, defenderStat: 100,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/50.*%/)).toBeInTheDocument();
    expect(screen.getByText(/guaranteed 2HKO/i)).toBeInTheDocument();
  });

  it('toggles details panel', async () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{
            rolls: Array.from({ length: 16 }, (_, i) => 40 + i),
            defenderHp: 100,
            minPct: 40, maxPct: 55, avgPct: 47,
            ohkoPct: 0, twoHkoPct: 100, threeHkoPct: 100,
            qualifier: 'guaranteed 2HKO',
            modifiers: { stab: 1.5, typeEff: 1.0, item: 1.0 },
            attackerStat: 100, defenderStat: 100,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.queryByText(/^Rolls:/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show details/i }));
    expect(screen.getByText(/^Rolls:/i)).toBeInTheDocument();
  });

  it('renders unsupported message for unsupported moves', () => {
    render(
      <LocaleProvider>
        <DamageResultCard
          move={MOVE}
          result={{ unsupportedReason: 'fixed-damage' }}
        />
      </LocaleProvider>,
    );
    expect(screen.getByText(/fixed-damage/i)).toBeInTheDocument();
  });
});
