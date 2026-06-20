/**
 * @vitest-environment jsdom
 *
 * useBalance hook + formatEthFromWei utility tests. Mirrors the chrome.runtime
 * sendMessage mocking pattern from use-main-account.spec.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBalance, formatEthFromWei } from './use-balance.js';

function setupSendMessage(returnBalance: bigint | null) {
  const sendMessage = vi.fn(async (msg: { type: string }) => {
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

describe('useBalance', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('starts in loading state', () => {
    setupSendMessage(10n ** 18n);
    const { result } = renderHook(() => useBalance({ address: '0xabc' }));
    expect(result.current.state.status).toBe('loading');
  });

  it('fetches balance and transitions to ready', async () => {
    setupSendMessage(10n ** 18n);
    const { result } = renderHook(() => useBalance({ address: '0xabc' }));
    await waitFor(() => {
      expect(result.current.state.status).toBe('ready');
    });
    if (result.current.state.status === 'ready') {
      expect(result.current.state.balance).toBe(10n ** 18n);
    }
  });

  it('reports error on RPC failure', async () => {
    setupSendMessage(null);
    const { result } = renderHook(() => useBalance({ address: '0xabc' }));
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
  });

  it('stays loading when address is undefined', async () => {
    const sendMessage = setupSendMessage(10n ** 18n);
    const { result } = renderHook(() => useBalance({}));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.state.status).toBe('loading');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('defaults chain to "ethereum"', async () => {
    const sendMessage = setupSendMessage(0n);
    renderHook(() => useBalance({ address: '0xabc' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalled());
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'RPC_GET_BALANCE',
      chain: 'ethereum',
      address: '0xabc',
    });
  });

  it('refresh re-fetches the balance', async () => {
    const sendMessage = setupSendMessage(10n ** 18n);
    const { result } = renderHook(() => useBalance({ address: '0xabc' }));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
  });
});

describe('formatEthFromWei', () => {
  it('formats 0n as "0.0000"', () => {
    expect(formatEthFromWei(0n)).toBe('0.0000');
  });

  it('formats 1 ETH (10^18 wei) as "1.0000"', () => {
    expect(formatEthFromWei(10n ** 18n)).toBe('1.0000');
  });

  it('formats 0.1 ETH as "0.1000"', () => {
    expect(formatEthFromWei(10n ** 17n)).toBe('0.1000');
  });

  it('formats 0.1234 ETH exactly', () => {
    expect(formatEthFromWei(1234n * 10n ** 14n)).toBe('0.1234');
  });

  it('truncates the 5th decimal (does not round)', () => {
    // 0.12349 ETH should display as 0.1234 not 0.1235
    expect(formatEthFromWei(12349n * 10n ** 13n)).toBe('0.1234');
  });

  it('formats whole-number ETH balances', () => {
    expect(formatEthFromWei(42n * 10n ** 18n)).toBe('42.0000');
  });
});