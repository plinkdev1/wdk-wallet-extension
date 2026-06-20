/**
 * ConnectionState tests. Mocks chrome.storage.local globally so tests run
 * in the default node environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionState, createConnectionState, type ConnectionEntry } from './connection-state.js';

const storageStore = new Map<string, unknown>();
const storageMock = {
  get: vi.fn((key: string) => {
    const result: Record<string, unknown> = {};
    if (storageStore.has(key)) {
      result[key] = storageStore.get(key);
    }
    return Promise.resolve(result);
  }),
  set: vi.fn((items: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(items)) {
      storageStore.set(k, v);
    }
    return Promise.resolve();
  }),
};
vi.stubGlobal('chrome', { storage: { local: storageMock } });

describe('ConnectionState', () => {
  beforeEach(() => {
    storageStore.clear();
    storageMock.get.mockClear();
    storageMock.set.mockClear();
  });

  it('load() reads from chrome.storage.local at the schema-versioned key', async () => {
    const state = new ConnectionState();
    await state.load();
    expect(storageMock.get).toHaveBeenCalledWith('wdk-connections-v1');
  });

  it('load() populates from existing data', async () => {
    storageStore.set('wdk-connections-v1', {
      'https://uniswap.org': {
        origin: 'https://uniswap.org',
        chains: ['ethereum'],
        accountIndices: [0],
        approvedAt: 100,
      },
    });
    const state = new ConnectionState();
    await state.load();
    expect(state.isConnected('https://uniswap.org')).toBe(true);
    expect(state.getApprovedAccounts('https://uniswap.org')).toEqual([0]);
    expect(state.getApprovedChains('https://uniswap.org')).toEqual(['ethereum']);
  });

  it('load() filters out malformed entries', async () => {
    storageStore.set('wdk-connections-v1', {
      'https://good.com': {
        origin: 'https://good.com',
        chains: ['ethereum'],
        accountIndices: [0],
        approvedAt: 1,
      },
      'https://bad.com': { junk: true }, // missing required fields
      'https://nullish.com': null,
    });
    const state = new ConnectionState();
    await state.load();
    expect(state.isConnected('https://good.com')).toBe(true);
    expect(state.isConnected('https://bad.com')).toBe(false);
    expect(state.isConnected('https://nullish.com')).toBe(false);
  });

  it('load() is idempotent - second call does not re-read storage', async () => {
    const state = new ConnectionState();
    await state.load();
    await state.load();
    expect(storageMock.get).toHaveBeenCalledTimes(1);
  });

  it('load() coalesces concurrent calls via shared Promise', async () => {
    const state = new ConnectionState();
    await Promise.all([state.load(), state.load(), state.load()]);
    expect(storageMock.get).toHaveBeenCalledTimes(1);
  });

  it('queries throw if load() has not been called', () => {
    const state = new ConnectionState();
    expect(() => state.isConnected('any')).toThrow(/load\(\) must be called/);
    expect(() => state.getApprovedAccounts('any')).toThrow(/load\(\) must be called/);
    expect(() => state.list()).toThrow(/load\(\) must be called/);
  });

  it('isConnected returns false for unknown origin', async () => {
    const state = new ConnectionState();
    await state.load();
    expect(state.isConnected('https://nope.com')).toBe(false);
  });

  it('approve() persists the entry and sets approvedAt timestamp', async () => {
    const state = new ConnectionState();
    await state.load();
    const entry = await state.approve('https://uniswap.org', ['ethereum'], [0]);
    expect(entry.origin).toBe('https://uniswap.org');
    expect(entry.chains).toEqual(['ethereum']);
    expect(entry.accountIndices).toEqual([0]);
    expect(typeof entry.approvedAt).toBe('number');
    expect(entry.approvedAt).toBeGreaterThan(0);

    expect(storageMock.set).toHaveBeenCalled();
    const savedRoot = storageStore.get('wdk-connections-v1') as Record<string, ConnectionEntry>;
    expect(savedRoot['https://uniswap.org']?.accountIndices).toEqual([0]);
  });

  it('approve() overwrites existing entry for the same origin', async () => {
    const state = new ConnectionState();
    await state.load();
    await state.approve('https://uniswap.org', ['ethereum'], [0]);
    await state.approve('https://uniswap.org', ['ethereum', 'polygon-mainnet'], [0, 1]);
    expect(state.getApprovedAccounts('https://uniswap.org')).toEqual([0, 1]);
    expect(state.getApprovedChains('https://uniswap.org')).toEqual(['ethereum', 'polygon-mainnet']);
  });

  it('revoke() removes the entry and returns true', async () => {
    const state = new ConnectionState();
    await state.load();
    await state.approve('https://uniswap.org', ['ethereum'], [0]);
    expect(await state.revoke('https://uniswap.org')).toBe(true);
    expect(state.isConnected('https://uniswap.org')).toBe(false);
  });

  it('revoke() returns false for unknown origin (no save)', async () => {
    const state = new ConnectionState();
    await state.load();
    storageMock.set.mockClear();
    expect(await state.revoke('https://nope.com')).toBe(false);
    expect(storageMock.set).not.toHaveBeenCalled();
  });

  it('revokeAll() clears all connections and persists empty state', async () => {
    const state = new ConnectionState();
    await state.load();
    await state.approve('https://a.com', ['ethereum'], [0]);
    await state.approve('https://b.com', ['polygon-mainnet'], [0]);
    expect(state.list()).toHaveLength(2);

    await state.revokeAll();
    expect(state.list()).toEqual([]);
    expect(storageStore.get('wdk-connections-v1')).toEqual({});
  });

  it('createConnectionState() returns a fresh ConnectionState instance', () => {
    const a = createConnectionState();
    const b = createConnectionState();
    expect(a).toBeInstanceOf(ConnectionState);
    expect(b).not.toBe(a);
  });
});