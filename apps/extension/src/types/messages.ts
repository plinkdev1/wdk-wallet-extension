/**
 * Wallet message protocol - popup <-> SW envelope + DAPP_REQUEST envelope.
 *
 * Per PRD 01 Addendum S5.2. The typed envelope replaces Comlink in the
 * MV3 SW context because Comlink's late-microtask listener registration
 * violates F-MV3-01's synchronous-listener-registration requirement.
 *
 * Each message has a literal-string `type` discriminator. The SW
 * dispatcher narrows on `type` and routes via F-SEC-01 Object.hasOwn
 * whitelisting (NOT the `in` operator).
 *
 * DAPP_REQUEST (B4.3): outer-tier envelope for inpage-originated EIP-1193
 * requests. Routed by outer dispatcher (F-SEC-01 outer tier), then handled
 * by handlers.ts DAPP_REQUEST handler which calls createDappDispatcher
 * (F-SEC-01 inner tier per S12.6.3).
 *
 * APPROVAL_* (B4.4): popup-driven approval flow handshake.
 *   APPROVAL_GET_PENDING: popup queries pending request details for rendering.
 *   APPROVAL_RESPOND: popup delivers user decision (approve/reject + optional data).
 *   APPROVAL_LIST_PENDING: popup enumerates all pending ids (queue display).
 *
 * Chain types are imported from wdk-web-core/types as the single source of truth.
 */

import type { Hex } from 'viem';
import type { BtcChainId, ChainId, EvmChainId, SolanaChainId, TonChainId, TronChainId } from '@wdk-starter/wdk-web-core/types';
import type { Eip1193Response } from './dapp-messages.js';
import type { ApprovalRequest } from '../background/approval-flow.js';

export type { BtcChainId, ChainId, EvmChainId, SolanaChainId, TonChainId, TronChainId };

