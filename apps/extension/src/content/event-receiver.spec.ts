/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { startEventReceiver } from './event-receiver.js';

const sampleEnvelope = {
  source: 'wdk-dapp-event' as const,
  event: 'chainChanged' as const,
  data: '0x89',
};

function setup(currentOrigin = 'https://uniswap.org') {
  const postToInpage = vi.fn();
  let savedListener: ((msg: unknown) => void) | undefined;
  const addListener = vi.fn((cb: (msg: unknown) => void) => {
    savedListener = cb;
  });
  startEventReceiver({
    currentOrigin: () => currentOrigin,
    postToInpage,
    addListener,
  });
  const listener = savedListener;
  if (!listener) throw new Error('listener not registered');
  return { postToInpage, listener };
}

describe('startEventReceiver', () => {
  it('registers a listener via addListener', () => {
    const addListener = vi.fn();
    startEventReceiver({
      currentOrigin: () => 'https://x',
      postToInpage: vi.fn(),
      addListener,
    });
    expect(addListener).toHaveBeenCalledOnce();
  });

  it('ignores non-object messages', () => {
    const { postToInpage, listener } = setup();
    listener(null);
    listener('string');
    listener(42);
    listener(undefined);
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('ignores messages without type === DAPP_EVENT', () => {
    const { postToInpage, listener } = setup();
    listener({ type: 'OTHER', envelope: sampleEnvelope });
    listener({ type: 'DAPP_REQUEST' });
    listener({ envelope: sampleEnvelope });
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('ignores messages with malformed envelope', () => {
    const { postToInpage, listener } = setup();
    listener({ type: 'DAPP_EVENT' });
    listener({ type: 'DAPP_EVENT', envelope: null });
    listener({ type: 'DAPP_EVENT', envelope: 'string' });
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('ignores envelopes with wrong source', () => {
    const { postToInpage, listener } = setup();
    listener({
      type: 'DAPP_EVENT',
      envelope: { ...sampleEnvelope, source: 'metamask-event' },
    });
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('forwards valid envelopes to postToInpage (no targetOrigin)', () => {
    const { postToInpage, listener } = setup();
    listener({ type: 'DAPP_EVENT', envelope: sampleEnvelope });
    expect(postToInpage).toHaveBeenCalledOnce();
    expect(postToInpage).toHaveBeenCalledWith(sampleEnvelope);
  });

  it('forwards when targetOrigin matches currentOrigin', () => {
    const { postToInpage, listener } = setup('https://uniswap.org');
    listener({
      type: 'DAPP_EVENT',
      envelope: sampleEnvelope,
      targetOrigin: 'https://uniswap.org',
    });
    expect(postToInpage).toHaveBeenCalledOnce();
  });

  it('drops when targetOrigin does not match currentOrigin', () => {
    const { postToInpage, listener } = setup('https://uniswap.org');
    listener({
      type: 'DAPP_EVENT',
      envelope: sampleEnvelope,
      targetOrigin: 'https://aave.com',
    });
    expect(postToInpage).not.toHaveBeenCalled();
  });

  it('forwards when no targetOrigin (global event)', () => {
    const { postToInpage, listener } = setup('https://uniswap.org');
    listener({
      type: 'DAPP_EVENT',
      envelope: sampleEnvelope,
    });
    expect(postToInpage).toHaveBeenCalledOnce();
  });
});