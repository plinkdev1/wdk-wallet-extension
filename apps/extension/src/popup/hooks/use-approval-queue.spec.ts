/**
 * @vitest-environment jsdom
 *
 * useApprovalQueue hook tests. Mocks sw-client so we don't need chrome.
 * Covers loading -> empty, loading -> pending, loading -> error, and
 * refresh() re-running the fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApprovalQueue } from './use-approval-queue.js';
import * as swClient from '../lib/sw-client.js';
import type { ApprovalRequest } from '../../background/approval-flow.js';

vi.mock('../lib/sw-client.js', () => ({
  send: vi.fn(),
}));

const sendMock = vi.mocked(swClient.send);

const fakeRequest: ApprovalRequest = {
  id: 'req-abc',
  origin: 'https://uniswap.org',
  method: 'eth_requestAccounts',
  params: [],
  createdAt: 1234567890,
};

describe('useApprovalQueue', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('starts in loading state', () => {
    sendMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useApprovalQueue());
    expect(result.current.state.status).toBe('loading');
  });

  it('resolves to empty when APPROVAL_LIST_PENDING returns []', async () => {
    sendMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.state.status).toBe('empty'));
    expect(sendMock).toHaveBeenCalledWith({ type: 'APPROVAL_LIST_PENDING' });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('fetches request details when LIST_PENDING returns an id', async () => {
    sendMock.mockResolvedValueOnce(['req-abc']).mockResolvedValueOnce(fakeRequest);
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.state.status).toBe('pending'));
    if (result.current.state.status === 'pending') {
      expect(result.current.state.request).toEqual(fakeRequest);
    }
    expect(sendMock).toHaveBeenNthCalledWith(1, { type: 'APPROVAL_LIST_PENDING' });
    expect(sendMock).toHaveBeenNthCalledWith(2, { type: 'APPROVAL_GET_PENDING', id: 'req-abc' });
  });

  it('treats GET_PENDING returning null as empty (race condition)', async () => {
    sendMock.mockResolvedValueOnce(['req-abc']).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.state.status).toBe('empty'));
  });

  it('surfaces send() errors as error state', async () => {
    sendMock.mockRejectedValueOnce(new Error('SW unreachable'));
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toBe('SW unreachable');
    }
  });

  it('refresh() re-runs the fetch', async () => {
    sendMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useApprovalQueue());
    await waitFor(() => expect(result.current.state.status).toBe('empty'));
    expect(sendMock).toHaveBeenCalledTimes(1);

    sendMock.mockResolvedValueOnce(['req-abc']).mockResolvedValueOnce(fakeRequest);
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.state.status).toBe('pending'));
    expect(sendMock).toHaveBeenCalledTimes(3); // 1 initial + 2 refresh
  });
});