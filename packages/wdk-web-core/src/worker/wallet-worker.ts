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
import { assertValidRecipient, isSparkAddress, isBitcoinAddress, decodeBolt11 } from '../payments/index.js';
import {
  createSparkManager,
  extractBolt11,
  normalizeSparkTxHash,
  normalizeLightningSendId,
  normalizeWithdrawQuote,
  normalizeWithdrawResult,
  type SparkAccountLike,
  type SparkManagerConfig,
  type SparkExitSpeed,
  type SparkWithdrawQuote,
  type SparkWithdrawResult,
} from '../protocols/spark.js';
import {
  createAaveProtocol,
  normalizeActionResult,
  normalizeAccountData,
  type AaveAccountData,
  type AaveActionResult,
} from '../protocols/aave.js';
import {
  createVeloraProtocol,
  normalizeQuote as normalizeVeloraQuote,
  normalizeSwapResult as normalizeVeloraSwap,
  type VeloraQuote,
  type VeloraSwapResult,
} from '../protocols/velora.js';
import {
  createUsdt0Protocol,
  normalizeUsdt0Quote,
  normalizeUsdt0Result,
  type ApprovableEvmAccount,
  type Usdt0Quote,
  type Usdt0BridgeResult,
} from '../protocols/usdt0.js';
import {
  createMoonPayProtocol,
  normalizeBuyQuote,
  type MoonPayConfig,
  type MoonPayBuyQuote,
} from '../protocols/moonpay.js';
import {
  createErc4337Manager,
  gasConfig,
  normalizeErc4337Result,
  type Erc4337SendResult,
} from '../protocols/erc4337.js';
import { buildEip3009TransferAuthorization } from '../eip3009/builder.js';
import {
  networkToChainId,
  generateX402Nonce,
  buildExactPayment,
  encodePaymentHeader,
  type X402Requirements,
} from '../x402.js';
import type { RpcAdapter, TransactionStatus } from '../adapters/index.js';
import { createCoingeckoPricingAdapter, type PricingAdapter } from '../adapters/pricing.js';
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
  /**
   * Optional MoonPay on-ramp config (app-supplied publishable key + environment).
   * If omitted, moonpay_* methods report "not configured" — the integration is
   * present and ready; only the app's own key is missing.
   */
  readonly moonpayConfig?: MoonPayConfig;
  /**
   * Optional ERC-4337 config (app-supplied bundler/paymaster URLs + a per-chain
   * RPC provider resolver). If omitted, erc4337_* methods report "not
   * configured" — the smart-account integration is present and ready.
   */
  readonly erc4337Config?: Erc4337WorkerConfig;
  /**
   * Optional Spark / Lightning config (network + optional SparkScan REST).
   * If omitted, defaults to MAINNET. Spark loads lazily and runs only on a
   * Web-Worker host (F-SPARK-03 / F-MV3-04 — see protocols/spark.ts).
   */
  readonly sparkConfig?: SparkManagerConfig;
  /**
   * Optional pricing source for `pricing_getUsdPrice`. Defaults to a CoinGecko
   * adapter over the built-in symbol map; inject a fallback chain (e.g. Bitfinex
   * → CoinGecko via `createFallbackPricingAdapter`) for resilience.
   */
  readonly pricingAdapter?: PricingAdapter;
}

export interface Erc4337WorkerConfig {
  readonly bundlerUrl: string;
  readonly paymasterUrl?: string;
  /** Resolves the RPC provider URL for a chain (reuses the wallet's RPC config). */
  readonly providerFor: (chain: string) => string | undefined;
}

// Pricing is provided through an injectable PricingAdapter; the worker's default
// (constructor) is a CoinGecko adapter over DEFAULT_COIN_IDS — see adapters/pricing.ts.

