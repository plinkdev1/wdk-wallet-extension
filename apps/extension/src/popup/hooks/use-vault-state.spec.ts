/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useVaultState } from './use-vault-state.js';

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

function mockSendMessageWithError(error: string) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage: vi.fn(async () => ({ ok: false, error })),
    },
  };
}

describe('useVaultState', () => {
  beforeEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it('starts in loading state', () => {
    mockSendMessage(() => true);
    const { result } = renderHook(() => useVaultState());
    expect(result.current.state.status).toBe('loading');
  });

  it('resolves to "no-vault" when VAULT_HAS_STORED returns false', async () => {
    mockSendMessage((msg) => {
      if (msg.type === 'VAULT_HAS_STORED') return false;
      if (msg.type === 'GET_LOCK_STATE') return 'locked';
      return null;
    });
    const { result } = renderHook(() => useVaultState());
    await waitFor(() => expect(result.current.state.status).toBe('no-vault'));
  });

  it('resolves to "locked" when vault exists but lock state is locked', async () => {
    mockSendMessage((msg) => {
      if (msg.type === 'VAULT_HAS_STORED') return true;
      if (msg.type === 'GET_LOCK_STATE') return 'locked';
      return null;
    });
    const { result } = renderHook(() => useVaultState());
    await waitFor(() => expect(result.current.state.status).toBe('locked'));
  });

  it('resolves to "unlocked" when vault exists and lock state is unlocked', async () => {
    mockSendMessage((msg) => {
      if (msg.type === 'VAULT_HAS_STORED') return true;
      if (msg.type === 'GET_LOCK_STATE') return 'unlocked';
      return null;
    });
    const { result } = renderHook(() => useVaultState());
    await waitFor(() => expect(result.current.state.status).toBe('unlocked'));
  });

  it('captures error when send() throws', async () => {
    mockSendMessageWithError('SW disconnected');
    const { result } = renderHook(() => useVaultState());
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toContain('SW disconnected');
    }
  });

  it('refresh() re-fetches', async () => {
    let hasStored = false;
    mockSendMessage((msg) => {
      if (msg.type === 'VAULT_HAS_STORED') return hasStored;
      if (msg.type === 'GET_LOCK_STATE') return 'unlocked';
      return null;
    });
    const { result } = renderHook(() => useVaultState());
    await waitFor(() => expect(result.current.state.status).toBe('no-vault'));

    // Flip the underlying answer, refresh, expect transition
    hasStored = true;
    act(() => { result.current.refresh(); });
    await waitFor(() => expect(result.current.state.status).toBe('unlocked'));
  });
});