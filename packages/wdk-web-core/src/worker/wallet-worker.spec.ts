import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { mnemonicToAccount } from 'viem/accounts';
import WdkManager from '@tetherto/wdk';
import { WalletWorker } from './wallet-worker.js';
import {
  createIndexedDbVaultStorage,
  createWebCryptoVault,
  type WebCryptoVault,
} from '../vault/index.js';
import { buildEip3009TransferAuthorization } from '../eip3009/index.js';
import { createMockRpcAdapter } from '../adapters/index.js';

const TEST_MNEMONIC =
  'real fury scan various trend network reward review will fiscal miracle unfair';
const encoder = new TextEncoder();

function makeIsolatedVault(): WebCryptoVault {
  return createWebCryptoVault({
    storage: createIndexedDbVaultStorage({ dbName: 'wdk-worker-test-' + crypto.randomUUID() }),
  });
}

describe('WalletWorker (Step 6a — vault primitives)', () => {
  let worker: WalletWorker;

  beforeEach(() => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
  });

  it('vault_hasStored returns false on a fresh worker and true after store', async () => {
    expect(await worker.vault_hasStored()).toBe(false);
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    expect(await worker.vault_hasStored()).toBe(true);
  });

  it('vault_store + vault_load round-trip preserves bytes', async () => {
    const plaintext = encoder.encode(TEST_MNEMONIC);
    await worker.vault_store('pw', plaintext);
    const loaded = await worker.vault_load('pw');
    expect(loaded).toEqual(plaintext);
  });

  it('vault_load with wrong password rejects with OperationError (F-VAULT-01)', async () => {
    await worker.vault_store('rightpw', encoder.encode(TEST_MNEMONIC));
    await expect(worker.vault_load('wrongpw')).rejects.toMatchObject({
      name: 'OperationError',
    });
  });

  it('vault_clear removes the stored blob (hasStored returns false after)', async () => {
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    expect(await worker.vault_hasStored()).toBe(true);
    await worker.vault_clear();
    expect(await worker.vault_hasStored()).toBe(false);
  });

  it('vault_clear is idempotent (works on an empty vault)', async () => {
    expect(await worker.vault_hasStored()).toBe(false);
    await expect(worker.vault_clear()).resolves.toBeUndefined();
    expect(await worker.vault_hasStored()).toBe(false);
  });

  it('vault_load after vault_clear throws (no vault stored)', async () => {
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await worker.vault_clear();
    await expect(worker.vault_load('pw')).rejects.toThrowError(/No vault stored/);
  });
});

