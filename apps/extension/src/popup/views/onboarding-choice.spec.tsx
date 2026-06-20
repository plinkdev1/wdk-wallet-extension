/**
 * @vitest-environment jsdom
 *
 * OnboardingChoice (B5.4.3) spec. Mocks wdk-ui's Button so tests focus on
 * the component's callback wiring + label correctness, not on Button's
 * internals (those have their own spec in wdk-ui).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingChoice } from './onboarding-choice.js';

vi.mock('@wdk-starter/wdk-ui', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  LogoMark: ({ alt }: { alt?: string }) => <span data-testid="mock-logo">{alt ?? 'logo'}</span>,
  useBrand: () => ({ name: 'WDK', wordmarkSrc: '/wdk-wordmark.svg', wordmarkAlt: 'WDK', markSrc: '/wdk-mark.png', markAlt: 'WDK Wallet' }),
}));

describe('OnboardingChoice (B5.4.3)', () => {
  it('renders the welcome heading', () => {
    render(<OnboardingChoice onCreateNew={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/welcome/i);
  });

  it('renders the create button with descriptive label', () => {
    render(<OnboardingChoice onCreateNew={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /create a new wallet/i })).toBeInTheDocument();
  });

  it('renders the import button with descriptive label', () => {
    render(<OnboardingChoice onCreateNew={vi.fn()} onImport={vi.fn()} />);
    expect(screen.getByRole('button', { name: /recovery phrase/i })).toBeInTheDocument();
  });

  it('calls onCreateNew (and not onImport) when create button is clicked', () => {
    const onCreateNew = vi.fn();
    const onImport = vi.fn();
    render(<OnboardingChoice onCreateNew={onCreateNew} onImport={onImport} />);
    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('calls onImport (and not onCreateNew) when import button is clicked', () => {
    const onCreateNew = vi.fn();
    const onImport = vi.fn();
    render(<OnboardingChoice onCreateNew={onCreateNew} onImport={onImport} />);
    fireEvent.click(screen.getByRole('button', { name: /recovery phrase/i }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onCreateNew).not.toHaveBeenCalled();
  });

  it('does not call either callback on initial render', () => {
    const onCreateNew = vi.fn();
    const onImport = vi.fn();
    render(<OnboardingChoice onCreateNew={onCreateNew} onImport={onImport} />);
    expect(onCreateNew).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });
});