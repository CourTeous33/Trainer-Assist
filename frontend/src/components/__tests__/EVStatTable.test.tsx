import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n/context';
import EVStatTable from '../EVStatTable';
import type { ComponentProps } from 'react';

function setup(props: Partial<ComponentProps<typeof EVStatTable>> = {}) {
  const onChange = vi.fn();
  const defaultProps: ComponentProps<typeof EVStatTable> = {
    mode: 'traditional',
    base: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 },
    ivs: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
    evs: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
    nature: 'hardy',
    level: 50,
    onIVsChange: onChange,
    onEVsChange: onChange,
    onLevelChange: onChange,
    ...props,
  };
  render(<LocaleProvider><EVStatTable {...defaultProps} /></LocaleProvider>);
  return { onChange };
}

describe('EVStatTable', () => {
  it('renders 6 stat rows', () => {
    setup();
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(12);
  });

  it('highlights total counter red when EVs exceed cap', () => {
    setup({ evs: { hp: 252, attack: 252, defense: 252, special_attack: 0, special_defense: 0, speed: 0 } });
    const counter = screen.getByText(/EV total/i);
    expect(counter.className).toMatch(/text-red|border-red/);
  });

  it('locks IV inputs in Champion mode', () => {
    setup({ mode: 'champion' });
    const ivInputs = screen.getAllByLabelText(/^IV /i);
    for (const inp of ivInputs) {
      expect(inp).toBeDisabled();
    }
  });

  it('locks level input in Champion mode', () => {
    setup({ mode: 'champion' });
    const lvl = screen.getByLabelText(/level/i);
    expect(lvl).toBeDisabled();
  });
});