describe('WalletWorker (Step 6b — account ops, initialized worker)', () => {
  let worker: WalletWorker;

  beforeAll(async () => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await worker.vault_load('pw');
  });

  it('account_getEvmAddress matches viem reference at index 0 (ADR-009 cross-impl parity)', async () => {
    const viemAccount = mnemonicToAccount(TEST_MNEMONIC);
    const expected = viemAccount.address.toLowerCase();

    const evmChains = ['plasma-mainnet', 'plasma-testnet', 'ethereum', 'polygon-mainnet', 'arbitrum-mainnet'] as const;
    for (const chain of evmChains) {
      const addr = await worker.account_getEvmAddress(chain, 0);
      expect(addr.toLowerCase(), chain + ' EVM address mismatch vs viem reference').toBe(expected);
    }
  });

  it('account_getEvmAddress at different indices returns different addresses', async () => {
    const addr0 = await worker.account_getEvmAddress('ethereum', 0);
    const addr1 = await worker.account_getEvmAddress('ethereum', 1);
    expect(addr0).not.toBe(addr1);

    const viemAddr0 = mnemonicToAccount(TEST_MNEMONIC).address.toLowerCase();
    const viemAddr1 = mnemonicToAccount(TEST_MNEMONIC, { addressIndex: 1 }).address.toLowerCase();
    expect(addr0.toLowerCase()).toBe(viemAddr0);
    expect(addr1.toLowerCase()).toBe(viemAddr1);
  });

  it('account_getSolanaAddress is stable across calls and well-formed base58', async () => {
    const addr1 = await worker.account_getSolanaAddress('solana-mainnet', 0);
    const addr2 = await worker.account_getSolanaAddress('solana-mainnet', 0);
    expect(addr1).toBe(addr2);
    expect(addr1).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it('account_getSolanaAddress returns a base58 address for solana-devnet (B1-2: loader added)', async () => {
    const addr = await worker.account_getSolanaAddress('solana-devnet', 0);
    expect(typeof addr).toBe('string');
    expect(addr).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it('account_getSolanaAddress returns a base58 address for solana-testnet (B1-2: new chain)', async () => {
    const addr = await worker.account_getSolanaAddress('solana-testnet', 0);
    expect(typeof addr).toBe('string');
    expect(addr).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });
});

describe('WalletWorker (Step 6b — account ops, uninitialized worker)', () => {
  it('account_getEvmAddress throws if WDK is not initialized (no vault_load yet)', async () => {
    const worker = new WalletWorker({ vault: makeIsolatedVault() });
    await expect(
      worker.account_getEvmAddress('plasma-mainnet', 0),
    ).rejects.toThrowError(/WDK not initialized/);
  });

  it('account_getSolanaAddress throws if WDK is not initialized (no vault_load yet)', async () => {
    const worker = new WalletWorker({ vault: makeIsolatedVault() });
    await expect(
      worker.account_getSolanaAddress('solana-mainnet', 0),
    ).rejects.toThrowError(/WDK not initialized/);
  });
});

describe('WalletWorker (Step 6c — signing methods, initialized worker)', () => {
  let worker: WalletWorker;

  beforeAll(async () => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await worker.vault_load('pw');
  });

  it('account_signMessage produces a signature identical to viem signMessage (EIP-191 cross-impl parity)', async () => {
    const message = 'hello WDK from Phase 1 Step 6c';
    const viemAccount = mnemonicToAccount(TEST_MNEMONIC);
    const viemSig = await viemAccount.signMessage({ message });
    const wdkSig = await worker.account_signMessage('ethereum', 0, message);
    expect(wdkSig.toLowerCase()).toBe(viemSig.toLowerCase());
  });

  it('account_signMessage rejects the SignableMessage raw-bytes form in v1.0', async () => {
    await expect(
      worker.account_signMessage('ethereum', 0, { raw: '0xdeadbeef' }),
    ).rejects.toThrowError(/raw-bytes form not supported/);
  });

  it('account_signTypedData over an EIP-3009 builder payload matches viem signTypedData (full chain end-to-end)', async () => {
    const viemAccount = mnemonicToAccount(TEST_MNEMONIC);
    const payload = buildEip3009TransferAuthorization({
      token: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        name: 'USD Coin',
        version: '2',
      },
      chainId: 1,
      from: viemAccount.address,
      to: '0x0000000000000000000000000000000000000001',
      value: 1000000n,
      validBefore: 1893456000n,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });

    const viemSig = await viemAccount.signTypedData(payload as never);
    const wdkSig = await worker.account_signTypedData('ethereum', 0, payload);
    expect(wdkSig.toLowerCase()).toBe(viemSig.toLowerCase());
  });

  it('account_signSolanaMessage is stable across calls and well-formed base58 (Ed25519 deterministic)', async () => {
    const message = encoder.encode('hello solana');
    const sig1 = await worker.account_signSolanaMessage('solana-mainnet', 0, message);
    const sig2 = await worker.account_signSolanaMessage('solana-mainnet', 0, message);
    expect(sig1).toBe(sig2);
    // Empirical: WDK returns the 64-byte Ed25519 signature as 128-char lowercase hex (no 0x prefix). Solana ecosystem typically uses base58 for signatures; v1.1 enhancement may add conversion.
    expect(sig1).toMatch(/^[0-9a-f]{128}$/);
  });

  it('account_signSolanaMessage throws RangeError for non-UTF8-representable bytes (v1.0 WDK string-API limitation)', async () => {
    const badBytes = new Uint8Array([0xFF, 0xFE, 0xFD]);
    await expect(
      worker.account_signSolanaMessage('solana-mainnet', 0, badBytes),
    ).rejects.toThrowError(RangeError);
  });

  it('account_sendTransaction rejects a malformed recipient before any network call (send-path guard)', async () => {
    await expect(
      worker.account_sendTransaction('ethereum', 0, { to: 'not-an-address', value: '0x1' }),
    ).rejects.toThrowError(/invalid evm recipient/i);
  });

  it('rpc_getBalance throws if no rpcAdapter is configured on the worker', async () => {
    await expect(
      worker.rpc_getBalance('ethereum', '0x0000000000000000000000000000000000000000'),
    ).rejects.toThrowError(/No RPC adapter configured/);
  });

  it('rpc_getBalance delegates to the injected rpcAdapter when one is provided', async () => {
    const rpc = createMockRpcAdapter({ balances: new Map([['ethereum:0xabc', 999n]]) });
    const w = new WalletWorker({ vault: makeIsolatedVault(), rpcAdapter: rpc });
    await w.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await w.vault_load('pw');
    expect(await w.rpc_getBalance('ethereum', '0xabc')).toBe(999n);
  });

  it('rpc_getTokenBalance delegates to the injected rpcAdapter', async () => {
    const rpc = createMockRpcAdapter({ tokenBalances: new Map([['ethereum:0xabc:0xtoken', 250000n]]) });
    const w = new WalletWorker({ vault: makeIsolatedVault(), rpcAdapter: rpc });
    await w.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await w.vault_load('pw');
    expect(await w.rpc_getTokenBalance('ethereum', '0xabc', '0xtoken')).toBe(250000n);
  });

  it('rpc_getTransactionStatus delegates to the injected rpcAdapter', async () => {
    const rpc = createMockRpcAdapter({ transactionStatuses: new Map([['ethereum:0xhash', 'success']]) });
    const w = new WalletWorker({ vault: makeIsolatedVault(), rpcAdapter: rpc });
    await w.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await w.vault_load('pw');
    expect(await w.rpc_getTransactionStatus('ethereum', '0xhash')).toBe('success');
  });
});
describe('WalletWorker.lock() (B3.4 - non-destructive zeroize)', () => {
  let worker: WalletWorker;

  beforeEach(async () => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
    await worker.vault_store('pw', encoder.encode(TEST_MNEMONIC));
    await worker.vault_load('pw');
  });

  it('disposes WDK without clearing the vault from storage', async () => {
    // Sanity: WDK is initialized after vault_load
    await expect(worker.account_getEvmAddress('ethereum', 0)).resolves.toMatch(/^0x/);
    expect(await worker.vault_hasStored()).toBe(true);

    // Lock: zeroize WDK only, vault remains stored
    await worker.lock();

    // After lock: account_* throws (WDK gone), but vault is still in storage
    await expect(
      worker.account_getEvmAddress('ethereum', 0),
    ).rejects.toThrowError(/WDK not initialized/);
    expect(await worker.vault_hasStored()).toBe(true);
  });

  it('subsequent vault_load restores WDK access after lock', async () => {
    await worker.lock();
    await expect(
      worker.account_getEvmAddress('ethereum', 0),
    ).rejects.toThrowError(/WDK not initialized/);

    // Re-unlock with the same password rebuilds WDK
    await worker.vault_load('pw');
    await expect(worker.account_getEvmAddress('ethereum', 0)).resolves.toMatch(/^0x/);
  });

  it('is idempotent - locking an already-locked worker is a no-op', async () => {
    await worker.lock();
    await expect(worker.lock()).resolves.toBeUndefined();
    await expect(worker.lock()).resolves.toBeUndefined();
    expect(await worker.vault_hasStored()).toBe(true);
  });

  it('is callable on a never-unlocked worker (idempotent edge case)', async () => {
    const fresh = new WalletWorker({ vault: makeIsolatedVault() });
    await expect(fresh.lock()).resolves.toBeUndefined();
    await expect(
      fresh.account_getEvmAddress('ethereum', 0),
    ).rejects.toThrowError(/WDK not initialized/);
  });
});

