/**
 * @wdk-starter/wdk-web-core/worker - WalletWorker class
 *
 * Implements the WalletWorkerApi flat-method contract from ADR-010. Step 6
 * complete: vault_* primitives (6a), account address derivation (6b),
 * signing methods + rpc_getBalance stub (6c). The Comlink expose bootstrap
 * lives in entry.ts and runs only in actual worker host contexts.
 *
 * F-WDK-06 (Solana address surface gap) and F-WDK-04 (pnpm dedupe nominality)
 * are mitigated via casts at the wdk.getAccount boundary; see method JSDoc.
 *
 * v1.0 limitations carried forward to v1.1:
 *  - SignableMessage's raw-bytes form not supported in account_signMessage
 *    (WDK exposes sign(string) only; raw form would need WDK API change)
 *  - account_signSolanaMessage requires UTF-8 representable bytes (same
 *    WDK string-only API constraint applied to the Solana side)
 *  - rpc_getBalance throws "deferred to Step 10" - the RPC adapter layer
 *    lands in kickoff Part V Step 10 (RPC + Indexer adapters)
 *
 * Style note: the Pick<...> implements clause below is intentionally one
 * long line - multi-line TS generic syntax does not survive PS 5.1
 * here-strings reliably (Step 1 lesson, commit 47bb178).
 */

import WdkManager from '@tetherto/wdk';
import * as bip39 from 'bip39';
import bs58 from 'bs58';
import type { Hex, SignableMessage } from 'viem';
import {
  createWebCryptoVault,
  type WebCryptoVault,
} from '../vault/index.js';
import {
  ensureChainRegistered,
  isSupportedChainId,
} from '../chains/index.js';
import type { RpcAdapter, TransactionStatus } from '../adapters/index.js';
import { CoingeckoPricingClient } from '@tetherto/wdk-pricing-coingecko-http';
import type {
  Base58Address,
  BtcChainId,
  ChainId,
  EvmChainId,
  SolanaChainId,
  TonChainId,
  TronChainId,
  SolanaSignature,
  TypedDataPayload,
  WalletWorkerApi,
} from '../types/index.js';

export interface WalletWorkerOptions {
  readonly vault?: WebCryptoVault;
  /** Optional RPC adapter for rpc_getBalance. If omitted, rpc_getBalance throws. */
  readonly rpcAdapter?: RpcAdapter;
}

/** Symbol → CoinGecko id for USD pricing. Small by design; extend as assets are added. */
const COIN_IDS: Record<string, string> = {
  BTC: 'bitcoin', TBTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
  TON: 'the-open-network', TRX: 'tron', MATIC: 'matic-network', POL: 'matic-network',
  BNB: 'binancecoin', AVAX: 'avalanche-2', XDAI: 'xdai', CELO: 'celo',
  MNT: 'mantle', GLMR: 'moonbeam', MOVR: 'moonriver', CRO: 'crypto-com-chain',
  METIS: 'metis-token', BERA: 'berachain-bera', USDT: 'tether', XAUT: 'tether-gold',
};

let _pricingClient: CoingeckoPricingClient | null = null;
function getPricingClient(): CoingeckoPricingClient {
  if (!_pricingClient) _pricingClient = new CoingeckoPricingClient({ coinIds: COIN_IDS });
  return _pricingClient;
}

export class WalletWorker implements Pick<WalletWorkerApi, 'vault_hasStored' | 'vault_store' | 'vault_load' | 'vault_clear' | 'account_getEvmAddress' | 'account_getSolanaAddress' | 'account_signMessage' | 'account_signTypedData' | 'account_signSolanaMessage' | 'account_sendTransaction' | 'account_sendSolanaTransaction' | 'account_getBtcAddress' | 'account_getBtcBalance' | 'account_sendBtcTransaction' | 'account_getTonAddress' | 'account_getTonBalance' | 'account_sendTonTransaction' | 'account_getTronAddress' | 'account_getTronBalance' | 'account_sendTronTransaction' | 'rpc_getBalance' | 'rpc_getTokenBalance' | 'rpc_getTransactionStatus' | 'pricing_getUsdPrice' | 'bip39_generateMnemonic' | 'bip39_validateMnemonic'> {
  private readonly vault: WebCryptoVault;
  private readonly rpcAdapter: RpcAdapter | null;
  private wdk: WdkManager | null = null;