export class WalletWorker implements Pick<WalletWorkerApi, 'vault_hasStored' | 'vault_store' | 'vault_load' | 'vault_clear' | 'account_getEvmAddress' | 'account_getSolanaAddress' | 'account_signMessage' | 'account_signTypedData' | 'account_signSolanaMessage' | 'account_sendTransaction' | 'account_sendSolanaTransaction' | 'account_getBtcAddress' | 'account_getBtcBalance' | 'account_sendBtcTransaction' | 'account_getTonAddress' | 'account_getTonBalance' | 'account_sendTonTransaction' | 'account_getTronAddress' | 'account_getTronBalance' | 'account_sendTronTransaction' | 'rpc_getBalance' | 'rpc_getTokenBalance' | 'rpc_getTransactionStatus' | 'pricing_getUsdPrice' | 'bip39_generateMnemonic' | 'bip39_validateMnemonic'> {
  private readonly vault: WebCryptoVault;
  private readonly rpcAdapter: RpcAdapter | null;
  private readonly moonpayConfig: MoonPayConfig | null;
  private readonly erc4337Config: Erc4337WorkerConfig | null;
  private readonly sparkConfig: SparkManagerConfig | null;
  private readonly pricingAdapter: PricingAdapter;
  private wdk: WdkManager | null = null;
  /**
   * Retained decrypted mnemonic, set on vault_load and cleared on lock/clear.
   * Needed to construct an ERC-4337 smart-account manager on demand. It is the
   * same secret WdkManager already holds, in the same in-memory worklet — the
   * trust boundary is unchanged.
   */
  private _mnemonic: string | null = null;