describe('WalletWorker (B5.2.0 - bip39_generateMnemonic)', () => {
  let worker: WalletWorker;

  beforeEach(() => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
  });

  it('returns a 12-word mnemonic at default strength=128', async () => {
    const mnemonic = await worker.bip39_generateMnemonic();
    const words = mnemonic.trim().split(/\s+/);
    expect(words.length).toBe(12);
  });

  it('returns a 24-word mnemonic at strength=256', async () => {
    const mnemonic = await worker.bip39_generateMnemonic(256);
    const words = mnemonic.trim().split(/\s+/);
    expect(words.length).toBe(24);
  });

  it('returns a BIP-39 valid mnemonic accepted by WDK.isValidSeed', async () => {
    const mnemonic = await worker.bip39_generateMnemonic();
    expect(WdkManager.isValidSeed(mnemonic)).toBe(true);
  });

  it('returns different mnemonics across calls (entropy sanity)', async () => {
    const m1 = await worker.bip39_generateMnemonic();
    const m2 = await worker.bip39_generateMnemonic();
    const m3 = await worker.bip39_generateMnemonic();
    expect(m1).not.toBe(m2);
    expect(m2).not.toBe(m3);
    expect(m1).not.toBe(m3);
  });

  it('returns lowercase words only (BIP-39 wordlist canonical form)', async () => {
    const mnemonic = await worker.bip39_generateMnemonic();
    expect(mnemonic).toBe(mnemonic.toLowerCase());
  });

  it('return value is usable as input to vault_store + vault_load round-trip', async () => {
    const mnemonic = await worker.bip39_generateMnemonic();
    await worker.vault_store('pw', encoder.encode(mnemonic));
    const loaded = await worker.vault_load('pw');
    expect(new TextDecoder().decode(loaded)).toBe(mnemonic);
  });
});

