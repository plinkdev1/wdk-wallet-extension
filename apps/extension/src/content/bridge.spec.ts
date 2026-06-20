/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { createBridge } from './bridge.js';
import type { DappSwRequestEnvelope, DappSwResponseEnvelope } from '../types/dapp-messages.js';

/** Build a MessageEvent-like object that satisfies the handler's `data` access. */
function evt(data: unknown): MessageEvent {
  return { data } as MessageEvent;
}

describe('createBridge', () => {
  it('ignores messages whose source is not wdk-dapp-request', async () => {
    const sendToSw = vi.fn();
    const postToInpage = vi.fn();
    const bridge = createBridge({
      getOrigin: () => 'https://app.example',
      sendToSw, postToInpage,
    });

    await bridge(evt({ source: 'wdk-dapp-response', id: 'x' }));
    await bridge(evt({ source: 'metamask-event' }));
    await bridge(evt({ source: 'random' }));
    await bridge(evt(null));
    await bridge(evt('a string with no source'));

    expect(sendToSw).not.toHaveBeenCalled();
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('ignores malformed requests (missing id or method)', async () => {
    const sendToSw = vi.fn();
    const postToInpage = vi.fn();
    const bridge = createBridge({
      getOrigin: () => 'https://app.example',
      sendToSw, postToInpage,
    });

    await bridge(evt({ source: 'wdk-dapp-request', method: 'eth_chainId' })); // no id
    await bridge(evt({ source: 'wdk-dapp-request', id: 'r1' })); // no method
    await bridge(evt({ source: 'wdk-dapp-request', id: 123, method: 'eth_chainId' })); // wrong id type

    expect(sendToSw).not.toHaveBeenCalled();
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('stamps verified origin from getOrigin() onto the SW envelope', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockResolvedValue({ id: 'r1', result: '0x1' });
    const bridge = createBridge({
      getOrigin: () => 'https://uniswap.org',
      sendToSw,
      postToInpage: vi.fn(),
    });

    await bridge(evt({ source: 'wdk-dapp-request', id: 'r1', method: 'eth_chainId' }));

    expect(sendToSw).toHaveBeenCalledOnce();
    const swCall = sendToSw.mock.calls[0]![0];
    expect(swCall.origin).toBe('https://uniswap.org');
    expect(swCall.type).toBe('DAPP_REQUEST');
    expect(swCall.id).toBe('r1');
    expect(swCall.method).toBe('eth_chainId');
  });

  it('IGNORES any origin field on the inpage envelope (does not trust page-supplied origin)', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockResolvedValue({ id: 'r1', result: '0x1' });
    const bridge = createBridge({
      getOrigin: () => 'https://legitimate-dapp.example',
      sendToSw,
      postToInpage: vi.fn(),
    });

    // Malicious dApp spoofs origin in the envelope
    await bridge(evt({
      source: 'wdk-dapp-request',
      id: 'r1',
      method: 'eth_chainId',
      origin: 'https://victim-bank.example',  // SPOOFED - should be ignored
    }));

    const swCall = sendToSw.mock.calls[0]![0];
    expect(swCall.origin).toBe('https://legitimate-dapp.example');
    expect(swCall.origin).not.toBe('https://victim-bank.example');
  });

  it('posts a DappResponseEnvelope back to inpage on SW success', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockResolvedValue({ id: 'r1', result: '0x42' });
    const postToInpage = vi.fn();
    const bridge = createBridge({
      getOrigin: () => 'https://x',
      sendToSw,
      postToInpage,
    });

    await bridge(evt({ source: 'wdk-dapp-request', id: 'r1', method: 'eth_chainId' }));

    expect(postToInpage).toHaveBeenCalledOnce();
    expect(postToInpage).toHaveBeenCalledWith({
      source: 'wdk-dapp-response',
      id: 'r1',
      result: '0x42',
    });
  });

  it('posts an error response when SW returns an EIP-1193 error', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockResolvedValue({
        id: 'r1',
        error: { code: 4001, message: 'User rejected request' },
      });
    const postToInpage = vi.fn();
    const bridge = createBridge({
      getOrigin: () => 'https://x',
      sendToSw,
      postToInpage,
    });

    await bridge(evt({ source: 'wdk-dapp-request', id: 'r1', method: 'eth_sendTransaction', params: [{}] }));

    expect(postToInpage).toHaveBeenCalledWith({
      source: 'wdk-dapp-response',
      id: 'r1',
      error: { code: 4001, message: 'User rejected request' },
    });
  });

  it('wraps unexpected transport errors as EIP-1474 -32603 internal error', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockRejectedValue(new Error('chrome.runtime.sendMessage failed: port closed'));
    const postToInpage = vi.fn();
    const bridge = createBridge({
      getOrigin: () => 'https://x',
      sendToSw,
      postToInpage,
    });

    await bridge(evt({ source: 'wdk-dapp-request', id: 'r1', method: 'eth_chainId' }));

    expect(postToInpage).toHaveBeenCalledWith({
      source: 'wdk-dapp-response',
      id: 'r1',
      error: {
        code: -32603,
        message: 'chrome.runtime.sendMessage failed: port closed',
      },
    });
  });

  it('passes params through to SW envelope unchanged (no validation at bridge tier)', async () => {
    const sendToSw = vi.fn<(arg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>>()
      .mockResolvedValue({ id: 'r1', result: null });
    const bridge = createBridge({
      getOrigin: () => 'https://x',
      sendToSw,
      postToInpage: vi.fn(),
    });

    const arbitraryParams = [{ from: '0x1', to: '0x2', value: '0x100', data: '0xdeadbeef' }];
    await bridge(evt({
      source: 'wdk-dapp-request',
      id: 'r1',
      method: 'eth_sendTransaction',
      params: arbitraryParams,
    }));

    expect(sendToSw.mock.calls[0]![0].params).toEqual(arbitraryParams);
  });
});