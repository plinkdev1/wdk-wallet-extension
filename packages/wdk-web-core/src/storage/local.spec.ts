import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLocal, setLocal, removeLocal, clearLocal, STORAGE_DEFAULTS } from './index.js';

// Mock chrome.storage.local — chrome is not defined in the Vitest jsdom env,
// so we install a minimal in-memory mock for these unit tests. Phase 0 Test 09
// validated the real chrome.storage.local in an actual MV3 SW context.

type StorageMap = Record<string, unknown>;

function installChromeStorageMock(): StorageMap {
  const store: StorageMap = {};
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (entries: StorageMap) => {
          Object.assign(store, entries);
        }),
        remove: vi.fn(async (key: string) => {
          delete store[key];
        }),
        clear: vi.fn(async () => {
          for (const k of Object.keys(store)) delete store[k];
        }),
      },
    },
  };
  return store;
}

describe('storage/local (chrome.storage.local typed wrapper)', () => {
  beforeEach(() => {
    installChromeStorageMock();
  });

  it('setLocal then getLocal round-trips a typed value', async () => {
    await setLocal('prefs:autoLockMinutes', 7);
    const value = await getLocal('prefs:autoLockMinutes');
    expect(value).toBe(7);
  });

  it('getLocal returns undefined for an unset key', async () => {
    const value = await getLocal('wallet:active');
    expect(value).toBeUndefined();
  });

  it('removeLocal deletes a previously-set key', async () => {
    await setLocal('lock:state', 'unlocked');
    expect(await getLocal('lock:state')).toBe('unlocked');
    await removeLocal('lock:state');
    expect(await getLocal('lock:state')).toBeUndefined();
  });

  it('clearLocal wipes all keys', async () => {
    await setLocal('lock:state', 'unlocked');
    await setLocal('prefs:theme', 'dark');
    await clearLocal();
    expect(await getLocal('lock:state')).toBeUndefined();
    expect(await getLocal('prefs:theme')).toBeUndefined();
  });

  it('STORAGE_DEFAULTS provides a complete schema-shaped initializer', () => {
    expect(STORAGE_DEFAULTS['wallet:active']).toBeNull();
    expect(STORAGE_DEFAULTS['lock:state']).toBe('locked');
    expect(STORAGE_DEFAULTS['prefs:theme']).toBe('system');
    expect(STORAGE_DEFAULTS['prefs:autoLockMinutes']).toBe(5);
    expect(STORAGE_DEFAULTS['prefs:defaultChain']).toBe('plasma-mainnet');
    expect(STORAGE_DEFAULTS['prefs:relayerAdapter']).toBeNull();
    expect(STORAGE_DEFAULTS['connections:origins']).toEqual({});
    expect(STORAGE_DEFAULTS['wallets:list']).toEqual([]);
  });
});