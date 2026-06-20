/**
 * @vitest-environment jsdom
 *
 * Uses fireEvent (extension-native testing pattern - matches approval-view.spec.tsx
 * and the per-method body specs). The extension package does not pull
 * @testing-library/user-event as a devDep; that's a wdk-ui-only pattern.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnlockView } from './unlock-view.js';

function mockSendMessageSuccess() {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: true, data: { ok: true } })),
    },
  };
}

function mockSendMessageError(message: string) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: false, error: message })),
    },
  };
}

function typePassword(value: string): void {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value } });
}

function clickUnlock(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
}

describe('UnlockView (B5.0b - extension wiring of wdk-ui UnlockScreen)', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('renders the wdk-ui UnlockScreen heading', () => {
    mockSendMessageSuccess();
    render(<UnlockView onUnlocked={vi.fn()} />);
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
  });

  it('calls VAULT_LOAD with the entered password on submit', async () => {
    mockSendMessageSuccess();
    render(<UnlockView onUnlocked={vi.fn()} />);
    typePassword('hunter2');
    clickUnlock();
    await waitFor(() => {
      const sendMessage = (globalThis as unknown as {
        chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } };
      }).chrome.runtime.sendMessage;
      expect(sendMessage).toHaveBeenCalledWith({ type: 'VAULT_LOAD', password: 'hunter2' });
    });
  });

  it('fires onUnlocked after successful VAULT_LOAD', async () => {
    mockSendMessageSuccess();
    const onUnlocked = vi.fn();
    render(<UnlockView onUnlocked={onUnlocked} />);
    typePassword('hunter2');
    clickUnlock();
    await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
  });

  it('F-VAULT-01: shows the locked string on wire error with empty message (raw OperationError)', async () => {
    // SW serializes WebCrypto's empty-message OperationError as ''
    mockSendMessageError('');
    render(<UnlockView onUnlocked={vi.fn()} />);
    typePassword('wrong');
    clickUnlock();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Incorrect password or corrupted vault data. Please try again.',
      );
    });
  });

  it('F-VAULT-01: shows the SAME locked string on wire error with arbitrary message (collapse)', async () => {
    // Conservative collapse: even infrastructure-looking failures show the
    // locked string. F-VAULT-01 prevents any side channel.
    mockSendMessageError('decryption failed');
    render(<UnlockView onUnlocked={vi.fn()} />);
    typePassword('anything');
    clickUnlock();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Incorrect password or corrupted vault data. Please try again.',
      );
    });
  });

  it('F-VAULT-01: collapses even non-crypto looking errors to the locked string', async () => {
    mockSendMessageError('SW disconnected');
    render(<UnlockView onUnlocked={vi.fn()} />);
    typePassword('anything');
    clickUnlock();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Incorrect password or corrupted vault data. Please try again.',
      );
    });
  });

  it('does NOT fire onUnlocked when VAULT_LOAD fails', async () => {
    mockSendMessageError('');
    const onUnlocked = vi.fn();
    render(<UnlockView onUnlocked={onUnlocked} />);
    typePassword('wrong');
    clickUnlock();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onUnlocked).not.toHaveBeenCalled();
  });
});