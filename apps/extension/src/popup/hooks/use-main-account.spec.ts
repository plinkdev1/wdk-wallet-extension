/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMainAccount } from './use-main-account.js';

function mockSendMessage(impl: (msg: { type: string }) => unknown) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: vi.fn(async (msg: { type: string }) => {
        const data = impl(msg);
        return { ok: true, data };
      }),
    },
  };
}

function mockSendMessageError(error: string) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: false, error })),
    },
  };
}

describe('useMainAccount', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('starts in loading state', () => {
    mockSendMessage(() => '0xabc');
    const { result } = renderHook(() => useMainAccount());
    expect(result.current.state.status).toBe('loading');
  });

  it('resolves to "ready" with the returned address', async () => {
    mockSendMessage(() => '0x1111111111111111111111111111111111111111');
    const { result } = renderHook(() => useMainAccount());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status === 'ready') {
      expect(result.current.state.address).toBe('0x1111111111111111111111111111111111111111');
    }
  });

  it('uses default (ethereum-mainnet, 0) when no options passed', async () => {
    let captured: { chain?: string; accountIndex?: number } = {};
    mockSendMessage((msg) => {
      captured = msg as typeof captured;
      return '0xabc';
    });
    renderHook(() => useMainAccount());
    await waitFor(() => expect(captured.chain).toBeDefined());
    expect(captured.chain).toBe('ethereum');
    expect(captured.accountIndex).toBe(0);
  });

  it('honors custom chain + accountIndex options', async () => {
    let captured: { chain?: string; accountIndex?: number } = {};
    mockSendMessage((msg) => {
      captured = msg as typeof captured;
      return '0xabc';
    });
    renderHook(() => useMainAccount({ chain: 'polygon-mainnet', accountIndex: 3 }));
    await waitFor(() => expect(captured.chain).toBeDefined());
    expect(captured.chain).toBe('polygon-mainnet');
    expect(captured.accountIndex).toBe(3);
  });

  it('captures error when send() throws', async () => {
    mockSendMessageError('Wallet is locked');
    const { result } = renderHook(() => useMainAccount());
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toContain('Wallet is locked');
    }
  });

  it('refresh() re-fetches the address', async () => {
    let returnValue = '0xfirst000000000000000000000000000000000000';
    mockSendMessage(() => returnValue);
    const { result } = renderHook(() => useMainAccount());
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status === 'ready') {
      expect(result.current.state.address).toBe('0xfirst000000000000000000000000000000000000');
    }

    returnValue = '0xsecond00000000000000000000000000000000000';
    act(() => { result.current.refresh(); });
    await waitFor(() => {
      if (result.current.state.status === 'ready') {
        expect(result.current.state.address).toBe('0xsecond00000000000000000000000000000000000');
      }
    });
  });
});