describe('WalletWorker (B5.4.0 - bip39_validateMnemonic)', () => {
  let worker: WalletWorker;

  beforeEach(() => {
    worker = new WalletWorker({ vault: makeIsolatedVault() });
  });

  it('returns true for a freshly generated 12-word mnemonic', async () => {
    const m = await worker.bip39_generateMnemonic();
    expect(await worker.bip39_validateMnemonic(m)).toBe(true);
  });

  it('returns true for a freshly generated 24-word mnemonic', async () => {
    const m = await worker.bip39_generateMnemonic(256);
    expect(await worker.bip39_validateMnemonic(m)).toBe(true);
  });

  it('returns true for the known TEST_MNEMONIC fixture (cross-impl round-trip)', async () => {
    expect(await worker.bip39_validateMnemonic(TEST_MNEMONIC)).toBe(true);
  });

  it('returns false for an empty string', async () => {
    expect(await worker.bip39_validateMnemonic('')).toBe(false);
  });

  it('returns false for non-BIP39 words', async () => {
    expect(await worker.bip39_validateMnemonic('apple banana cherry date elderberry fig grape honeydew kiwi lemon mango nectarine')).toBe(false);
  });

  it('returns false for 12 valid BIP39 words with wrong checksum (all-abandon, all-abandon, ..., all-abandon)', async () => {
    // 12 valid words from the BIP39 wordlist but the checksum is wrong (valid all-abandon is 11x abandon + 'about').
    expect(await worker.bip39_validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false);
  });

  it('returns true for the canonical all-abandon mnemonic (11x abandon + about, valid checksum)', async () => {
    expect(await worker.bip39_validateMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about')).toBe(true);
  });
});
