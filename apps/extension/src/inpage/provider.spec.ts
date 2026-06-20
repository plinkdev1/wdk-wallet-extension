/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WdkInpageProvider, ProviderRpcError } from './provider.js';

/** Wait for at least one task queue cycle (postMessage is async). */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('WdkInpageProvider', () => {
  let provider: WdkInpageProvider;
  let captured: unknown[];
  let capture: (e: MessageEvent) => void;

  beforeEach(async () => {
    // Drain any postMessages queued by the PRIOR test before installing this
    // test's capture listener. window.postMessage is async via the task queue,
    // and if a prior test's posted message hasn't fired by the time the test
    // exits, it leaks into the next test's listener. Flushing here ensures
    // the next test sees a clean queue.
    await flush();
    captured = [];
    capture = (e: MessageEvent) => {
      const d = e.data as { source?: string } | null;
      if (d && d.source === 'wdk-dapp-request') captured.push(e.data);
    };
    window.addEventListener('message', capture);
    provider = new WdkInpageProvider();
  });

  afterEach(() => {
    provider.destroy();
    window.removeEventListener('message', capture);
  });

  it('request() returns a Promise', async () => {
    const p = provider.request({ method: 'eth_chainId' });
    expect(p).toBeInstanceOf(Promise);
    // Drain the posted message before the test exits so it doesn't leak.
    await flush();
    p.catch(() => { /* hanging promise - intentional */ });
  });

  it('request() posts DappRequestEnvelope with correct source + method', async () => {
    provider.request({ method: 'eth_chainId' });
    await flush();
    expect(captured.length).toBe(1);
    const env = captured[0] as { source: string; method: string; id: string };
    expect(env.source).toBe('wdk-dapp-request');
    expect(env.method).toBe('eth_chainId');
    expect(typeof env.id).toBe('string');
    expect(env.id.length).toBeGreaterThan(0);
  });

  it('request() generates unique IDs across calls', async () => {
    provider.request({ method: 'eth_chainId' });
    provider.request({ method: 'eth_accounts' });
    await flush();
    const ids = captured.map((e) => (e as { id: string }).id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('request() resolves with result when matching response arrives', async () => {
    const promise = provider.request({ method: 'eth_chainId' });
    await flush();
    const sentId = (captured[0] as { id: string }).id;
    window.postMessage({ source: 'wdk-dapp-response', id: sentId, result: '0x1' }, '*');
    await expect(promise).resolves.toBe('0x1');
  });

  it('request() rejects with ProviderRpcError when error response arrives', async () => {
    const promise = provider.request({ method: 'eth_sendTransaction', params: [{}] });
    await flush();
    const sentId = (captured[0] as { id: string }).id;
    window.postMessage(
      { source: 'wdk-dapp-response', id: sentId, error: { code: 4001, message: 'User rejected request' } },
      '*'
    );
    await expect(promise).rejects.toBeInstanceOf(ProviderRpcError);
    await expect(promise).rejects.toMatchObject({ code: 4001, message: 'User rejected request' });
  });

  it('request() ignores responses with non-matching id', async () => {
    const promise = provider.request({ method: 'eth_chainId' });
    await flush();
    // Send response with WRONG id - should be ignored
    window.postMessage({ source: 'wdk-dapp-response', id: 'bogus-id', result: 'should-be-ignored' }, '*');
    await flush();
    // Then send the real response
    const sentId = (captured[0] as { id: string }).id;
    window.postMessage({ source: 'wdk-dapp-response', id: sentId, result: '0x1' }, '*');
    await expect(promise).resolves.toBe('0x1');
  });

  it('request() rejects on invalid args (null / wrong shape)', async () => {
    await expect(
      provider.request(null as unknown as { method: string })
    ).rejects.toThrow();
    await expect(
      provider.request({ method: 123 } as unknown as { method: string })
    ).rejects.toThrow();
  });

  it('on() registers an event listener that fires on wdk-dapp-event', async () => {
    const listener = vi.fn();
    provider.on('chainChanged', listener);
    window.postMessage({ source: 'wdk-dapp-event', event: 'chainChanged', data: { chainId: '0x1' } }, '*');
    await flush();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({ chainId: '0x1' });
  });

  it('removeListener() unregisters a listener', async () => {
    const listener = vi.fn();
    provider.on('accountsChanged', listener);
    provider.removeListener('accountsChanged', listener);
    window.postMessage({ source: 'wdk-dapp-event', event: 'accountsChanged', data: [] }, '*');
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple listeners for same event all fire', async () => {
    const a = vi.fn();
    const b = vi.fn();
    provider.on('connect', a);
    provider.on('connect', b);
    window.postMessage({ source: 'wdk-dapp-event', event: 'connect', data: { chainId: '0x1' } }, '*');
    await flush();
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('ignores non-wdk source messages', async () => {
    const listener = vi.fn();
    provider.on('chainChanged', listener);
    window.postMessage({ source: 'metamask-event', event: 'chainChanged', data: '0x1' }, '*');
    window.postMessage({ source: 'random', event: 'chainChanged', data: '0x1' }, '*');
    window.postMessage('a string with no source', '*');
    await flush();
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores own request echoes (source=wdk-dapp-request)', async () => {
    const promise = provider.request({ method: 'eth_chainId' });
    await flush();
    // The provider posts its own request, which fires the message listener.
    // Verify nothing breaks (the request stays pending, doesn't reject prematurely).
    const sentId = (captured[0] as { id: string }).id;
    window.postMessage({ source: 'wdk-dapp-response', id: sentId, result: 'ok' }, '*');
    await expect(promise).resolves.toBe('ok');
  });

  it('listener errors do not throw to the message handler', async () => {
    const throwingListener = vi.fn(() => { throw new Error('listener boom'); });
    const goodListener = vi.fn();
    provider.on('disconnect', throwingListener);
    provider.on('disconnect', goodListener);
    window.postMessage({ source: 'wdk-dapp-event', event: 'disconnect', data: { code: 1000 } }, '*');
    await flush();
    expect(throwingListener).toHaveBeenCalledOnce();
    expect(goodListener).toHaveBeenCalledOnce();
  });
});