export type WalletMessage =
  // Health / lifecycle
  | { type: 'PING' }
  | { type: 'GET_LOCK_STATE' }
  | { type: 'LOCK' }
  // Vault
  | { type: 'VAULT_HAS_STORED' }
  | { type: 'VAULT_STORE'; password: string; mnemonic: string }
  | { type: 'VAULT_LOAD'; password: string }
  | { type: 'VAULT_CLEAR' }
  // BIP-39 mnemonic generation (B5.2.0 - cross-package via wdk-web-core worker)
  | { type: 'BIP39_GENERATE_MNEMONIC' }
  | { type: 'BIP39_VALIDATE_MNEMONIC'; mnemonic: string }
  // Accounts
  | { type: 'ACCOUNT_GET_EVM_ADDRESS'; chain: EvmChainId; accountIndex: number }
  | { type: 'ACCOUNT_GET_SOLANA_ADDRESS'; chain: SolanaChainId; accountIndex: number }
  | { type: 'ACCOUNT_SIGN_MESSAGE'; chain: ChainId; accountIndex: number; message: string }
  | { type: 'ACCOUNT_SIGN_TYPED_DATA'; chain: EvmChainId; accountIndex: number; payload: unknown }
  | { type: 'ACCOUNT_SIGN_SOLANA_MESSAGE'; chain: SolanaChainId; accountIndex: number; message: string }
  // User-initiated EVM transfer from the popup. `value` is a base-unit decimal
  // string (bigint is not structured-cloneable over chrome.runtime — L-WIRE-03).
  | { type: 'ACCOUNT_SEND_TRANSACTION'; chain: EvmChainId; accountIndex: number; to: string; value: string; data?: string }
  | { type: 'ACCOUNT_SEND_SOLANA_TRANSACTION'; chain: SolanaChainId; accountIndex: number; to: string; value: string }
  // Bitcoin (BIP-84 native segwit; value is satoshis as a decimal string)
  | { type: 'ACCOUNT_GET_BTC_ADDRESS'; chain: BtcChainId; accountIndex: number }
  | { type: 'ACCOUNT_GET_BTC_BALANCE'; chain: BtcChainId; accountIndex: number }
  | { type: 'ACCOUNT_SEND_BTC_TRANSACTION'; chain: BtcChainId; accountIndex: number; to: string; value: string; confirmationTarget?: number }
  // TON (value is nanotons as a decimal string)
  | { type: 'ACCOUNT_GET_TON_ADDRESS'; chain: TonChainId; accountIndex: number }
  | { type: 'ACCOUNT_GET_TON_BALANCE'; chain: TonChainId; accountIndex: number }
  | { type: 'ACCOUNT_SEND_TON_TRANSACTION'; chain: TonChainId; accountIndex: number; to: string; value: string }
  // Tron (value is sun as a decimal string)
  | { type: 'ACCOUNT_GET_TRON_ADDRESS'; chain: TronChainId; accountIndex: number }
  | { type: 'ACCOUNT_GET_TRON_BALANCE'; chain: TronChainId; accountIndex: number }
  | { type: 'ACCOUNT_SEND_TRON_TRANSACTION'; chain: TronChainId; accountIndex: number; to: string; value: string }
  // RPC
  | { type: 'RPC_GET_BALANCE'; chain: ChainId; address: string }
  | { type: 'RPC_GET_TOKEN_BALANCE'; chain: ChainId; address: string; tokenAddress: string }
  | { type: 'RPC_GET_TRANSACTION_STATUS'; chain: ChainId; hash: string }
  // Fiat pricing (USD)
  | { type: 'PRICING_GET_USD_PRICE'; symbol: string }
  // Aave V3 lending (amounts are base-unit decimal strings; L-WIRE-03)
  | { type: 'AAVE_GET_ACCOUNT_DATA'; chain: EvmChainId; accountIndex: number }
  | { type: 'AAVE_QUOTE'; chain: EvmChainId; accountIndex: number; action: 'supply' | 'withdraw' | 'borrow' | 'repay'; token: string; amount: string }
  | { type: 'AAVE_SUPPLY'; chain: EvmChainId; accountIndex: number; token: string; amount: string; gasless?: boolean }
  | { type: 'AAVE_WITHDRAW'; chain: EvmChainId; accountIndex: number; token: string; amount: string; gasless?: boolean }
  | { type: 'AAVE_BORROW'; chain: EvmChainId; accountIndex: number; token: string; amount: string; gasless?: boolean }
  | { type: 'AAVE_REPAY'; chain: EvmChainId; accountIndex: number; token: string; amount: string; gasless?: boolean }
  // Velora (ParaSwap) DEX swaps (amounts are base-unit decimal strings; L-WIRE-03)
  | { type: 'VELORA_QUOTE_SWAP'; chain: EvmChainId; accountIndex: number; tokenIn: string; tokenOut: string; tokenInAmount: string }
  | { type: 'VELORA_SWAP'; chain: EvmChainId; accountIndex: number; tokenIn: string; tokenOut: string; tokenInAmount?: string; tokenOutAmount?: string; gasless?: boolean }
  // USDT0 cross-chain bridge (amount is a base-unit decimal string; L-WIRE-03)
  | { type: 'USDT0_QUOTE_BRIDGE'; chain: EvmChainId; accountIndex: number; targetChain: string; recipient: string; token: string; amount: string; oftContractAddress: string }
  | { type: 'USDT0_BRIDGE'; chain: EvmChainId; accountIndex: number; targetChain: string; recipient: string; token: string; amount: string; oftContractAddress: string; gasless?: boolean }
  // MoonPay fiat on-ramp (fiatAmount is a JS number — whole/decimal fiat units)
  | { type: 'MOONPAY_IS_CONFIGURED' }
  | { type: 'MOONPAY_QUOTE_BUY'; fiatCurrency: string; cryptoAsset: string; fiatAmount: number }
  | { type: 'MOONPAY_BUY'; fiatCurrency: string; cryptoAsset: string; fiatAmount: number; recipient: string }
  // x402 — sign an EIP-3009 authorization for a 402 challenge, return the X-PAYMENT header
  | { type: 'X402_CREATE_PAYMENT'; chain: EvmChainId; accountIndex: number; requirements: { scheme: string; network: string; maxAmountRequired: string; payTo: string; asset: string; maxTimeoutSeconds?: number; resource?: string; extra?: { name?: string; version?: string } } }
  // ERC-4337 smart account / gasless (value is a wei decimal string; L-WIRE-03)
  | { type: 'ERC4337_IS_CONFIGURED' }
  | { type: 'ERC4337_GET_ADDRESS'; chain: EvmChainId; accountIndex: number }
  | { type: 'ERC4337_GET_BALANCE'; chain: EvmChainId; accountIndex: number }
  | { type: 'ERC4337_QUOTE_SEND'; chain: EvmChainId; accountIndex: number; to: string; value: string; paymasterToken?: string }
  | { type: 'ERC4337_SEND'; chain: EvmChainId; accountIndex: number; to: string; value: string; paymasterToken?: string }
  // dApp pipeline (B4.3)
  | { type: 'DAPP_REQUEST'; id: string; origin: string; method: string; params?: readonly unknown[] }
  // Approval flow (B4.4)
  | { type: 'APPROVAL_GET_PENDING'; id: string }
  | { type: 'APPROVAL_RESPOND'; id: string; approved: boolean; data?: unknown }
  | { type: 'APPROVAL_LIST_PENDING' }
  // Connections management (Settings → Connections)
  | { type: 'CONNECTIONS_LIST' }
  | { type: 'CONNECTIONS_REVOKE'; origin: string };

export type WalletMessageType = WalletMessage['type'];