  constructor(options: WalletWorkerOptions = {}) {
    this.vault = options.vault ?? createWebCryptoVault();
    this.rpcAdapter = options.rpcAdapter ?? null;
  }

  /**
   * Generate a new BIP-39 mnemonic phrase. See WalletWorkerApi JSDoc for
   * the full security framing. Uses @scure/bip39 (audited, pure-JS noble
   * stack) with the English wordlist.
   *
   * Returns a space-separated lowercase mnemonic string ready to display
   * to the user or hand to vault_store via UTF-8 encoding.
   */
  async bip39_generateMnemonic(strength: 128 | 256 = 128): Promise<string> {
    return bip39.generateMnemonic(strength);
  }

  /**
   * B5.4.0: validate a BIP-39 mnemonic phrase. Returns true if the string parses
   * as a valid mnemonic (correct word list, correct word count, valid checksum).
   * Used by the import-mnemonic flow to gate vault_store on user-pasted input.
   */
  async bip39_validateMnemonic(mnemonic: string): Promise<boolean> {
    const bip39 = await import('bip39');
    return bip39.validateMnemonic(mnemonic);
  }

  async vault_hasStored(): Promise<boolean> {
    return this.vault.hasStoredVault();
  }

  async vault_store(password: string, plaintext: Uint8Array): Promise<void> {
    await this.vault.store(password, plaintext);
  }

  async vault_load(password: string): Promise<Uint8Array> {
    const plaintext = await this.vault.load(password);
    try {
      const mnemonic = new TextDecoder('utf-8', { fatal: false }).decode(plaintext);
      if (WdkManager.isValidSeed(mnemonic)) {
        this.wdk?.dispose();
        this.wdk = new WdkManager(mnemonic);
      }
    } catch {
      // Silent - contract honors returning the bytes regardless.
    }
    return plaintext;
  }

  async vault_clear(): Promise<void> {
    this.wdk?.dispose();
    this.wdk = null;
    await this.vault.clear();
  }

  /**
   * Zeroize the in-memory WDK orchestrator state WITHOUT clearing the
   * encrypted vault from persistent storage. Used by the browser extension
   * SW for auto-lock + manual lock operations (PRD 01 Addendum 3.3).
   *
   * After lock(), vault_load(password) must be called again to restore
   * WDK access. account_* and rpc_getBalance methods throw "WDK not
   * initialized" until that happens.
   *
   * Idempotent - calling lock() on an already-locked worker is a no-op.
   *
   * NOTE: this method is intentionally not yet listed in the Pick<...>
   * implements clause because it's currently consumed only by the
   * extension SW. If the Next.js template later needs a non-destructive
   * lock UX, add 'lock' to the Pick clause and to the WalletWorkerApi
   * type in types/index.ts. The implementation stays the same.
   */
  async lock(): Promise<void> {
    this.wdk?.dispose();
    this.wdk = null;
  }

