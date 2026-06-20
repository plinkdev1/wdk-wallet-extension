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
  // dApp pipeline (B4.3)
  | { type: 'DAPP_REQUEST'; id: string; origin: string; method: string; params?: readonly unknown[] }
  // Approval flow (B4.4)
  | { type: 'APPROVAL_GET_PENDING'; id: string }
  | { type: 'APPROVAL_RESPOND'; id: string; approved: boolean; data?: unknown }
  | { type: 'APPROVAL_LIST_PENDING' };

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
  DAPP_REQUEST: Eip1193Response;
  APPROVAL_GET_PENDING: ApprovalRequest | null;
  APPROVAL_RESPOND: { ok: boolean };
  APPROVAL_LIST_PENDING: string[];
};