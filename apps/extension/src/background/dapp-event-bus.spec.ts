import { describe, it, expect, vi } from 'vitest';
import { createDappEventBus } from './dapp-event-bus.js';
import type { DappEventEnvelope } from '../types/dapp-messages.js';

const sampleEvent: DappEventEnvelope = {
  source: 'wdk-dapp-event',
  event: 'chainChanged',
  data: '0x89',
};

describe('createDappEventBus', () => {
  it('broadcasts to all tabs with a numeric id', async () => {
    const tabs = [
      { id: 1, url: 'https://uniswap.org/x' },
      { id: 2, url: 'https://aave.com/y' },
      { id: 3, url: 'https://opensea.io/z' },
    ] as chrome.tabs.Tab[];
    const tabsQuery = vi.fn(async () => tabs);
    const tabsSendMessage = vi.fn(async () => undefined);
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent);

    expect(tabsSendMessage).toHaveBeenCalledTimes(3);
    expect(tabsSendMessage).toHaveBeenCalledWith(1, expect.objectContaining({ type: 'DAPP_EVENT' }));
    expect(tabsSendMessage).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'DAPP_EVENT' }));
    expect(tabsSendMessage).toHaveBeenCalledWith(3, expect.objectContaining({ type: 'DAPP_EVENT' }));
  });

  it('wraps the DappEventEnvelope in a DappSwEventEnvelope (no targetOrigin)', async () => {
    const tabsQuery = vi.fn(async () => [{ id: 1 }] as chrome.tabs.Tab[]);
    const tabsSendMessage = vi.fn(async () => undefined);
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent);

    expect(tabsSendMessage).toHaveBeenCalledWith(1, {
      type: 'DAPP_EVENT',
      envelope: sampleEvent,
    });
  });

  it('includes targetOrigin in the envelope when provided', async () => {
    const tabsQuery = vi.fn(async () => [{ id: 1 }] as chrome.tabs.Tab[]);
    const tabsSendMessage = vi.fn(async () => undefined);
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent, 'https://uniswap.org');

    expect(tabsSendMessage).toHaveBeenCalledWith(1, {
      type: 'DAPP_EVENT',
      envelope: sampleEvent,
      targetOrigin: 'https://uniswap.org',
    });
  });

  it('skips tabs without a numeric id', async () => {
    const tabs = [
      { id: undefined },
      { id: 5, url: 'https://x' },
      { id: undefined, url: 'https://y' },
    ] as chrome.tabs.Tab[];
    const tabsQuery = vi.fn(async () => tabs);
    const tabsSendMessage = vi.fn(async () => undefined);
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent);

    expect(tabsSendMessage).toHaveBeenCalledTimes(1);
    expect(tabsSendMessage).toHaveBeenCalledWith(5, expect.anything());
  });

  it('silently swallows sendMessage errors (non-WDK tabs reject)', async () => {
    const tabs = [
      { id: 1 },
      { id: 2 },
    ] as chrome.tabs.Tab[];
    const tabsQuery = vi.fn(async () => tabs);
    const tabsSendMessage = vi.fn().mockImplementation(async (id: number) => {
      if (id === 1) throw new Error('Could not establish connection. Receiving end does not exist.');
      return undefined;
    });
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await expect(bus.broadcast(sampleEvent)).resolves.toBeUndefined();
    expect(tabsSendMessage).toHaveBeenCalledTimes(2);
  });

  it('waits for all sends before resolving', async () => {
    const tabsQuery = vi.fn(async () => [{ id: 1 }, { id: 2 }] as chrome.tabs.Tab[]);
    let resolved = 0;
    const tabsSendMessage = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 1));
      resolved += 1;
    });
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent);
    expect(resolved).toBe(2);
  });

  it('handles empty tabs array', async () => {
    const tabsQuery = vi.fn(async () => [] as chrome.tabs.Tab[]);
    const tabsSendMessage = vi.fn(async () => undefined);
    const bus = createDappEventBus({ tabsQuery, tabsSendMessage });

    await bus.broadcast(sampleEvent);
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });
});