import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatBar from '../StatBar';

describe('StatBar', () => {
  it('renders label and value', () => {
    render(<StatBar label="HP" value={45} />);
    expect(screen.getByText('HP')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('calculates correct bar width percentage', () => {
    const { container } = render(<StatBar label="HP" value={100} maxValue={200} />);
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 50%');
  });

  it('caps width at 100%', () => {
    const { container } = render(<StatBar label="HP" value={300} maxValue={255} />);
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 100%');
  });

  it('uses default maxValue of 255', () => {
    const { container } = render(<StatBar label="Attack" value={255} />);
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('width: 100%');
  });

  it('uses custom color when provided', () => {
    const { container } = render(<StatBar label="HP" value={50} color="#FF0000" />);
    const bar = container.querySelector('[style]');
    expect(bar?.getAttribute('style')).toContain('background-color: #FF0000');
  });
});
