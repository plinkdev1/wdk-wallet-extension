// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UnlockedRouter } from './unlocked-router.js';

vi.mock('./main-view.js', () => ({
  MainView: (props: { onLockRequested: () => void; onOpenSettings: () => void }): JSX.Element => (
    <div data-testid="main-view-mock">
      <button data-testid="mock-lock-trigger" onClick={props.onLockRequested}>lock</button>
      <button data-testid="mock-open-settings-trigger" onClick={props.onOpenSettings}>open settings</button>
    </div>
  ),
}));

vi.mock('./wallet-settings/index.js', () => ({
  WalletSettingsView: (props: { onBack: () => void }): JSX.Element => (
    <div data-testid="wallet-settings-mock">
      <button data-testid="mock-back-trigger" onClick={props.onBack}>back</button>
    </div>
  ),
}));

describe('UnlockedRouter', () => {
  it('renders MainView by default', () => {
    render(<UnlockedRouter onLockRequested={vi.fn()} />);
    expect(screen.getByTestId('main-view-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('wallet-settings-mock')).toBeNull();
  });

  it('transitions to WalletSettingsView when MainView gear is clicked', () => {
    render(<UnlockedRouter onLockRequested={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mock-open-settings-trigger'));
    expect(screen.getByTestId('wallet-settings-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('main-view-mock')).toBeNull();
  });

  it('back from WalletSettingsView returns to MainView', () => {
    render(<UnlockedRouter onLockRequested={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mock-open-settings-trigger'));
    fireEvent.click(screen.getByTestId('mock-back-trigger'));
    expect(screen.getByTestId('main-view-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('wallet-settings-mock')).toBeNull();
  });

  it('forwards onLockRequested to MainView', () => {
    const onLock = vi.fn();
    render(<UnlockedRouter onLockRequested={onLock} />);
    fireEvent.click(screen.getByTestId('mock-lock-trigger'));
    expect(onLock).toHaveBeenCalledTimes(1);
  });
});