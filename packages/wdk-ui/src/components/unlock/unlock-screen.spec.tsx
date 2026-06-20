/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnlockScreen, F_VAULT_01_ERROR_STRING } from './unlock-screen.js';

describe('UnlockScreen (B5.0a, ADR-002 + ADR-006 + F-VAULT-01)', () => {
  it('renders default title "Unlock Wallet"', () => {
    render(<UnlockScreen onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText('Unlock Wallet')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<UnlockScreen title="Welcome back" onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('calls onSubmit with the typed password', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'hunter2');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hunter2'));
  });

  it('submits on Enter key in the password field', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UnlockScreen onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Password');
    await userEvent.type(input, 'hunter2');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hunter2'));
  });

  it('F-VAULT-01: shows the LOCKED error string when onSubmit throws OperationError', async () => {
    const op = new Error('does-not-matter');
    op.name = 'OperationError';
    const onSubmit = vi.fn().mockRejectedValue(op);
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(F_VAULT_01_ERROR_STRING);
    });
  });

  it('F-VAULT-01: shows the SAME locked string when onSubmit throws a tampered-ciphertext OperationError', async () => {
    // Same shape, different "cause" - F-VAULT-01 says these MUST collapse to one string.
    const op = new Error('');
    op.name = 'OperationError';
    const onSubmit = vi.fn().mockRejectedValue(op);
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'anything');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(F_VAULT_01_ERROR_STRING);
    });
  });

  it('shows a generic error (NOT the F-VAULT-01 string) for non-OperationError throws', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network down'));
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'anything');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).not.toBe(F_VAULT_01_ERROR_STRING);
      expect(alert.textContent).toMatch(/unexpected error/i);
    });
  });

  it('disables submit button while pending', async () => {
    let resolveIt: (() => void) | null = null;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveIt = r; }));
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled();
    resolveIt!();
  });

  it('submit button is disabled while password is empty', () => {
    render(<UnlockScreen onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole('button', { name: /unlock/i })).toBeDisabled();
  });

  it('does not invoke onSubmit twice on rapid double-click', async () => {
    let resolveIt: (() => void) | null = null;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveIt = r; }));
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    const btn = screen.getByRole('button', { name: 'Unlock' });
    await userEvent.click(btn);
    // second click is no-op because button is disabled; assert by call count.
    await userEvent.click(btn).catch(() => undefined);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveIt!();
  });

  it('clears prior error when user resubmits', async () => {
    const op = new Error('');
    op.name = 'OperationError';
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(op)
      .mockResolvedValueOnce(undefined);
    render(<UnlockScreen onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});