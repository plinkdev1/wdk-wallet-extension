import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletWorker } from './wallet-worker.js';
import {
  handleMv3Request,
  installMv3MessageHandler,
  isValidMv3Request,
  type ChromeMessageListener,
  type ChromeRuntimeMessageHook,
} from './mv3-handler.js';
import {
  createIndexedDbVaultStorage,
  createWebCryptoVault,
  type WebCryptoVault,
} from '../vault/index.js';

const encoder = new TextEncoder();
const TEST_MNEMONIC = 'real fury scan various trend network reward review will fiscal miracle unfair';

function makeIsolatedVault(): WebCryptoVault {
  return createWebCryptoVault({
    storage: createIndexedDbVaultStorage({ dbName: 'wdk-mv3-test-' + crypto.randomUUID() }),
  });
}

function makeFakeRuntime() {
  let registeredListener: ChromeMessageListener | null = null;
  const runtime: ChromeRuntimeMessageHook = {
    onMessage: {
      addListener(listener) {
        registeredListener = listener;
      },
    },
  };
  return {
    runtime,
    get listener() { return registeredListener; },
    async simulate(message: unknown): Promise<unknown> {
      return new Promise<unknown>((resolve) => {
        const result = registeredListener!(message, {}, resolve);
        if (result !== true) {
          resolve(undefined);
        }
      });
    },
  };
}

describe('mv3-handler (Step 8 — Extension SW dispatch per ADR-011)', () => {
  describe('isValidMv3Request', () => {
    it('accepts well-formed MV3Request envelopes', () => {
      expect(isValidMv3Request({ method: 'vault_hasStored', args: [], requestId: 'r1' })).toBe(true);
    });

    it('rejects null, undefined, and non-objects', () => {
      expect(isValidMv3Request(null)).toBe(false);
      expect(isValidMv3Request(undefined)).toBe(false);
      expect(isValidMv3Request('not an object')).toBe(false);
      expect(isValidMv3Request(42)).toBe(false);
    });

    it('rejects objects missing required envelope fields', () => {
      expect(isValidMv3Request({ method: 'vault_hasStored' })).toBe(false);
      expect(isValidMv3Request({ method: 'vault_hasStored', args: [] })).toBe(false);
      expect(isValidMv3Request({ args: [], requestId: 'r1' })).toBe(false);
      expect(isValidMv3Request({ method: 42, args: [], requestId: 'r1' })).toBe(false);
    });
  });

  describe('handleMv3Request (direct dispatch, no runtime)', () => {
    let worker: WalletWorker;

    beforeEach(() => {
      worker = new WalletWorker({ vault: makeIsolatedVault() });
    });

    it('wraps successful results in MV3Response with ok: true', async () => {
      const response = await handleMv3Request(worker, {
        method: 'vault_hasStored',
        args: [],
        requestId: 'r1',
      });
      expect(response).toMatchObject({
        requestId: 'r1',
        ok: true,
        result: false,
      });
    });

    it('wraps thrown errors in MV3ErrorResponse with ok: false and { name, message }', async () => {
      const response = await handleMv3Request(worker, {
        method: 'vault_load',
        args: ['pw'],
        requestId: 'r2',
      });
      expect(response).toMatchObject({
        requestId: 'r2',
        ok: false,
      });
      const err = (response as { error?: { name?: string; message?: string } }).error;
      expect(err?.name).toBe('Error');
      expect(err?.message).toMatch(/No vault stored/);
    });

    it('rejects method names not in the WalletWorkerApi whitelist (security boundary blocks Object.prototype methods)', async () => {
      const response = await handleMv3Request(worker, {
        method: 'toString' as never,
        args: [],
        requestId: 'r3',
      });
      expect(response).toMatchObject({
        requestId: 'r3',
        ok: false,
      });
      const err = (response as { error?: { message?: string } }).error;
      expect(err?.message).toMatch(/not allowed/);
    });

    it('preserves error names from underlying methods (e.g., OperationError from F-VAULT-01)', async () => {
      await worker.vault_store('rightpw', encoder.encode(TEST_MNEMONIC));
      const response = await handleMv3Request(worker, {
        method: 'vault_load',
        args: ['wrongpw'],
        requestId: 'r4',
      });
      expect(response).toMatchObject({
        requestId: 'r4',
        ok: false,
        error: { name: 'OperationError' },
      });
    });
  });

  describe('installMv3MessageHandler (chrome.runtime integration via fake runtime)', () => {
    let worker: WalletWorker;

    beforeEach(() => {
      worker = new WalletWorker({ vault: makeIsolatedVault() });
    });

    it('registers a listener synchronously on the runtime (F-MV3-01 invariant)', () => {
      const fake = makeFakeRuntime();
      expect(fake.listener).toBeNull();
      installMv3MessageHandler(worker, fake.runtime);
      expect(fake.listener).not.toBeNull();
    });

    it('round-trips a valid MV3 request through the listener to a response envelope', async () => {
      const fake = makeFakeRuntime();
      installMv3MessageHandler(worker, fake.runtime);

      const response = await fake.simulate({
        method: 'vault_hasStored',
        args: [],
        requestId: 'r1',
      });

      expect(response).toMatchObject({
        requestId: 'r1',
        ok: true,
        result: false,
      });
    });

    it('returns false from the listener for non-MV3 messages (lets other extension listeners claim them)', () => {
      const fake = makeFakeRuntime();
      installMv3MessageHandler(worker, fake.runtime);

      const sendResponseSpy = vi.fn();
      const returnValue = fake.listener!({ some: 'random message' }, {}, sendResponseSpy);

      expect(returnValue).toBe(false);
      expect(sendResponseSpy).not.toHaveBeenCalled();
    });

    it('preserves requestId across the dispatch envelope (correlation invariant)', async () => {
      const fake = makeFakeRuntime();
      installMv3MessageHandler(worker, fake.runtime);

      const response = await fake.simulate({
        method: 'vault_hasStored',
        args: [],
        requestId: 'unique-id-abc-123',
      });

      expect((response as { requestId: string }).requestId).toBe('unique-id-abc-123');
    });
  });
});