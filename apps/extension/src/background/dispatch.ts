/**
 * Message dispatcher for the MV3 service worker.
 *
 * SECURITY: F-SEC-01 OUTER TIER - we use Object.hasOwn to whitelist message
 * types, NOT the `in` operator. Attacker-controlled message types like
 * 'toString', 'constructor', 'hasOwnProperty', or anything via
 * Object.prototype pollution would pass the check otherwise.
 *
 * Two-tier F-SEC-01 in this codebase:
 *   - Outer tier (this file): top-level message TYPES (PING, VAULT_LOAD,
 *     DAPP_REQUEST, APPROVAL_*, ...).
 *   - Inner tier (dapp-dispatcher.ts): EIP-1193 METHODS (eth_chainId, ...).
 *
 * See:
 *   - F-SEC-01 (the original finding)
 *   - packages/wdk-web-core/src/worker/mv3-handler.spec.ts (original regression test)
 *   - PRD 01 Addendum S2.3 + S5 + S12.6.3 + S12.6.5
 *   - ADR-011 (MV3 SW bootstrap)
 */

import type {
  WalletMessage,
  WalletMessageType,
  WalletResponseData,
} from '../types/messages.js';

export type MessageHandler<T extends WalletMessageType> = (
  message: Extract<WalletMessage, { type: T }>
) => Promise<WalletResponseData[T]>;

export type HandlerRegistry = { [T in WalletMessageType]: MessageHandler<T> };

function isMessageEnvelope(value: unknown): value is { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

export function createDispatcher(handlers: HandlerRegistry) {
  return async function dispatch(message: unknown): Promise<unknown> {
    if (!isMessageEnvelope(message)) {
      throw new Error('Invalid message: must be { type: string, ... }');
    }
    // F-SEC-01: Object.hasOwn, NOT `in`. Critical security boundary (outer tier).
    if (!Object.hasOwn(handlers, message.type)) {
      throw new Error(`Unknown message type: ${message.type}`);
    }
    const handler = handlers[message.type as WalletMessageType] as (
      m: unknown
    ) => Promise<unknown>;
    return handler(message);
  };
}

/**
 * Stub handler registry. Real handlers ship via createSwHandlers in
 * handlers.ts. Used for isolated dispatcher tests.
 */
export function createStubHandlers(): HandlerRegistry {
  const notImplemented = (type: string) =>
    async (): Promise<never> => {
      throw new Error(`Handler not implemented: ${type}`);
    };

  return {
    PING: async () => 'pong',
    GET_LOCK_STATE: notImplemented('GET_LOCK_STATE'),
    LOCK: notImplemented('LOCK'),
    VAULT_HAS_STORED: notImplemented('VAULT_HAS_STORED'),
    VAULT_STORE: notImplemented('VAULT_STORE'),
    VAULT_LOAD: notImplemented('VAULT_LOAD'),
    VAULT_CLEAR: notImplemented('VAULT_CLEAR'),
    BIP39_GENERATE_MNEMONIC: notImplemented('BIP39_GENERATE_MNEMONIC'),
    BIP39_VALIDATE_MNEMONIC: notImplemented('BIP39_VALIDATE_MNEMONIC'),
    ACCOUNT_GET_EVM_ADDRESS: notImplemented('ACCOUNT_GET_EVM_ADDRESS'),
    ACCOUNT_GET_SOLANA_ADDRESS: notImplemented('ACCOUNT_GET_SOLANA_ADDRESS'),
    ACCOUNT_SIGN_MESSAGE: notImplemented('ACCOUNT_SIGN_MESSAGE'),
    ACCOUNT_SIGN_TYPED_DATA: notImplemented('ACCOUNT_SIGN_TYPED_DATA'),
    ACCOUNT_SIGN_SOLANA_MESSAGE: notImplemented('ACCOUNT_SIGN_SOLANA_MESSAGE'),
    RPC_GET_BALANCE: notImplemented('RPC_GET_BALANCE'),
    DAPP_REQUEST: notImplemented('DAPP_REQUEST'),
    // B4.4: approval-flow handshake stubs (real impls in createSwHandlers).
    APPROVAL_GET_PENDING: notImplemented('APPROVAL_GET_PENDING'),
    APPROVAL_RESPOND: notImplemented('APPROVAL_RESPOND'),
    APPROVAL_LIST_PENDING: notImplemented('APPROVAL_LIST_PENDING'),
  };
}