  constructor(options: WalletWorkerOptions = {}) {
    this.vault = options.vault ?? createWebCryptoVault();
    this.rpcAdapter = options.rpcAdapter ?? null;
    this.moonpayConfig = options.moonpayConfig ?? null;
    this.erc4337Config = options.erc4337Config ?? null;
    this.sparkConfig = options.sparkConfig ?? null;
    this.pricingAdapter = options.pricingAdapter ?? createCoingeckoPricingAdapter();
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
        this._mnemonic = mnemonic; // retained for on-demand ERC-4337 manager construction
      }
    } catch {
      // Silent - contract honors returning the bytes regardless.
    }
    return plaintext;
  }

  async vault_clear(): Promise<void> {
    this.wdk?.dispose();
    this.wdk = null;
    this._mnemonic = null;
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
    this._mnemonic = null;
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
    // Send-path guard: never ask WDK to sign a transfer to a malformed recipient.
    if (typeof tx.to === 'string') assertValidRecipient('evm', tx.to);
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
    assertValidRecipient('solana', to);
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
    assertValidRecipient('bitcoin', to);
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
    assertValidRecipient('ton', to);
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
    assertValidRecipient('tron', to);
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
    return this.pricingAdapter.getUsdPrice(symbol);
  }

  /**
   * Builds the Aave V3 protocol bound to the EVM account at (chain, index).
   * The account holds the key and never leaves the worklet. Uses a plain
   * WalletAccountEvm over the configured RPC — no bundler/paymaster required.
   */
  /**
   * Resolves the EVM account a protocol runs on. With `gasless`, returns the
   * ERC-4337 smart account (UserOperations via the bundler); otherwise the plain
   * WDK account. Both hold the key inside the worklet.
   */
  private async _evmAccount(chain: EvmChainId, index: number, gasless: boolean): Promise<unknown> {
    if (!isSupportedChainId(chain)) {
      throw new Error('Unsupported chain (no loader registered): ' + chain);
    }
    if (gasless) return this._smartAccount(chain, index);
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    return wdk.getAccount(chain, index);
  }

  /**
   * Gas-payment config for a gasless protocol action: pay in USDt via the
   * paymaster when one is configured, otherwise the smart account pays its own
   * native gas. Returns undefined for the non-gasless (plain account) path.
   */
  private _gasCfg(gasless: boolean): Record<string, unknown> | undefined {
    if (!gasless) return undefined;
    return gasConfig(this.erc4337Config?.paymasterUrl ? 'USDT' : undefined);
  }

  private async _aave(chain: EvmChainId, index: number, gasless = false) {
    return createAaveProtocol(await this._evmAccount(chain, index, gasless));
  }

  /** Aave V3 user snapshot (collateral, debt, borrow capacity, health factor). */
  async aave_getAccountData(chain: EvmChainId, index: number): Promise<AaveAccountData> {
    const aave = await this._aave(chain, index);
    return normalizeAccountData(await aave.getAccountData());
  }

  /** Quotes the gas/fee for an Aave action without broadcasting. */
  async aave_quote(chain: EvmChainId, index: number, action: 'supply' | 'withdraw' | 'borrow' | 'repay', token: string, amount: bigint): Promise<bigint> {
    const aave = await this._aave(chain, index);
    const fn = { supply: aave.quoteSupply, withdraw: aave.quoteWithdraw, borrow: aave.quoteBorrow, repay: aave.quoteRepay }[action];
    const { fee } = await fn.call(aave, { token, amount });
    return typeof fee === 'bigint' ? fee : BigInt(fee ?? 0);
  }

  /** Supplies `amount` of `token` to the Aave V3 pool (optionally gasless). */
  async aave_supply(chain: EvmChainId, index: number, token: string, amount: bigint, gasless = false): Promise<AaveActionResult> {
    const aave = await this._aave(chain, index, gasless);
    return normalizeActionResult(await aave.supply({ token, amount }, this._gasCfg(gasless)));
  }

  /** Withdraws `amount` of `token` from the Aave V3 pool (optionally gasless). */
  async aave_withdraw(chain: EvmChainId, index: number, token: string, amount: bigint, gasless = false): Promise<AaveActionResult> {
    const aave = await this._aave(chain, index, gasless);
    return normalizeActionResult(await aave.withdraw({ token, amount }, this._gasCfg(gasless)));
  }

  /** Borrows `amount` of `token` against supplied collateral (optionally gasless). */
  async aave_borrow(chain: EvmChainId, index: number, token: string, amount: bigint, gasless = false): Promise<AaveActionResult> {
    const aave = await this._aave(chain, index, gasless);
    return normalizeActionResult(await aave.borrow({ token, amount }, this._gasCfg(gasless)));
  }

  /** Repays `amount` of borrowed `token` (optionally gasless). */
  async aave_repay(chain: EvmChainId, index: number, token: string, amount: bigint, gasless = false): Promise<AaveActionResult> {
    const aave = await this._aave(chain, index, gasless);
    return normalizeActionResult(await aave.repay({ token, amount }, this._gasCfg(gasless)));
  }

  /** Builds the Velora swap protocol bound to the plain or smart account in the worklet. */
  private async _velora(chain: EvmChainId, index: number, gasless = false) {
    return createVeloraProtocol(await this._evmAccount(chain, index, gasless));
  }

  /** Quotes a tokenIn→tokenOut swap (exact-in) without broadcasting. */
  async velora_quoteSwap(chain: EvmChainId, index: number, tokenIn: string, tokenOut: string, tokenInAmount: bigint): Promise<VeloraQuote> {
    const v = await this._velora(chain, index);
    return normalizeVeloraQuote(await v.quoteSwap({ tokenIn, tokenOut, tokenInAmount }));
  }

  /** Executes a swap (optionally gasless). Provide exactly one of tokenInAmount (sell) or tokenOutAmount (buy). */
  async velora_swap(chain: EvmChainId, index: number, tokenIn: string, tokenOut: string, tokenInAmount?: bigint, tokenOutAmount?: bigint, gasless = false): Promise<VeloraSwapResult> {
    const v = await this._velora(chain, index, gasless);
    return normalizeVeloraSwap(await v.swap({
      tokenIn,
      tokenOut,
      ...(tokenInAmount !== undefined ? { tokenInAmount } : {}),
      ...(tokenOutAmount !== undefined ? { tokenOutAmount } : {}),
    }, this._gasCfg(gasless)));
  }

  /** Quotes the native fee to bridge `amount` of `token` from `chain` to `targetChain` via USDT0. */
  async usdt0_quoteBridge(chain: EvmChainId, index: number, targetChain: string, recipient: string, token: string, amount: bigint, oftContractAddress: string): Promise<Usdt0Quote> {
    const account = await this._evmAccount(chain, index, false);
    const bridge = createUsdt0Protocol(account);
    return normalizeUsdt0Quote(await bridge.quoteBridge({ targetChain, recipient, token, amount, oftContractAddress }));
  }

  /** Approves the OFT spender then bridges `amount` of `token` to `targetChain` via USDT0 (optionally gasless). */
  async usdt0_bridge(chain: EvmChainId, index: number, targetChain: string, recipient: string, token: string, amount: bigint, oftContractAddress: string, gasless = false): Promise<Usdt0BridgeResult> {
    const account = await this._evmAccount(chain, index, gasless);
    const cfg = this._gasCfg(gasless);
    const approval = await (account as unknown as ApprovableEvmAccount).approve({ token, spender: oftContractAddress, amount }, cfg);
    const approveHash = typeof approval === 'string' ? approval : (approval && typeof approval === 'object' && 'hash' in approval ? String(approval.hash) : undefined);
    const bridge = createUsdt0Protocol(account);
    const result = await bridge.bridge({ targetChain, recipient, token, amount, oftContractAddress }, cfg);
    return normalizeUsdt0Result(result, approveHash);
  }

  /** Whether a MoonPay on-ramp key is configured by the host app. */
  async moonpay_isConfigured(): Promise<boolean> {
    return Boolean(this.moonpayConfig?.apiKey);
  }

  /** Quotes a fiat→crypto buy. Returns null if MoonPay isn't configured. */
  async moonpay_quoteBuy(fiatCurrency: string, cryptoAsset: string, fiatAmount: number): Promise<MoonPayBuyQuote | null> {
    if (!this.moonpayConfig?.apiKey) return null;
    const mp = createMoonPayProtocol(this.moonpayConfig);
    return normalizeBuyQuote(await mp.quoteBuy({ fiatCurrency, cryptoAsset, baseCurrencyAmount: fiatAmount }));
  }

  /** Generates a MoonPay buy-widget URL for `recipient`. Throws if not configured. */
  async moonpay_buy(fiatCurrency: string, cryptoAsset: string, fiatAmount: number, recipient: string): Promise<string> {
    if (!this.moonpayConfig?.apiKey) {
      throw new Error('MoonPay is not configured. Set VITE_MOONPAY_API_KEY (publishable key) to enable the on-ramp.');
    }
    const mp = createMoonPayProtocol(this.moonpayConfig);
    const { buyUrl } = await mp.buy({ fiatCurrency, cryptoAsset, baseCurrencyAmount: fiatAmount, walletAddress: recipient });
    return buyUrl;
  }

  /** Whether an ERC-4337 bundler is configured by the host app. */
  async erc4337_isConfigured(): Promise<boolean> {
    return Boolean(this.erc4337Config?.bundlerUrl);
  }

  /** Builds an ERC-4337 smart account at (chain, index) from the retained seed. */
  private async _smartAccount(chain: EvmChainId, index: number) {
    const cfg = this.erc4337Config;
    if (!cfg?.bundlerUrl) {
      throw new Error('ERC-4337 is not configured. Set VITE_BUNDLER_URL (and optionally VITE_PAYMASTER_URL) to enable smart accounts.');
    }
    if (!this._mnemonic) throw new Error('WalletWorker: locked. Call vault_load(password) first.');
    const providerUrl = cfg.providerFor(chain);
    if (!providerUrl) throw new Error('No RPC provider configured for chain: ' + chain);
    const manager = createErc4337Manager(this._mnemonic, providerUrl, { bundlerUrl: cfg.bundlerUrl, ...(cfg.paymasterUrl ? { paymasterUrl: cfg.paymasterUrl } : {}) });
    return manager.getAccount(index);
  }

  /** The counterfactual smart-account address at (chain, index). */
  async erc4337_getAddress(chain: EvmChainId, index: number): Promise<string> {
    const account = await this._smartAccount(chain, index);
    return account.getAddress();
  }

  /** The smart account's native balance (wei). */
  async erc4337_getBalance(chain: EvmChainId, index: number): Promise<bigint> {
    const account = await this._smartAccount(chain, index);
    return BigInt(await account.getBalance());
  }

  /** Quotes the gas fee for a gasless send (pays in `paymasterToken` if given). */
  async erc4337_quoteSend(chain: EvmChainId, index: number, to: string, value: bigint, paymasterToken?: string): Promise<bigint> {
    const account = await this._smartAccount(chain, index);
    const raw = await account.quoteSendTransaction({ to, value }, gasConfig(paymasterToken));
    return normalizeErc4337Result(raw).fee;
  }

  /** Sends a gasless native transfer as a UserOperation via the bundler. */
  async erc4337_sendTransaction(chain: EvmChainId, index: number, to: string, value: bigint, paymasterToken?: string): Promise<Erc4337SendResult> {
    const account = await this._smartAccount(chain, index);
    return normalizeErc4337Result(await account.sendTransaction({ to, value }, gasConfig(paymasterToken)));
  }

  /**
   * Pays an x402 "402 Payment Required" challenge: signs an EIP-3009
   * authorization (the x402 "exact" scheme) for the given PaymentRequirements and
   * returns the base64 `X-PAYMENT` header the caller attaches when retrying the
   * request. `chain`/`index` select the EVM account that pays — the same key
   * across chains, so any registered EVM chain derives the correct `from`; the
   * EIP-712 domain's chainId comes from the requirements' network. A facilitator
   * verifies + settles the authorization on-chain. Key never leaves the worklet.
   */
  async x402_createPayment(chain: EvmChainId, index: number, requirements: X402Requirements): Promise<string> {
    const wdk = this._requireWdk();
    await ensureChainRegistered(wdk, chain);
    const account = await wdk.getAccount(chain, index);
    const from = (await (account as unknown as { getAddress(): Promise<string> }).getAddress());

    const chainId = networkToChainId(requirements.network);
    const now = Math.floor(Date.now() / 1000);
    const validBefore = BigInt(now + Math.max(1, Number(requirements.maxTimeoutSeconds) || 60));
    const nonce = generateX402Nonce();
    const value = BigInt(requirements.maxAmountRequired);

    const typed = buildEip3009TransferAuthorization({
      token: { address: requirements.asset as Hex, name: requirements.extra?.name ?? '', version: requirements.extra?.version ?? '2' },
      chainId,
      from: from as Hex,
      to: requirements.payTo as Hex,
      value,
      validBefore,
      nonce: nonce as Hex,
    });

    const evmAccount = account as unknown as { signTypedData(td: { domain: unknown; types: unknown; message: unknown }): Promise<string> };
    const signature = await evmAccount.signTypedData({ domain: typed.domain, types: typed.types, message: typed.message });

    const payment = buildExactPayment(requirements.network, signature, {
      from,
      to: requirements.payTo,
      value: requirements.maxAmountRequired,
      validAfter: '0',
      validBefore: validBefore.toString(),
      nonce,
    });
    return encodePaymentHeader(payment);
  }

  // ─── Spark / Lightning (lazy; Web-Worker host only — F-SPARK-* / F-MV3-04) ──

  /**
   * Builds the on-demand Spark account from the retained mnemonic, lazy-loading
   * the Spark SDK (its own chunk). Mirrors the ERC-4337 `_smartAccount` pattern.
   * Throws "locked" before any load if the worker has no mnemonic, and throws a
   * descriptive error on MV3 where dynamic import is forbidden.
   */
  private async _sparkAccount(index: number): Promise<SparkAccountLike> {
    if (!this._mnemonic) {
      throw new Error('WalletWorker: locked. Call vault_load(password) first.');
    }
    const manager = await createSparkManager(this._mnemonic, this.sparkConfig ?? {});
    return manager.getAccount(index);
  }

  /** Returns the account's Spark address (requires network; no offline derivation — F-SPARK-02). */
  async account_getSparkAddress(index: number): Promise<string> {
    const account = await this._sparkAccount(index);
    return account.getAddress();
  }

  /** Reads the account's Spark balance in satoshis (SparkScan REST / gRPC — F-SPARK-04). */
  async account_getSparkBalance(index: number): Promise<bigint> {
    const account = await this._sparkAccount(index);
    return account.getBalance();
  }

  /** Sends a Spark-to-Spark transfer (value in satoshis); returns the transfer hash. */
  async account_sendSparkTransaction(index: number, to: string, value: bigint): Promise<string> {
    if (!isSparkAddress(to)) {
      throw new Error('Refusing to send: invalid Spark recipient address (expected spark1…)');
    }
    const account = await this._sparkAccount(index);
    return normalizeSparkTxHash(await account.sendTransaction({ to, value }));
  }

  /**
   * Returns the account's reusable static Spark deposit address — fund the Spark
   * balance by sending BTC to it from Bitcoin L1 (F-SPARK deposit). The address is
   * generated on first call and persists thereafter.
   */
  async account_getSparkDepositAddress(index: number): Promise<string> {
    const account = await this._sparkAccount(index);
    return account.getStaticDepositAddress();
  }

  /**
   * Quotes the cooperative-exit fee to withdraw `amountSats` from Spark to a
   * Bitcoin L1 address, for the chosen exit speed (default MEDIUM). Returns a
   * flat, structured-clone-safe quote (operator fee + L1 broadcast fee + total).
   */
  async account_quoteSparkWithdraw(
    index: number,
    toBtcAddress: string,
    amountSats: number,
    exitSpeed: SparkExitSpeed = 'MEDIUM',
  ): Promise<SparkWithdrawQuote> {
    if (!isBitcoinAddress(toBtcAddress)) {
      throw new Error('Refusing to quote: invalid Bitcoin withdrawal address');
    }
    if (!Number.isInteger(amountSats) || amountSats <= 0) {
      throw new Error('account_quoteSparkWithdraw: amountSats must be a positive integer');
    }
    const account = await this._sparkAccount(index);
    const quote = await account.quoteWithdraw({ withdrawalAddress: toBtcAddress, amountSats });
    return normalizeWithdrawQuote(quote, exitSpeed);
  }

  /**
   * Withdraws `amountSats` from Spark to a Bitcoin L1 address via a cooperative
   * exit. Quotes the fee for the chosen speed first, then submits the withdrawal
   * bound to that quote (the SDK requires both the quote id and the committed fee
   * amount). Returns the exit request id + status; the cooperative exit is
   * asynchronous and the funds settle on L1 once the exit transaction confirms.
   */
  async account_sparkWithdraw(
    index: number,
    toBtcAddress: string,
    amountSats: number,
    exitSpeed: SparkExitSpeed = 'MEDIUM',
  ): Promise<SparkWithdrawResult> {
    if (!isBitcoinAddress(toBtcAddress)) {
      throw new Error('Refusing to withdraw: invalid Bitcoin withdrawal address');
    }
    if (!Number.isInteger(amountSats) || amountSats <= 0) {
      throw new Error('account_sparkWithdraw: amountSats must be a positive integer');
    }
    const account = await this._sparkAccount(index);
    const quote = await account.quoteWithdraw({ withdrawalAddress: toBtcAddress, amountSats });
    const normalized = normalizeWithdrawQuote(quote, exitSpeed);
    const result = await account.withdraw({
      onchainAddress: toBtcAddress,
      exitSpeed,
      amountSats,
      ...(normalized.quoteId ? { feeQuoteId: normalized.quoteId } : {}),
      ...(normalized.totalFeeSats ? { feeAmountSats: normalized.totalFeeSats } : {}),
    });
    return normalizeWithdrawResult(result);
  }

  /** Creates a BOLT11 Lightning invoice for `amountSats`; returns the encoded invoice string. */
  async lightning_createInvoice(index: number, amountSats: number, memo?: string): Promise<string> {
    if (!Number.isInteger(amountSats) || amountSats <= 0) {
      throw new Error('lightning_createInvoice: amountSats must be a positive integer');
    }
    const account = await this._sparkAccount(index);
    const request = await account.createLightningInvoice({
      amountSats,
      ...(memo !== undefined ? { memo } : {}),
    });
    return extractBolt11(request);
  }

  /**
   * Pays a BOLT11 Lightning invoice, capping the routing fee at `maxFeeSats`.
   * The invoice is validated with the shared BOLT11 decoder before paying.
   * Returns the Lightning send-request id.
   */
  async lightning_payInvoice(index: number, invoice: string, maxFeeSats: number): Promise<string> {
    if (!decodeBolt11(invoice)) {
      throw new Error('lightning_payInvoice: not a valid BOLT11 invoice');
    }
    if (!Number.isInteger(maxFeeSats) || maxFeeSats < 0) {
      throw new Error('lightning_payInvoice: maxFeeSats must be a non-negative integer');
    }
    const account = await this._sparkAccount(index);
    return normalizeLightningSendId(await account.payLightningInvoice({ invoice, maxFeeSats }));
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