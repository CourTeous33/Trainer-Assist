import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/lib/i18n/context';
import EVModeToggle from '../EVModeToggle';
import type { ReactNode } from 'react';

function withLocale(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe('EVModeToggle', () => {
  it('renders both options and marks current as selected', () => {
    render(withLocale(<EVModeToggle mode="traditional" onChange={() => {}} />));
    const trad = screen.getByRole('button', { name: /traditional/i });
    expect(trad).toHaveAttribute('aria-pressed', 'true');
    const champ = screen.getByRole('button', { name: /champion/i });
    expect(champ).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange when other option clicked', async () => {
    const onChange = vi.fn();
    render(withLocale(<EVModeToggle mode="traditional" onChange={onChange} />));
    await userEvent.click(screen.getByRole('button', { name: /champion/i }));
    expect(onChange).toHaveBeenCalledWith('champion');
  });
});
