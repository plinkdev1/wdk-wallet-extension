// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WalletSettingsView } from './index.js';

describe('WalletSettingsView', () => {
  it('renders the Wallet title', () => {
    render(<WalletSettingsView onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /wallet/i, level: 1 })).toBeInTheDocument();
  });

  it('renders all four placeholder sections', () => {
    render(<WalletSettingsView onBack={vi.fn()} />);
    expect(screen.getByTestId('wallet-section-account')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-section-security')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-section-network')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-section-advanced')).toBeInTheDocument();
  });

  it('shows the phase tag inside each section header', () => {
    render(<WalletSettingsView onBack={vi.fn()} />);
    // B1c: 2x B0c remaining (Network became real in B1b, Security in B1c)
    const comingTags = screen.getAllByText(/coming in/i);
    expect(comingTags.length).toBe(2); // B1c: Security is live, only Account+Advanced remain placeholders // B1b: Network is live, only 3 placeholders remain (Account/Security/Advanced)
  });

  it('back button fires onBack', () => {
    const onBack = vi.fn();
    render(<WalletSettingsView onBack={onBack} />);
    fireEvent.click(screen.getByTestId('wallet-settings-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('B1b: Network section renders the ChainSelector', () => {
    render(<WalletSettingsView onBack={() => {}} />);
    expect(screen.getByTestId('wallet-network-selector-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('chain-selector-trigger')).toBeInTheDocument();
  });

  it('B1c: Security section renders the AutoLockSelector', () => {
    render(<WalletSettingsView onBack={() => {}} />);
    expect(screen.getByTestId('wallet-security-autolock-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('auto-lock-selector')).toBeInTheDocument();
  });
});