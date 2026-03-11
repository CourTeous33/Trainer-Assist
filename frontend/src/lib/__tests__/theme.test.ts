import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { createElement } from 'react';
import { ThemeProvider, useTheme } from '../theme/context';

// Helper component that exposes theme context values
function ThemeConsumer() {
  const { theme, setTheme, resolved } = useTheme();
  return createElement('div', null,
    createElement('span', { 'data-testid': 'theme' }, theme),
    createElement('span', { 'data-testid': 'resolved' }, resolved),
    createElement('button', { 'data-testid': 'set-light', onClick: () => setTheme('light') }),
    createElement('button', { 'data-testid': 'set-dark', onClick: () => setTheme('dark') }),
  );
}

function renderWithProvider() {
  return render(
    createElement(ThemeProvider, null, createElement(ThemeConsumer)),
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    // Default matchMedia to light
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('defaults to system theme', () => {
    renderWithProvider();
    expect(screen.getByTestId('theme').textContent).toBe('system');
  });

  it('setTheme updates the theme and saves to localStorage', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByTestId('set-dark').click();
    });

    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(localStorage.getItem('trainer-assist-theme')).toBe('dark');
  });

  it('reads saved theme from localStorage on mount', async () => {
    localStorage.setItem('trainer-assist-theme', 'light');

    await act(async () => {
      renderWithProvider();
    });

    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('resolved theme is light when system prefers light', async () => {
    await act(async () => {
      renderWithProvider();
    });

    // system theme with matchMedia returning false (light)
    expect(screen.getByTestId('resolved').textContent).toBe('light');
  });

  it('resolved theme is dark when theme is set to dark', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByTestId('set-dark').click();
    });

    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });

  it('resolved theme is light when theme is set to light', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByTestId('set-light').click();
    });

    expect(screen.getByTestId('resolved').textContent).toBe('light');
  });

  it('resolved theme is dark when system prefers dark', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await act(async () => {
      renderWithProvider();
    });

    expect(screen.getByTestId('resolved').textContent).toBe('dark');
  });
});
