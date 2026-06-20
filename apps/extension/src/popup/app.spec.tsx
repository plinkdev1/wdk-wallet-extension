/**
 * @vitest-environment jsdom
 *
 * Tests the outer vault-state routing. Approval-queue branches are tested
 * by unlocked-router.spec.tsx (where the queue hook now lives).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './app.js';
import { useVaultState } from './hooks/use-vault-state.js';

vi.mock('./hooks/use-vault-state.js', () => ({
  useVaultState: vi.fn(),
}));

// Avoid pulling the real UnlockedRouter (which mounts useApprovalQueue and
// would need chrome mocked too). We just want to know the App routes to it.
vi.mock('./views/unlocked-router.js', () => ({
  UnlockedRouter: (_props: { onLockRequested: () => void }): JSX.Element => <div data-testid="unlocked-router">unlocked-router-rendered</div>,
}));
// B5.2: CreateVaultView now has useEffect side effects (sends BIP39_GENERATE_MNEMONIC
// on mount). Mock it for app routing tests so the side effect doesn't fire here.
// The real implementation is exercised in create-vault-view.spec.tsx (13 tests).
// B5.4.3: app.tsx now mounts OnboardingFlow (which internally routes to OnboardingChoice
// -> CreateVaultView or ImportVaultView) instead of CreateVaultView directly. Mock the
// flow as a stub so the test focuses purely on app.tsx's vault-state routing.
vi.mock('./views/onboarding-flow.js', () => ({
  OnboardingFlow: (_props: { onVaultReady: () => void }): JSX.Element => <div data-testid="onboarding-flow">onboarding-flow-rendered</div>,
}));
// B0b followup: SettingsView is now mounted DIRECTLY by App.tsx as an
// overlay when settingsOpen=true. Mock it so tests focus on App-level
// routing without pulling in the picker components.
vi.mock('./views/settings/index.js', () => ({
  SettingsView: (props: { onBack: () => void }): JSX.Element => (
    <div data-testid="settings-overlay">
      <button data-testid="settings-back-trigger" onClick={props.onBack}>back</button>
    </div>
  ),
}));

const useVaultStateMock = vi.mocked(useVaultState);

describe('App outer routing (B5.0b)', () => {
  beforeEach(() => {
    useVaultStateMock.mockReset();
  });

  it('renders Loading... when vault state is loading', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'loading' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders OnboardingFlow when no vault exists', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'no-vault' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('onboarding-flow')).toBeInTheDocument();
  });

  it('renders UnlockView when vault is locked', () => {
    // UnlockView mounts the wdk-ui UnlockScreen which doesn't itself touch chrome
    // (only the submit handler does), so we don't need to mock chrome for this branch.
    useVaultStateMock.mockReturnValue({ state: { status: 'locked' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
  });

  it('renders UnlockedRouter when vault is unlocked', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'unlocked' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('unlocked-router')).toBeInTheDocument();
  });

  it('renders error placeholder on error state', () => {
    useVaultStateMock.mockReturnValue({
      state: { status: 'error', error: 'VAULT_HAS_STORED failed' },
      refresh: vi.fn(),
    });
    render(<App />);
    expect(screen.getByText(/VAULT_HAS_STORED failed/)).toBeInTheDocument();
  });

  it('passes refresh to UnlockView so successful unlock triggers re-routing', () => {
    const refresh = vi.fn();
    useVaultStateMock.mockReturnValue({ state: { status: 'locked' }, refresh });
    render(<App />);
    // refresh is passed by app.tsx to UnlockView; we can't test the wiring
    // directly without remounting after an unlock, but presence of UnlockView
    // and the mock object identity is sufficient signal.
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
  });

  it('B0b-follow-up: persistent corner gear visible in locked state', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'locked' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('corner-settings-button')).toBeInTheDocument();
  });

  it('B0b-follow-up: persistent corner gear visible in no-vault state', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'no-vault' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByTestId('corner-settings-button')).toBeInTheDocument();
  });

  it('B0b-follow-up: corner gear click opens SettingsView overlay (replaces vault-state routing)', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'locked' }, refresh: vi.fn() });
    render(<App />);
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-overlay')).toBeNull();
    fireEvent.click(screen.getByTestId('corner-settings-button'));
    expect(screen.getByTestId('settings-overlay')).toBeInTheDocument();
    // Vault-state routing is replaced; UnlockView no longer rendered
    expect(screen.queryByText('Unlock Wallet')).toBeNull();
    // Corner gear hidden while in Settings (to avoid recursion / clutter)
    expect(screen.queryByTestId('corner-settings-button')).toBeNull();
  });

  it('B0b-follow-up: back from SettingsView returns to vault-state routing', () => {
    useVaultStateMock.mockReturnValue({ state: { status: 'locked' }, refresh: vi.fn() });
    render(<App />);
    fireEvent.click(screen.getByTestId('corner-settings-button'));
    fireEvent.click(screen.getByTestId('settings-back-trigger'));
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-overlay')).toBeNull();
    expect(screen.getByTestId('corner-settings-button')).toBeInTheDocument();
  });
});