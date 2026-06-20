/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MainView } from './main-view.js';

function setupSendMessage(returnAddress: string | null, lockOk: boolean = true, returnBalance: bigint | null = 0n) {
  const sendMessage = vi.fn(async (msg: { type: string }) => {
    if (msg.type === 'ACCOUNT_GET_EVM_ADDRESS') {
      if (returnAddress === null) return { ok: false, error: 'Wallet is locked' };
      return { ok: true, data: returnAddress };
    }
    if (msg.type === 'LOCK') {
      if (!lockOk) return { ok: false, error: 'LOCK failed' };
      return { ok: true, data: { ok: true } };
    }
    if (msg.type === 'RPC_GET_BALANCE') {
      if (returnBalance === null) return { ok: false, error: 'RPC failed' };
      return { ok: true, data: returnBalance.toString() };
    }
    return { ok: false, error: `unexpected type ${msg.type}` };
  });
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { sendMessage },
  };
  return sendMessage;
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe('MainView (B5.3)', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    // restore default clipboard between tests
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('renders the Ethereum Mainnet network badge', () => {
    setupSendMessage('0x1111111111111111111111111111111111111111');
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Ethereum Mainnet')).toBeInTheDocument();
  });

  it('renders the Lock button', () => {
    setupSendMessage('0x1111111111111111111111111111111111111111');
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
  });

  it('shows loading state for the address initially', () => {
    setupSendMessage('0x1111111111111111111111111111111111111111');
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Loading address...')).toBeInTheDocument();
  });

  it('renders the truncated address once loaded (0x1111...1111)', async () => {
    setupSendMessage('0x1111111111111111111111111111111111111111');
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('0x1111...1111')).toBeInTheDocument();
    });
  });

  it('shows error state when ACCOUNT_GET_EVM_ADDRESS fails', async () => {
    setupSendMessage(null);
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load address/)).toBeInTheDocument();
    });
  });

  it('clicking Lock sends LOCK and calls onLockRequested', async () => {
    const sendMessage = setupSendMessage('0x1111111111111111111111111111111111111111');
    const onLockRequested = vi.fn();
    render(<MainView onLockRequested={onLockRequested} onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: 'LOCK' });
    });
    await waitFor(() => expect(onLockRequested).toHaveBeenCalledTimes(1));
  });

  it('does NOT call onLockRequested if LOCK fails', async () => {
    setupSendMessage('0x1111111111111111111111111111111111111111', false);
    const onLockRequested = vi.fn();
    render(<MainView onLockRequested={onLockRequested} onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Lock' }));
    // Give the failed LOCK promise a tick to settle
    await new Promise((r) => setTimeout(r, 30));
    expect(onLockRequested).not.toHaveBeenCalled();
  });

  it('clicking Copy writes the FULL address to clipboard (not truncated)', async () => {
    setupSendMessage('0x1234567890abcdef1234567890abcdef12345678');
    const writeText = mockClipboard();
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('0x1234567890abcdef1234567890abcdef12345678');
    });
  });

  it('shows "Copied!" transient feedback after Copy click', async () => {
    setupSendMessage('0x1234567890abcdef1234567890abcdef12345678');
    mockClipboard();
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => screen.getByText('0x1234...5678'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    });
  });

  it('Copy button does not appear in error state', async () => {
    setupSendMessage(null);
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => screen.getByText(/Failed to load address/));
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('shows "Loading balance..." while balance is fetching', () => {
    setupSendMessage('0x1111111111111111111111111111111111111111', true, 10n ** 18n);
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Loading balance...')).toBeInTheDocument();
  });

  it('renders the formatted balance after RPC_GET_BALANCE succeeds', async () => {
    setupSendMessage('0x1111111111111111111111111111111111111111', true, 10n ** 18n);
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('1.0000')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
    });
  });

  it('shows balance error when RPC_GET_BALANCE fails', async () => {
    setupSendMessage('0x1111111111111111111111111111111111111111', true, null);
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load balance/)).toBeInTheDocument();
    });
  });

  it('clicking the Settings gear fires onOpenSettings (B0b)', () => {
    setupSendMessage('0x1111111111111111111111111111111111111111');
    const onOpenSettings = vi.fn();
    render(<MainView onLockRequested={vi.fn()} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});