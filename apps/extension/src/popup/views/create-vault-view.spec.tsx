/**
 * @vitest-environment jsdom
 *
 * CreateVaultView (B5.2) spec. The wdk-ui consumer components are mocked
 * to isolate the orchestration logic - the primitives themselves are
 * tested in @wdk-starter/wdk-ui's specs (B5.1: 38 tests across
 * MnemonicDisplay, MnemonicVerify, PasswordSetupScreen).
 *
 * What this spec verifies:
 *   - State machine transitions across the 5 steps
 *   - BIP39_GENERATE_MNEMONIC sent on mount
 *   - Generation error -> retry -> re-generate
 *   - Mnemonic flows through display/verify/setup
 *   - On password submit: VAULT_STORE THEN VAULT_LOAD (order matters)
 *   - onVaultCreated fires only after BOTH SW calls succeed
 *   - Error from VAULT_STORE rejects the onSubmit promise (PasswordSetupScreen
 *     catches it in its own alert region; this spec asserts no transition
 *     to complete and no onVaultCreated)
 *   - Mnemonic cleared from state after complete (assertion: no mnemonic
 *     text in DOM after the flow finishes)
 *
 * Why mock wdk-ui: per L-TEST-03, sibling components in routing layers
 * are mocked to keep specs focused on the orchestration. This spec is
 * about CreateVaultView's state machine, not about how MnemonicVerify
 * implements its position-typing UX.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CreateVaultView } from './create-vault-view.js';

// Mock the SW client - vi.fn lets each test stub returns per call.
vi.mock('../lib/sw-client.js', () => ({
  send: vi.fn(),
}));
import { send } from '../lib/sw-client.js';
const sendMock = vi.mocked(send);

// Mock the wdk-ui consumer components to expose simple test-driving controls.
// The primitives' real behavior is exercised in their own specs.
vi.mock('@wdk-starter/wdk-ui', () => ({
  MnemonicDisplay: (props: { mnemonic: string; onAcknowledged?: (b: boolean) => void }) => (
    <div>
      <div data-testid="mock-mnemonic-display">{props.mnemonic}</div>
      <button
        type="button"
        onClick={() => props.onAcknowledged?.(true)}
      >
        Mock Acknowledge
      </button>
    </div>
  ),
  MnemonicVerify: (props: { mnemonic: string; onVerified: () => void }) => (
    <div>
      <div data-testid="mock-mnemonic-verify">{props.mnemonic}</div>
      <button type="button" onClick={props.onVerified}>
        Mock Verify
      </button>
    </div>
  ),
  PasswordSetupScreen: (props: { onSubmit: (pw: string) => Promise<void> | void }) => {
    const [error, setError] = useState<string | null>(null);
    return (
      <div>
        <div data-testid="mock-password-setup" />
        {error && (
          <p role="alert" data-testid="mock-password-error">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              setError(null);
              await props.onSubmit('test-password-123');
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          Mock Submit Password
        </button>
      </div>
    );
  },
  Button: (props: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
}));

import { useState } from 'react';

const TEST_MNEMONIC = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';

describe('CreateVaultView (B5.2)', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('renders generating state on mount', async () => {
    sendMock.mockImplementation(() => new Promise(() => { /* never resolves */ }));
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Generating recovery phrase' })).toBeInTheDocument();
  });

  it('sends BIP39_GENERATE_MNEMONIC on mount', async () => {
    sendMock.mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({ type: 'BIP39_GENERATE_MNEMONIC' });
    });
  });

  it('transitions to mnemonic-display after generation succeeds', async () => {
    sendMock.mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('mock-mnemonic-display')).toHaveTextContent(TEST_MNEMONIC);
    });
  });

  it('shows ErrorView with Retry on generation failure', async () => {
    sendMock.mockRejectedValueOnce(new Error('SW unavailable'));
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Could not generate recovery phrase')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('SW unavailable');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });

  it('Retry triggers another BIP39_GENERATE_MNEMONIC call', async () => {
    sendMock.mockRejectedValueOnce(new Error('first fail')).mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('mock-mnemonic-display')).toHaveTextContent(TEST_MNEMONIC);
    });
  });

  it('Continue button on mnemonic-display step is disabled until acknowledged', async () => {
    sendMock.mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('Continue advances to mnemonic-verify step', async () => {
    sendMock.mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(screen.getByTestId('mock-mnemonic-verify')).toHaveTextContent(TEST_MNEMONIC);
    });
  });

  it('Successful verify advances to password-setup step', async () => {
    sendMock.mockResolvedValueOnce(TEST_MNEMONIC);
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-verify')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => {
      expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument();
    });
  });

  it('On password submit: sends VAULT_STORE then VAULT_LOAD in order', async () => {
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockResolvedValueOnce({ ok: true })  // VAULT_STORE
      .mockResolvedValueOnce({ ok: true }); // VAULT_LOAD
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        type: 'VAULT_STORE',
        password: 'test-password-123',
        mnemonic: TEST_MNEMONIC,
      });
      expect(sendMock).toHaveBeenCalledWith({
        type: 'VAULT_LOAD',
        password: 'test-password-123',
      });
    });

    // Order: BIP39_GENERATE_MNEMONIC (call 1), VAULT_STORE (call 2), VAULT_LOAD (call 3)
    expect(sendMock.mock.calls[1]?.[0]).toMatchObject({ type: 'VAULT_STORE' });
    expect(sendMock.mock.calls[2]?.[0]).toMatchObject({ type: 'VAULT_LOAD' });
  });

  it('Calls onVaultCreated AFTER both VAULT_STORE + VAULT_LOAD succeed', async () => {
    const onVaultCreated = vi.fn();
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    render(<CreateVaultView onVaultCreated={onVaultCreated} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => expect(onVaultCreated).toHaveBeenCalledTimes(1));
  });

  it('Does NOT call onVaultCreated if VAULT_STORE rejects', async () => {
    const onVaultCreated = vi.fn();
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockRejectedValueOnce(new Error('storage quota exceeded'));
    render(<CreateVaultView onVaultCreated={onVaultCreated} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-password-error')).toHaveTextContent('storage quota exceeded');
    });
    expect(onVaultCreated).not.toHaveBeenCalled();
  });

  it('Does NOT call onVaultCreated if VAULT_LOAD rejects (store succeeded but load failed)', async () => {
    const onVaultCreated = vi.fn();
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockResolvedValueOnce({ ok: true })  // VAULT_STORE OK
      .mockRejectedValueOnce(new Error('engine.unlock failed')); // VAULT_LOAD fails
    render(<CreateVaultView onVaultCreated={onVaultCreated} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-password-error')).toHaveTextContent('engine.unlock failed');
    });
    expect(onVaultCreated).not.toHaveBeenCalled();
  });

  it('Mnemonic text is NOT present in DOM after successful create-vault flow', async () => {
    const onVaultCreated = vi.fn();
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    render(<CreateVaultView onVaultCreated={onVaultCreated} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => expect(onVaultCreated).toHaveBeenCalled());
    // After complete: no mnemonic display or verify or setup; the complete
    // view does not render the mnemonic. The discriminated union enforces
    // this at the type level - state.mnemonic does not exist on the
    // 'complete' branch.
    expect(screen.queryByTestId('mock-mnemonic-display')).toBeNull();
    expect(screen.queryByTestId('mock-mnemonic-verify')).toBeNull();
    expect(screen.queryByTestId('mock-password-setup')).toBeNull();
    expect(screen.queryByText(TEST_MNEMONIC)).toBeNull();
  });

  it('Renders the complete view after flow succeeds', async () => {
    sendMock
      .mockResolvedValueOnce(TEST_MNEMONIC)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    render(<CreateVaultView onVaultCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('mock-mnemonic-display')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    await waitFor(() => expect(screen.getByTestId('mock-password-setup')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mock Submit Password' }));

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Wallet created' })).toBeInTheDocument();
    });
  });
});