  /**
   * Sign and broadcast an EVM transaction atomically.
   *
   * Returns the broadcast transaction hash. WDK's EVM account (backed by
   * viem under the hood per @tetherto/wdk-wallet-evm) handles gas estimation,
   * nonce lookup, and JSON-RPC broadcast internally - the caller passes
   * whatever subset of fields the dApp provided in tx.
   *
   * Used by the browser extension's eth_sendTransaction EIP-1193 handler
   * (B4.8) after the user approves the popup. The SW handler is responsible
   * for verifying that tx.from (if present) matches the connection state's
   * allow-list for the originating dApp; this method itself does NOT enforce
   * the from-address invariant since it has no concept of dApp origin.
   *
   * Per PRD 01 Addendum S12.4 v1.0 eth_sendTransaction. NOTE: placement
   * after lock() is suboptimal (should logically sit with other account_*
   * methods) - the available str-replace anchor was lock(). Future refactor
   * can reorder once a full-file pass is needed.
   */
  async account_sendTransaction(chain: EvmChainId, index: number, tx: Record<string, unknown>): Promise<Hex> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    // WDK's EVM account is a viem-style WalletClient under the hood; its
    // sendTransaction returns the broadcast tx hash directly. Boundary cast
    // tolerates the alternative ethers-style { hash } shape via normalization
    // below - real integration testing on testnet validates the actual return.
    const evmAccount = account as unknown as {
      sendTransaction(tx: Record<string, unknown>): Promise<Hex | { hash: Hex }>;
    };
    const result = await evmAccount.sendTransaction(tx);
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object' && 'hash' in result) return result.hash;
    throw new Error('account_sendTransaction: unexpected return shape from WDK EVM account');
  }

  /**
   * Sends native SOL on a Solana chain. WDK's WalletAccountSolana accepts a
   * SimpleSolanaTransaction ({ to, value }) where value is lamports; it builds,
   * signs, and broadcasts, returning a TransactionResult whose hash is the
   * base58 signature. (account.transfer() is SPL-only and not used here.)
   */
  async account_sendSolanaTransaction(chain: SolanaChainId, index: number, to: string, value: bigint): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered, deferred to v1.1): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const solanaAccount = account as unknown as {
      sendTransaction(tx: { to: string; value: bigint }): Promise<{ hash: string }>;
    };
    const result = await solanaAccount.sendTransaction({ to, value });
    if (result && typeof result === 'object' && typeof result.hash === 'string') return result.hash;
    throw new Error('account_sendSolanaTransaction: unexpected return shape from WDK Solana account');
  }

  /**
   * Returns the BIP-84 native-segwit (P2WPKH) Bitcoin address at an index.
   * Derivation is offline; no network needed. (BIP-44/legacy via config.bip=44.)
   */
  async account_getBtcAddress(chain: BtcChainId, index: number): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const btcAccount = account as unknown as { address: string };
    return btcAccount.address;
  }

  /** Reads the account's confirmed Bitcoin balance in satoshis (via the configured Blockbook client). */
  async account_getBtcBalance(chain: BtcChainId, index: number): Promise<bigint> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const btcAccount = account as unknown as { getBalance(): Promise<bigint> };
    return btcAccount.getBalance();
  }

  /**
   * Sends native BTC (value in satoshis) on a Bitcoin chain. WDK selects UTXOs,
   * builds, signs, and broadcasts a PSBT via the Blockbook client, returning the
   * txid. confirmationTarget tunes the fee (blocks); 6 ≈ ~1 hour.
   */
  async account_sendBtcTransaction(chain: BtcChainId, index: number, to: string, value: bigint, confirmationTarget = 6): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const btcAccount = account as unknown as {
      sendTransaction(tx: { to: string; value: bigint; confirmationTarget?: number }): Promise<{ hash: string }>;
    };
    const result = await btcAccount.sendTransaction({ to, value, confirmationTarget });
    if (result && typeof result === 'object' && typeof result.hash === 'string') return result.hash;
    throw new Error('account_sendBtcTransaction: unexpected return shape from WDK Bitcoin account');
  }

  /** Returns the account's TON (v5r1) address. */
  async account_getTonAddress(chain: TonChainId, index: number): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tonAccount = account as unknown as { getAddress(): Promise<string> };
    return tonAccount.getAddress();
  }

  /** Reads the account's TON balance in nanotons (via the configured TON client). */
  async account_getTonBalance(chain: TonChainId, index: number): Promise<bigint> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tonAccount = account as unknown as { getBalance(): Promise<bigint> };
    return tonAccount.getBalance();
  }

  /** Sends native TON (value in nanotons) on a TON chain; returns the tx hash. */
  async account_sendTonTransaction(chain: TonChainId, index: number, to: string, value: bigint): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tonAccount = account as unknown as {
      sendTransaction(tx: { to: string; value: bigint }): Promise<{ hash: string }>;
    };
    const result = await tonAccount.sendTransaction({ to, value });
    if (result && typeof result === 'object' && typeof result.hash === 'string') return result.hash;
    throw new Error('account_sendTonTransaction: unexpected return shape from WDK TON account');
  }

  /** Returns the account's Tron (base58 'T…') address. */
  async account_getTronAddress(chain: TronChainId, index: number): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tronAccount = account as unknown as { getAddress(): Promise<string> };
    return tronAccount.getAddress();
  }

  /** Reads the account's Tron balance in sun (1 TRX = 1e6 sun). */
  async account_getTronBalance(chain: TronChainId, index: number): Promise<bigint> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tronAccount = account as unknown as { getBalance(): Promise<bigint> };
    return tronAccount.getBalance();
  }

  /** Sends native TRX (value in sun) on a Tron chain; returns the tx hash. */
  async account_sendTronTransaction(chain: TronChainId, index: number, to: string, value: bigint): Promise<string> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const tronAccount = account as unknown as {
      sendTransaction(tx: { to: string; value: bigint }): Promise<{ hash: string }>;
    };
    const result = await tronAccount.sendTransaction({ to, value });
    if (result && typeof result === 'object' && typeof result.hash === 'string') return result.hash;
    throw new Error('account_sendTronTransaction: unexpected return shape from WDK Tron account');
  }

  async account_getEvmAddress(chain: EvmChainId, index: number): Promise<Hex> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const evmAccount = account as unknown as { address: string };
    return evmAccount.address as Hex;
  }

  async account_getSolanaAddress(chain: SolanaChainId, index: number): Promise<Base58Address> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered, deferred to v1.1): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const solanaAccount = account as unknown as { keyPair: { publicKey: Uint8Array } };
    return bs58.encode(solanaAccount.keyPair.publicKey) as Base58Address;
  }

  /**
   * Signs an EIP-191 personal_sign message on the given EVM chain.
   *
   * Cross-impl invariant (ADR-009 extended): for any (mnemonic, message),
   * this MUST return the same signature as viem's signMessage on the same
   * key. EIP-191 + RFC-6979 deterministic nonce + low-S normalization
   * means both viem (via @noble) and ethers v6 (via WDK) produce identical
   * bytes. Verified empirically in the spec.
   *
   * v1.0 limitation: SignableMessage's { raw: bytes } form is not supported
   * because WDK exposes only sign(string). Pass a string instead. Raw-bytes
   * support deferred to v1.1.
   */
  async account_signMessage(chain: EvmChainId, index: number, message: SignableMessage): Promise<Hex> {
    if (typeof message !== 'string') {
      throw new Error('SignableMessage raw-bytes form not supported in v1.0; pass a string. WDK exposes sign(string) only.');
    }
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const evmAccount = account as unknown as { sign(msg: string): Promise<string> };
    const sig = await evmAccount.sign(message);
    return sig as Hex;
  }

  /**
   * Signs an EIP-712 typed-data payload on the given EVM chain.
   *
   * Pairs cleanly with buildEip3009TransferAuthorization from the eip3009
   * module - the full chain (EIP-3009 builder -> this method -> WDK signer)
   * is verified in the spec to produce signatures identical to viem signing
   * the same payload directly.
   *
   * WDK's signTypedData destructures only { domain, types, message } and
   * relies on ethers' primaryType inference (works for single-root schemas
   * like EIP-3009 - the only kind Phase 1 v1.0 produces). The payload's
   * primaryType field is dropped at this layer.
   */
  async account_signTypedData(chain: EvmChainId, index: number, payload: TypedDataPayload): Promise<Hex> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const evmAccount = account as unknown as { signTypedData(td: { domain: unknown; types: unknown; message: unknown }): Promise<string> };
    const sig = await evmAccount.signTypedData({
      domain: payload.domain,
      types: payload.types,
      message: payload.message,
    });
    return sig as Hex;
  }

  /**
   * Signs a Solana message (Ed25519, deterministic).
   *
   * v1.0 limitation: WDK's WalletAccountSolana exposes only sign(string),
   * not sign(bytes). We decode the input Uint8Array as strict UTF-8 and
   * pass to WDK. If the bytes are not valid UTF-8, throws RangeError with
   * a clear pointer to the limitation. Raw-bytes signing requires either
   * WDK API change OR accessing the private _signer (KeyPairSigner) -
   * deferred to v1.1.
   */
  async account_signSolanaMessage(chain: SolanaChainId, index: number, message: Uint8Array): Promise<SolanaSignature> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered, deferred to v1.1): ' + chain);
    }
    let messageString: string;
    try {
      messageString = new TextDecoder('utf-8', { fatal: true }).decode(message);
    } catch {
      throw new RangeError('Solana message signing in v1.0 requires UTF-8 representable bytes; WDK exposes sign(string) only. Raw-bytes signing deferred to v1.1.');
    }
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const solanaAccount = account as unknown as { sign(msg: string): Promise<string> };
    const sig = await solanaAccount.sign(messageString);
    return sig as SolanaSignature;
  }

  /**
   * Reads on-chain native-token balance for an arbitrary address.
   *
   * v1.0 STUB: this method is part of the WalletWorkerApi contract per
   * ADR-010 but its real implementation belongs to the RPC adapter layer
   * (kickoff Part V Step 10 - RPC + Indexer adapters). For Step 6c we
   * declare the method to satisfy the contract surface but throw a
   * deferral error at runtime. The full implementation will route to
   * viem.getBalance (EVM) or @solana/rpc.getBalance (Solana) via the
   * RPC adapter abstraction.
   */
  async rpc_getBalance(chain: ChainId, address: string): Promise<bigint> {
    if (!this.rpcAdapter) {
      throw new Error('No RPC adapter configured on WalletWorker. Pass options.rpcAdapter (e.g. createHttpRpcAdapter() or createMockRpcAdapter()) to the constructor.');
    }
    return this.rpcAdapter.getBalance(chain, address);
  }

  /**
   * Reads an ERC-20 / SPL token balance for an address. Delegates to the RPC
   * adapter's getTokenBalance (EVM: standard balanceOf; Solana SPL deferred).
   * Used by the wallet UI to display USDt / XAUt and other token balances.
   */
  async rpc_getTokenBalance(chain: ChainId, address: string, tokenAddress: string): Promise<bigint> {
    if (!this.rpcAdapter) {
      throw new Error('No RPC adapter configured on WalletWorker. Pass options.rpcAdapter (e.g. createHttpRpcAdapter() or createMockRpcAdapter()) to the constructor.');
    }
    return this.rpcAdapter.getTokenBalance(chain, address, tokenAddress);
  }

  /**
   * Reads the on-chain status of a broadcast transaction (pending / success /
   * failed). Delegates to the RPC adapter; powers the Activity tab's live
   * status monitoring.
   */
  async rpc_getTransactionStatus(chain: ChainId, hash: string): Promise<TransactionStatus> {
    if (!this.rpcAdapter) {
      throw new Error('No RPC adapter configured on WalletWorker. Pass options.rpcAdapter (e.g. createHttpRpcAdapter() or createMockRpcAdapter()) to the constructor.');
    }
    return this.rpcAdapter.getTransactionStatus(chain, hash);
  }

  /**
   * Returns the USD price for an asset symbol (e.g. 'ETH', 'BTC') via the
   * CoinGecko pricing client, or null if unknown/unavailable. Powers fiat
   * value display in the UI. Errors (unknown symbol, network) resolve to null.
   */
  async pricing_getUsdPrice(symbol: string): Promise<number | null> {
    try {
      return await getPricingClient().getCurrentPrice(symbol, 'usd');
    } catch {
      return null;
    }
  }

  /**
   * Internal: returns the current WDK instance, or throws if not initialized.
   * Used by account_* methods. Not part of the public WalletWorkerApi contract.
   * @internal
   */
  protected _requireWdk(): WdkManager {
    if (!this.wdk) {
      throw new Error('WalletWorker: WDK not initialized. Call vault_load(password) with a valid stored mnemonic first.');
    }
    return this.wdk;
  }
}