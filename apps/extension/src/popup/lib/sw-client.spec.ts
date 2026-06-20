/**
 * @vitest-environment jsdom
 *
 * sw-client transport tests. Stubs chrome.runtime.sendMessage globally
 * (jsdom doesn't provide chrome). Covers success path (returns .data),
 * error path (throws .error), and that the original message envelope
 * is forwarded unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { send } from './sw-client.js';

const sendMessageMock = vi.fn();
vi.stubGlobal('chrome', { runtime: { sendMessage: sendMessageMock } });

describe('send (sw-client)', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();
  });

  it('returns response.data on success', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true, data: 'pong' });
    const result = await send({ type: 'PING' });
    expect(result).toBe('pong');
  });

  it('throws Error(response.error) on failure', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: false, error: 'Vault locked' });
    await expect(send({ type: 'GET_LOCK_STATE' })).rejects.toThrow('Vault locked');
  });

  it('passes the message envelope through to chrome.runtime.sendMessage unchanged', async () => {
    sendMessageMock.mockResolvedValueOnce({ ok: true, data: { ok: true } });
    await send({ type: 'APPROVAL_RESPOND', id: 'r1', approved: true, data: ['0xabc'] });
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'APPROVAL_RESPOND',
      id: 'r1',
      approved: true,
      data: ['0xabc'],
    });
  });
});