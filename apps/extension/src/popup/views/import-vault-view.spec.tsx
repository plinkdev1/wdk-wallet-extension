/**
 * @vitest-environment jsdom
 *
 * ImportVaultView (B5.4.2) spec. Mocks both sw-client.send AND the wdk-ui
 * composites (MnemonicInput + PasswordSetupScreen) so the tests focus on the
 * state machine in ImportVaultView alone.
 *
 * Why mock wdk-ui (L-TEST-03 / L-REACT-04): sibling components in routing
 * layers are mocked to keep specs focused on the orchestration. The composed
 * primitives have their own specs (23 MnemonicInput tests in B5.4.1, 16
 * PasswordSetupScreen tests in B5.1).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ImportVaultView } from './import-vault-view.js';

// Mock sw-client.send so we can control SW responses + assert call shapes.
vi.mock('../lib/sw-client.js', () => ({
  send: vi.fn(),
}));

// Mock wdk-ui composites so tests focus on ImportVaultView's logic, not on
// MnemonicInput / PasswordSetupScreen internals (those have their own specs).
vi.mock('@wdk-starter/wdk-ui', () => ({
  MnemonicGrid: ({ onChange, error, disabled }: {
    onChange?: (joined: string) => void;
    error?: string | null;
    disabled?: boolean;
  }) => (
    <div>
      <textarea
        data-testid="mnemonic-input"
        aria-label="recovery phrase"
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
      />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
  Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  PasswordSetupScreen: ({ onSubmit }: { onSubmit: (password: string) => Promise<void> | void }) => (
    <div data-testid="password-setup-screen">
      <button
        type="button"
        onClick={() => {
          // fire and forget; real PasswordSetupScreen handles awaiting
          void onSubmit('test-password-1234');
        }}
      >
        MOCK_SUBMIT_PASSWORD
      </button>
    </div>
  ),
}));

import { send } from '../lib/sw-client.js';
const mockSend = send as unknown as ReturnType<typeof vi.fn>;

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('ImportVaultView (B5.4.2)', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('initial render', () => {
    it('renders MnemonicInput and Continue button', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      expect(screen.getByTestId('mnemonic-input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('renders a heading naming the import flow', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      expect(screen.getByText(/import existing wallet/i)).toBeInTheDocument();
    });

    it('does NOT render the password-setup screen initially', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      expect(screen.queryByTestId('password-setup-screen')).not.toBeInTheDocument();
    });
  });

  describe('continue button enablement', () => {
    it('is disabled when mnemonic is empty', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('is disabled when mnemonic is only whitespace', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: '   ' } });
      expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    });

    it('is enabled when mnemonic has at least one word', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: 'abandon' } });
      expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
    });
  });

  describe('validation', () => {
    it('calls BIP39_VALIDATE_MNEMONIC with normalized (trimmed + single-spaced) mnemonic on Continue', async () => {
      mockSend.mockResolvedValueOnce(true);
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), {
        target: { value: '   abandon   abandon  about   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith({
          type: 'BIP39_VALIDATE_MNEMONIC',
          mnemonic: 'abandon abandon about',
        });
      });
    });

    it('shows error and stays in input step when validation returns false', async () => {
      mockSend.mockResolvedValueOnce(false);
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: 'totally bogus phrase' } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/not a valid recovery phrase/i);
      });
      expect(screen.queryByTestId('password-setup-screen')).not.toBeInTheDocument();
    });

    it('shows the error message from a thrown SW error', async () => {
      mockSend.mockRejectedValueOnce(new Error('SW disconnected'));
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('SW disconnected');
      });
    });

    it('advances to password-setup when validation returns true', async () => {
      mockSend.mockResolvedValueOnce(true);
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByTestId('password-setup-screen')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('mnemonic-input')).not.toBeInTheDocument();
    });

    it('shows "Validating..." while the SW call is in flight', async () => {
      let resolveSend!: (v: boolean) => void;
      mockSend.mockImplementationOnce(() => new Promise<boolean>((res) => { resolveSend = res; }));
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByRole('button')).toHaveTextContent(/validating/i);
      });
      await act(async () => { resolveSend(true); });
    });

    it('disables MnemonicInput while validating (prevents edits mid-flight)', async () => {
      let resolveSend!: (v: boolean) => void;
      mockSend.mockImplementationOnce(() => new Promise<boolean>((res) => { resolveSend = res; }));
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => {
        expect(screen.getByTestId('mnemonic-input')).toBeDisabled();
      });
      await act(async () => { resolveSend(true); });
    });

    it('does NOT call SW when Continue is clicked with empty mnemonic (button is disabled)', () => {
      render(<ImportVaultView onVaultImported={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('password setup -> store -> complete', () => {
    it('calls VAULT_STORE and VAULT_LOAD with the right args on password submit', async () => {
      mockSend
        .mockResolvedValueOnce(true)              // BIP39_VALIDATE_MNEMONIC
        .mockResolvedValueOnce({ ok: true })      // VAULT_STORE
        .mockResolvedValueOnce({ ok: true });     // VAULT_LOAD
      render(<ImportVaultView onVaultImported={vi.fn()} />);

      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => expect(screen.getByTestId('password-setup-screen')).toBeInTheDocument());

      fireEvent.click(screen.getByText('MOCK_SUBMIT_PASSWORD'));
      await waitFor(() => {
        expect(mockSend).toHaveBeenNthCalledWith(2, {
          type: 'VAULT_STORE',
          mnemonic: TEST_MNEMONIC,
          password: 'test-password-1234',
        });
        expect(mockSend).toHaveBeenNthCalledWith(3, {
          type: 'VAULT_LOAD',
          password: 'test-password-1234',
        });
      });
    });

    it('calls onVaultImported after VAULT_LOAD succeeds', async () => {
      mockSend
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });
      const onVaultImported = vi.fn();
      render(<ImportVaultView onVaultImported={onVaultImported} />);

      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => expect(screen.getByTestId('password-setup-screen')).toBeInTheDocument());

      fireEvent.click(screen.getByText('MOCK_SUBMIT_PASSWORD'));
      await waitFor(() => expect(onVaultImported).toHaveBeenCalledTimes(1));
    });

    it('L-REACT-03: complete state does not expose the mnemonic anywhere in the DOM', async () => {
      mockSend
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });
      const onVaultImported = vi.fn();
      const { container } = render(<ImportVaultView onVaultImported={onVaultImported} />);

      fireEvent.change(screen.getByTestId('mnemonic-input'), { target: { value: TEST_MNEMONIC } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => expect(screen.getByTestId('password-setup-screen')).toBeInTheDocument());

      fireEvent.click(screen.getByText('MOCK_SUBMIT_PASSWORD'));
      await waitFor(() => expect(onVaultImported).toHaveBeenCalled());

      // After complete the mnemonic must not be visible anywhere
      expect(container.textContent).not.toContain(TEST_MNEMONIC);
      expect(container.textContent).not.toContain('abandon abandon');
    });
  });
});