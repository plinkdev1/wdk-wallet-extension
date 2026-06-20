import type { Hex, SignableMessage } from 'viem';
import type {
  Base58Address,
  SolanaSignature,
  TypedDataPayload,
} from './accounts.js';
import type { BtcChainId, ChainId, EvmChainId, SolanaChainId, TonChainId, TronChainId } from './chains.js';

/**
 * WalletWorker API surface - the typed contract that wdk-web-core exposes to
 * consumer code via Comlink (Web Worker context) or chrome.runtime dispatch
 * (MV3 SW context).
 *
 * Flat naming convention: { domain }_{ action }(...args). Never nested.
 *
 * Why flat: Comlink wraps every intermediate property of a Remote in Promise.
 * Nesting (e.g., api.vault.store(...)) would require await (await api.vault).store(...)
 * at the call site. See ADR-010 "Why flat naming, not nested" for the full rationale.
 */
export interface WalletWorkerApi {
  // Vault operations
  vault_hasStored(): Promise<boolean>;
  vault_store(password: string, plaintext: Uint8Array): Promise<void>;
  vault_load(password: string): Promise<Uint8Array>;
  vault_clear(): Promise<void>;

  // EVM account operations
  account_getEvmAddress(chain: EvmChainId, index: number): Promise<Hex>;
  account_signMessage(chain: EvmChainId, index: number, message: SignableMessage): Promise<Hex>;
  account_signTypedData(chain: EvmChainId, index: number, payload: TypedDataPayload): Promise<Hex>;
  /**
   * Sign AND broadcast an EVM transaction atomically. Returns the transaction
   * hash. WDK's EVM account (built on viem) handles gas estimation, nonce
   * lookup, and broadcasting internally; the caller passes whatever subset
   * of fields the dApp provided.
   *
   * The tx parameter is intentionally loosely typed (Record<string, unknown>):
   * viem's strict SendTransactionParameters generic is chain-specific and
   * pinning it into this API surface would couple wdk-web-core's contract
   * to viem's release cadence (per ADR-010's "keep API dependency-free"
   * principle). Common fields the WDK EVM account understands: to, value,
   * data, gas/gasLimit, gasPrice/maxFeePerGas/maxPriorityFeePerGas, nonce,
   * from. WDK fills in missing optional fields during prepareTransaction.
   *
   * Per PRD 01 Addendum S12.4 v1.0 eth_sendTransaction.
   */
  account_sendTransaction(chain: EvmChainId, index: number, tx: Record<string, unknown>): Promise<Hex>;

  /** Sends native SOL (value in lamports) on a Solana chain; returns the base58 signature. */
  account_sendSolanaTransaction(chain: SolanaChainId, index: number, to: string, value: bigint): Promise<string>;

  /** Derives the BIP-84 native-segwit Bitcoin address at an index (offline). */
  account_getBtcAddress(chain: BtcChainId, index: number): Promise<string>;
  /** Reads the account's confirmed Bitcoin balance in satoshis. */
  account_getBtcBalance(chain: BtcChainId, index: number): Promise<bigint>;
  /** Sends native BTC (value in satoshis) on a Bitcoin chain; returns the txid. */
  account_sendBtcTransaction(chain: BtcChainId, index: number, to: string, value: bigint, confirmationTarget?: number): Promise<string>;

  /** Returns the account's TON (v5r1) address. */
  account_getTonAddress(chain: TonChainId, index: number): Promise<string>;
  /** Reads the account's TON balance in nanotons. */
  account_getTonBalance(chain: TonChainId, index: number): Promise<bigint>;
  /** Sends native TON (value in nanotons) on a TON chain; returns the tx hash. */
  account_sendTonTransaction(chain: TonChainId, index: number, to: string, value: bigint): Promise<string>;

  /** Returns the account's Tron (base58) address. */
  account_getTronAddress(chain: TronChainId, index: number): Promise<string>;
  /** Reads the account's Tron balance in sun. */
  account_getTronBalance(chain: TronChainId, index: number): Promise<bigint>;
  /** Sends native TRX (value in sun) on a Tron chain; returns the tx hash. */
  account_sendTronTransaction(chain: TronChainId, index: number, to: string, value: bigint): Promise<string>;

  // Solana account operations
  account_getSolanaAddress(chain: SolanaChainId, index: number): Promise<Base58Address>;
  account_signSolanaMessage(chain: SolanaChainId, index: number, message: Uint8Array): Promise<SolanaSignature>;

  // BIP-39 mnemonic generation
  /**
   * Generate a new BIP-39 mnemonic phrase.
   *
   * strength=128 (default): 12 words, 128 bits of entropy. Standard wallet
   * strength; matches MetaMask / Phantom / Coinbase Wallet defaults.
   * strength=256: 24 words, 256 bits of entropy. Optional higher-strength
   * mode for users who want it; not exposed in the v0.1 popup UI.
   *
   * The mnemonic IS the wallet's root secret. Treat the return value with
   * the same care as a private key - it must not leave the secure execution
   * context (Worker / SW) until the user explicitly chooses to display it
   * during onboarding.
   *
   * Architectural choice: bip39 generation lives in the worker (not in
   * popup-context code) so the bip39 library + entropy source stays inside
   * the SW boundary. The popup gets the resulting string for display/verify
   * but cannot independently summon new entropy. Per ADR-001 + ADR-006.
   */
  bip39_generateMnemonic(strength?: 128 | 256): Promise<string>;

  /**
   * Validate that a string is a well-formed BIP-39 mnemonic (correct word list,
   * correct word count, valid checksum).
   *
   * Used by the import-mnemonic UX (B5.4) to gate vault_store on the user-pasted
   * phrase. Returning false here is the only safe place to fail import - vault_store
   * itself just stores arbitrary bytes; a malformed mnemonic would silently produce
   * unusable addresses downstream.
   *
   * Pure function: does not touch the vault, does not modify any state. Safe to
   * call multiple times.
   */
  bip39_validateMnemonic(mnemonic: string): Promise<boolean>;

  // RPC operations
  rpc_getBalance(chain: ChainId, address: string): Promise<bigint>;
  rpc_getTokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint>;
  rpc_getTransactionStatus(chain: ChainId, hash: string): Promise<'pending' | 'success' | 'failed'>;

  /** USD price for an asset symbol (e.g. 'ETH', 'BTC') via CoinGecko; null if unknown/unavailable. */
  pricing_getUsdPrice(symbol: string): Promise<number | null>;
}

/**
 * MV3 message envelope shape - used by the browser extension's
 * chrome.runtime.sendMessage dispatch (alternative path to Comlink for the
 * MV3 service worker context, per ADR-011).
 *
 * Comlink cannot be used in the MV3 SW because its wrapping defers listener
 * registration to a microtask, violating Chrome's synchronous-listener
 * requirement at SW startup. See ADR-011 "Why not alternative patterns".
 */
export interface MV3Request<M extends keyof WalletWorkerApi = keyof WalletWorkerApi> {
  readonly method: M;
  readonly args: Parameters<WalletWorkerApi[M]>;
  readonly requestId: string;
}

/** MV3 successful response envelope. */
export interface MV3Response<M extends keyof WalletWorkerApi = keyof WalletWorkerApi> {
  readonly requestId: string;
  readonly ok: true;
  readonly result: Awaited<ReturnType<WalletWorkerApi[M]>>;
}

/** MV3 error response envelope. */
export interface MV3ErrorResponse {
  readonly requestId: string;
  readonly ok: false;
  readonly error: {
    readonly name: string;
    readonly message: string;
  };
}