export type WalletResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type WalletResponseData = {
  PING: 'pong';
  GET_LOCK_STATE: 'locked' | 'unlocked';
  LOCK: { ok: true };
  VAULT_HAS_STORED: boolean;
  VAULT_STORE: { ok: true };
  VAULT_LOAD: { ok: true };
  VAULT_CLEAR: { ok: true };
  BIP39_GENERATE_MNEMONIC: string;
  BIP39_VALIDATE_MNEMONIC: boolean;
  ACCOUNT_GET_EVM_ADDRESS: Hex;
  ACCOUNT_GET_SOLANA_ADDRESS: string;
  ACCOUNT_SIGN_MESSAGE: Hex | string;
  ACCOUNT_SIGN_TYPED_DATA: Hex;
  ACCOUNT_SIGN_SOLANA_MESSAGE: string;
  ACCOUNT_SEND_TRANSACTION: Hex;
  ACCOUNT_SEND_SOLANA_TRANSACTION: string;
  ACCOUNT_GET_BTC_ADDRESS: string;
  ACCOUNT_GET_BTC_BALANCE: string;
  ACCOUNT_SEND_BTC_TRANSACTION: string;
  ACCOUNT_GET_TON_ADDRESS: string;
  ACCOUNT_GET_TON_BALANCE: string;
  ACCOUNT_SEND_TON_TRANSACTION: string;
  ACCOUNT_GET_TRON_ADDRESS: string;
  ACCOUNT_GET_TRON_BALANCE: string;
  ACCOUNT_SEND_TRON_TRANSACTION: string;
  RPC_GET_BALANCE: string;
  RPC_GET_TOKEN_BALANCE: string;
  RPC_GET_TRANSACTION_STATUS: 'pending' | 'success' | 'failed';
  PRICING_GET_USD_PRICE: number | null;
  AAVE_GET_ACCOUNT_DATA: AaveAccountDataDto;
  AAVE_QUOTE: string;
  AAVE_SUPPLY: AaveActionResultDto;
  AAVE_WITHDRAW: AaveActionResultDto;
  AAVE_BORROW: AaveActionResultDto;
  AAVE_REPAY: AaveActionResultDto;
  VELORA_QUOTE_SWAP: VeloraQuoteDto;
  VELORA_SWAP: VeloraSwapResultDto;
  USDT0_QUOTE_BRIDGE: { readonly fee: string };
  USDT0_BRIDGE: { readonly hash: string; readonly fee: string; readonly approveHash?: string };
  MOONPAY_IS_CONFIGURED: boolean;
  MOONPAY_QUOTE_BUY: MoonPayBuyQuoteDto | null;
  MOONPAY_BUY: string;
  X402_CREATE_PAYMENT: string;
  ERC4337_IS_CONFIGURED: boolean;
  ERC4337_GET_ADDRESS: string;
  ERC4337_GET_BALANCE: string;
  ERC4337_QUOTE_SEND: string;
  ERC4337_SEND: { readonly hash: string; readonly fee: string };
  DAPP_REQUEST: Eip1193Response;
  APPROVAL_GET_PENDING: ApprovalRequest | null;
  APPROVAL_RESPOND: { ok: boolean };
  APPROVAL_LIST_PENDING: string[];
  CONNECTIONS_LIST: readonly ConnectionDto[];
  CONNECTIONS_REVOKE: { ok: boolean };
};

/** A connected dApp over the wire (Settings → Connections UI). */
export interface ConnectionDto {
  readonly origin: string;
  /** Approved chain keys (e.g. "ethereum", "polygon-mainnet"). */
  readonly chains: readonly string[];
  readonly accountIndices: readonly number[];
  readonly approvedAt: number;
}

/** Aave V3 account snapshot over the wire — bigints as decimal strings (L-WIRE-03). */
export interface AaveAccountDataDto {
  readonly totalCollateralBase: string;
  readonly totalDebtBase: string;
  readonly availableBorrowsBase: string;
  readonly currentLiquidationThreshold: string;
  readonly ltv: string;
  readonly healthFactor: string;
}

/** Result of a state-changing Aave action over the wire. */
export interface AaveActionResultDto {
  readonly hash: string;
  readonly fee: string;
  readonly approveHash?: string;
}

/** MoonPay buy quote over the wire — fiat/crypto amounts as JS numbers. */
export interface MoonPayBuyQuoteDto {
  readonly fiatAmount: number;
  readonly cryptoAmount: number;
  readonly feeAmount: number;
  readonly totalAmount: number;
}

/** Velora swap quote over the wire — bigints as decimal strings. */
export interface VeloraQuoteDto {
  readonly fee: string;
  readonly tokenInAmount: string;
  readonly tokenOutAmount: string;
}

/** Velora executed-swap result over the wire. */
export interface VeloraSwapResultDto {
  readonly hash: string;
  readonly fee: string;
  readonly tokenInAmount: string;
  readonly tokenOutAmount: string;
  readonly approveHash?: string;
}