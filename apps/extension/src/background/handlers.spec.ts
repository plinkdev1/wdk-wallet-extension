/**
 * handlers.spec.ts (B3.4b rewrite)
 *
 * Validates that createSwHandlers correctly routes each WalletMessage to
 * the right WalletWorker method AND atomically updates engine lock state
 * for the three state-mutating ops (VAULT_LOAD, LOCK, VAULT_CLEAR).
 *
 * The worker is mocked: handlers are pure transport adapters and should
 * not depend on real worker internals. The integration with a real
 * WalletWorker is covered by wdk-web-core's wallet-worker.spec.ts (81
 * tests including round-trip vault + cross-impl signing parity vs viem).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSwHandlers } from './handlers.js';
import { createEngine } from './engine.js';
import { createApprovalFlow } from './approval-flow.js';
import { createConnectionState } from './connection-state.js';

// B4.6: handlers.ts VAULT_CLEAR now calls connectionState.revokeAll() which
// hits chrome.storage.local. Stub it globally so the test runs in node env.
const storageMock = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
};
vi.stubGlobal('chrome', { storage: { local: storageMock } });
import type { WalletEngine } from './engine.js';
import type { WalletWorker } from '@wdk-starter/wdk-web-core/worker';

function createMockWorker() {
  // Typed impls so vi.fn infers the calls tuple shape. Without param types,
  // vi.fn assumes zero-arg and mock.calls[0] is typed as `[]`, which makes
  // indexing fail under strict TS (L-TS-07). The impl signature is the
  // mock's signature.
  return {
    vault_hasStored: vi.fn(async (): Promise<boolean> => true),
    vault_store: vi.fn(async (_pw: string, _bytes: Uint8Array): Promise<void> => undefined),
    vault_load: vi.fn(async (_pw: string): Promise<Uint8Array> => new Uint8Array([0xab, 0xcd])),
    vault_clear: vi.fn(async (): Promise<void> => undefined),
    lock: vi.fn(async (): Promise<void> => undefined),
    account_getEvmAddress: vi.fn(async (_chain: string, _idx: number): Promise<`0x${string}`> => '0xabc'),
    account_getSolanaAddress: vi.fn(async (_chain: string, _idx: number): Promise<string> => 'somebase58addr'),
    account_signMessage: vi.fn(async (_chain: string, _idx: number, _msg: string): Promise<`0x${string}`> => '0xdeadbeef'),
    account_signTypedData: vi.fn(async (_chain: string, _idx: number, _payload: unknown): Promise<`0x${string}`> => '0xdead'),
    account_signSolanaMessage: vi.fn(async (_chain: string, _idx: number, _bytes: Uint8Array): Promise<string> => 'sighex'),
    rpc_getBalance: vi.fn(async (_chain: string, _addr: string): Promise<bigint> => 999n),
    bip39_generateMnemonic: vi.fn(async (): Promise<string> => 'mock word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11'),
  };
}

type MockWorker = ReturnType<typeof createMockWorker>;

describe('createSwHandlers (B3.4b - wired to WalletWorker)', () => {
  let engine: WalletEngine;
  let worker: MockWorker;

  beforeEach(() => {
    engine = createEngine();
    worker = createMockWorker();
  });

  function makeHandlers() {
    return createSwHandlers({ engine, worker: worker as unknown as WalletWorker, approvalFlow: createApprovalFlow(), connectionState: createConnectionState() });
  }

  // ----- Health -----

  describe('PING', () => {
    it('returns pong without touching engine or worker', async () => {
      const handlers = makeHandlers();
      const result = await handlers.PING!({ type: 'PING' });
      expect(result).toBe('pong');
    });
  });

  describe('GET_LOCK_STATE', () => {
    it('returns "locked" on a fresh engine', async () => {
      const handlers = makeHandlers();
      const result = await handlers.GET_LOCK_STATE!({ type: 'GET_LOCK_STATE' });
      expect(result).toBe('locked');
    });

    it('returns "unlocked" after VAULT_LOAD', async () => {
      const handlers = makeHandlers();
      await handlers.VAULT_LOAD!({ type: 'VAULT_LOAD', password: 'pw' });
      const result = await handlers.GET_LOCK_STATE!({ type: 'GET_LOCK_STATE' });
      expect(result).toBe('unlocked');
    });
  });

  // ----- LOCK (state-mutating) -----

  describe('LOCK', () => {
    it('calls worker.lock() AND transitions engine to locked', async () => {
      const handlers = makeHandlers();
      // Unlock first
      await handlers.VAULT_LOAD!({ type: 'VAULT_LOAD', password: 'pw' });
      expect(engine.getLockState()).toBe('unlocked');

      // Then lock
      const result = await handlers.LOCK!({ type: 'LOCK' });
      expect(result).toEqual({ ok: true });
      expect(worker.lock).toHaveBeenCalledOnce();
      expect(engine.getLockState()).toBe('locked');
    });

    it('is idempotent on an already-locked engine', async () => {
      const handlers = makeHandlers();
      const result = await handlers.LOCK!({ type: 'LOCK' });
      expect(result).toEqual({ ok: true });
      expect(worker.lock).toHaveBeenCalledOnce();
      expect(engine.getLockState()).toBe('locked');
    });
  });

  // ----- Vault primitives -----

  describe('VAULT_HAS_STORED', () => {
    it('delegates to worker.vault_hasStored', async () => {
      worker.vault_hasStored.mockResolvedValueOnce(true);
      const handlers = makeHandlers();
      const result = await handlers.VAULT_HAS_STORED!({ type: 'VAULT_HAS_STORED' });
      expect(result).toBe(true);
      expect(worker.vault_hasStored).toHaveBeenCalledOnce();
    });
  });

  describe('VAULT_STORE', () => {
    it('encodes mnemonic to UTF-8 bytes and calls worker.vault_store', async () => {
      const handlers = makeHandlers();
      const mnemonic = 'real fury scan various trend network reward review will fiscal miracle unfair';
      await handlers.VAULT_STORE!({
        type: 'VAULT_STORE',
        password: 'pw',
        mnemonic,
      });
      expect(worker.vault_store).toHaveBeenCalledOnce();
      const call = worker.vault_store.mock.calls[0]!;
      expect(call[0]).toBe('pw');
      expect(call[1]).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(call[1] as Uint8Array)).toBe(mnemonic);
    });

    it('does NOT update engine state (store does not imply unlock)', async () => {
      const handlers = makeHandlers();
      await handlers.VAULT_STORE!({
        type: 'VAULT_STORE',
        password: 'pw',
        mnemonic: 'phrase',
      });
      expect(engine.getLockState()).toBe('locked');
    });
  });

  describe('VAULT_LOAD', () => {
    it('calls worker.vault_load AND unlocks engine', async () => {
      const handlers = makeHandlers();
      const result = await handlers.VAULT_LOAD!({ type: 'VAULT_LOAD', password: 'pw' });
      expect(result).toEqual({ ok: true });
      expect(worker.vault_load).toHaveBeenCalledWith('pw');
      expect(engine.getLockState()).toBe('unlocked');
    });

    it('leaves engine LOCKED if worker.vault_load throws (wrong password)', async () => {
      worker.vault_load.mockRejectedValueOnce(
        Object.assign(new Error('wrong password'), { name: 'OperationError' }),
      );
      const handlers = makeHandlers();
      await expect(
        handlers.VAULT_LOAD!({ type: 'VAULT_LOAD', password: 'bad' }),
      ).rejects.toMatchObject({ name: 'OperationError' });
      // F-VAULT-01 wrong-password path: engine state untouched
      expect(engine.getLockState()).toBe('locked');
    });
  });

  describe('VAULT_CLEAR', () => {
    it('calls worker.vault_clear AND transitions engine to locked', async () => {
      const handlers = makeHandlers();
      // Unlock first so the lock transition is observable
      await handlers.VAULT_LOAD!({ type: 'VAULT_LOAD', password: 'pw' });
      expect(engine.getLockState()).toBe('unlocked');

      const result = await handlers.VAULT_CLEAR!({ type: 'VAULT_CLEAR' });
      expect(result).toEqual({ ok: true });
      expect(worker.vault_clear).toHaveBeenCalledOnce();
      expect(engine.getLockState()).toBe('locked');
    });
  });

  describe('Connections management', () => {
    it('lists connected dApps and revokes them', async () => {
      const connectionState = createConnectionState();
      await connectionState.load();
      await connectionState.approve('https://app.example.org', ['ethereum'] as never, [0]);
      const handlers = createSwHandlers({
        engine,
        worker: worker as unknown as WalletWorker,
        approvalFlow: createApprovalFlow(),
        connectionState,
      });

      const list = await handlers.CONNECTIONS_LIST!({ type: 'CONNECTIONS_LIST' });
      expect(list).toHaveLength(1);
      expect(list[0]!.origin).toBe('https://app.example.org');

      const revoked = await handlers.CONNECTIONS_REVOKE!({ type: 'CONNECTIONS_REVOKE', origin: 'https://app.example.org' });
      expect(revoked).toEqual({ ok: true });
      expect(await handlers.CONNECTIONS_LIST!({ type: 'CONNECTIONS_LIST' })).toHaveLength(0);

      const missing = await handlers.CONNECTIONS_REVOKE!({ type: 'CONNECTIONS_REVOKE', origin: 'https://nope.example' });
      expect(missing).toEqual({ ok: false });
    });
  });

  // ----- Account ops (pure delegation) -----

  describe('ACCOUNT_GET_EVM_ADDRESS', () => {
    it('delegates chain + accountIndex to worker.account_getEvmAddress', async () => {
      const handlers = makeHandlers();
      const result = await handlers.ACCOUNT_GET_EVM_ADDRESS!({
        type: 'ACCOUNT_GET_EVM_ADDRESS',
        chain: 'ethereum',
        accountIndex: 0,
      });
      expect(result).toBe('0xabc');
      expect(worker.account_getEvmAddress).toHaveBeenCalledWith('ethereum', 0);
    });
  });

  describe('ACCOUNT_GET_SOLANA_ADDRESS', () => {
    it('delegates to worker.account_getSolanaAddress with the SolanaChainId', async () => {
      const handlers = makeHandlers();
      const result = await handlers.ACCOUNT_GET_SOLANA_ADDRESS!({
        type: 'ACCOUNT_GET_SOLANA_ADDRESS',
        chain: 'solana-mainnet',
        accountIndex: 0,
      });
      expect(result).toBe('somebase58addr');
      expect(worker.account_getSolanaAddress).toHaveBeenCalledWith('solana-mainnet', 0);
    });
  });

  describe('ACCOUNT_SIGN_MESSAGE', () => {
    it('delegates EVM chains to worker.account_signMessage', async () => {
      const handlers = makeHandlers();
      const result = await handlers.ACCOUNT_SIGN_MESSAGE!({
        type: 'ACCOUNT_SIGN_MESSAGE',
        chain: 'plasma-mainnet',
        accountIndex: 0,
        message: 'hello',
      });
      expect(result).toBe('0xdeadbeef');
      expect(worker.account_signMessage).toHaveBeenCalledWith('plasma-mainnet', 0, 'hello');
    });

    it('throws if chain is a Solana chain (must use ACCOUNT_SIGN_SOLANA_MESSAGE)', async () => {
      const handlers = makeHandlers();
      await expect(
        handlers.ACCOUNT_SIGN_MESSAGE!({
          type: 'ACCOUNT_SIGN_MESSAGE',
          chain: 'solana-mainnet',
          accountIndex: 0,
          message: 'hello',
        }),
      ).rejects.toThrowError(/Use ACCOUNT_SIGN_SOLANA_MESSAGE/);
      expect(worker.account_signMessage).not.toHaveBeenCalled();
    });
  });

  describe('ACCOUNT_SIGN_TYPED_DATA', () => {
    it('passes payload through to worker.account_signTypedData as-is', async () => {
      const handlers = makeHandlers();
      const payload = { domain: {}, types: {}, message: {}, primaryType: 'X' };
      const result = await handlers.ACCOUNT_SIGN_TYPED_DATA!({
        type: 'ACCOUNT_SIGN_TYPED_DATA',
        chain: 'ethereum',
        accountIndex: 0,
        payload,
      });
      expect(result).toBe('0xdead');
      expect(worker.account_signTypedData).toHaveBeenCalledWith('ethereum', 0, payload);
    });
  });

  describe('ACCOUNT_SIGN_SOLANA_MESSAGE', () => {
    it('encodes string message to UTF-8 Uint8Array before calling worker', async () => {
      const handlers = makeHandlers();
      const message = 'sign this';
      await handlers.ACCOUNT_SIGN_SOLANA_MESSAGE!({
        type: 'ACCOUNT_SIGN_SOLANA_MESSAGE',
        chain: 'solana-mainnet',
        accountIndex: 0,
        message,
      });
      expect(worker.account_signSolanaMessage).toHaveBeenCalledOnce();
      const call = worker.account_signSolanaMessage.mock.calls[0]!;
      expect(call[0]).toBe('solana-mainnet');
      expect(call[1]).toBe(0);
      expect(call[2]).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(call[2] as Uint8Array)).toBe(message);
    });
  });

  // ----- RPC -----

  describe('RPC_GET_BALANCE', () => {
    it('delegates chain + address to worker.rpc_getBalance', async () => {
      const handlers = makeHandlers();
      const result = await handlers.RPC_GET_BALANCE!({
        type: 'RPC_GET_BALANCE',
        chain: 'ethereum',
        address: '0xdef',
      });
      expect(result).toBe('999');
      expect(worker.rpc_getBalance).toHaveBeenCalledWith('ethereum', '0xdef');
    });
  });
});

describe('BIP39_GENERATE_MNEMONIC', () => {
  let engine: WalletEngine;
  let worker: MockWorker;

  beforeEach(() => {
    engine = createEngine();
    worker = createMockWorker();
  });

  function makeHandlers() {
    return createSwHandlers({ engine, worker: worker as unknown as WalletWorker, approvalFlow: createApprovalFlow(), connectionState: createConnectionState() });
  }

  it('delegates to worker.bip39_generateMnemonic and returns the result', async () => {
    const handlers = makeHandlers();
    const result = await handlers.BIP39_GENERATE_MNEMONIC!({ type: 'BIP39_GENERATE_MNEMONIC' });
    expect(worker.bip39_generateMnemonic).toHaveBeenCalledTimes(1);
    expect(result).toBe('mock word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11');
  });

  it('does not modify engine lock state', async () => {
    const handlers = makeHandlers();
    expect(engine.getLockState()).toBe('locked');
    await handlers.BIP39_GENERATE_MNEMONIC!({ type: 'BIP39_GENERATE_MNEMONIC' });
    expect(engine.getLockState()).toBe('locked');
  });
});
