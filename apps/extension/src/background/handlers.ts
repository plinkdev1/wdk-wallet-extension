/**
 * SW handler factory (B3.4b WDK wiring; B4.3 + DAPP_REQUEST; B4.4 + approval flow;
 * B4.6 + connection state + real per-method handlers).
 *
 * Three handler families:
 *   Internal popup ops (PING through RPC_GET_BALANCE) - vault/account/signing
 *     for user actions in the wallet UI.
 *   DAPP_REQUEST (S12.6.3) - inpage-originated EIP-1193 requests. Routed
 *     through createDappDispatcher (F-SEC-01 inner tier per S12.6.5) and
 *     createDappHandlers (B4.6 real implementations for eth_chainId,
 *     eth_accounts, eth_requestAccounts; other methods stubbed).
 *   APPROVAL_* (S12.6.2) - popup-driven approval flow handshake.
 *
 * Lifecycle integration:
 *   LOCK -> approvalFlow.cancelAll() but NOT connectionState.revokeAll() (lock
 *     is security pause, not "I no longer trust these dApps")
 *   VAULT_CLEAR -> both cancelAll() AND revokeAll() (fresh wallet = fresh
 *     allow-list; previous dApp permissions don't carry over)
 */

import type { HandlerRegistry } from './dispatch.js';
import type { WalletEngine } from './engine.js';
import type { WalletWorker } from '@wdk-starter/wdk-web-core/worker';
import type { Eip1193Method } from '../types/dapp-messages.js';
import { createDappDispatcher } from './dapp-dispatcher.js';
import { createDappHandlers } from './dapp-handlers.js';
import type { ApprovalFlow } from './approval-flow.js';
import type { ConnectionState } from './connection-state.js';
import type { DappEventBus } from './dapp-event-bus.js';

export interface SwHandlersDeps {
  engine: WalletEngine;
  worker: WalletWorker;
  /** Approval flow state. B4.4 addition. */
  approvalFlow: ApprovalFlow;
  /** Per-origin connection allow-list. B4.6 addition. */
  connectionState: ConnectionState;
  /** SW->content event bus for EIP-1193 events. B4.9a/b addition. Optional for back-compat with older tests. */
  eventBus?: DappEventBus;
}

const utf8Encoder = new TextEncoder();

export function createSwHandlers({ engine, worker, approvalFlow, connectionState, eventBus }: SwHandlersDeps): HandlerRegistry {
  // Inner EIP-1193 dispatcher (F-SEC-01 inner tier per S12.6.3). B4.6 ships
  // real handlers for eth_chainId, eth_accounts, eth_requestAccounts wired to
  // approvalFlow + connectionState; others remain -32601 stubs.
  const dappDispatch = createDappDispatcher(
    createDappHandlers({ engine, worker, approvalFlow, connectionState, ...(eventBus !== undefined ? { eventBus } : {}) }),
  );

  return {
    PING: async () => 'pong',
    GET_LOCK_STATE: async () => engine.getLockState(),

    LOCK: async () => {
      await worker.lock();
      engine.lock();
      // Lock cancels pending approvals (user walked away). Does NOT revoke
      // connections - locking is a security pause, not a trust withdrawal.
      approvalFlow.cancelAll('Wallet locked');
      return { ok: true as const };
    },

    VAULT_HAS_STORED: async () => worker.vault_hasStored(),

    BIP39_GENERATE_MNEMONIC: async () => worker.bip39_generateMnemonic(),

    BIP39_VALIDATE_MNEMONIC: async (msg) => worker.bip39_validateMnemonic(msg.mnemonic),

    VAULT_STORE: async (msg) => {
      const plaintext = utf8Encoder.encode(msg.mnemonic);
      await worker.vault_store(msg.password, plaintext);
      return { ok: true as const };
    },

    VAULT_LOAD: async (msg) => {
      await worker.vault_load(msg.password);
      await engine.unlock(msg.password);
      return { ok: true as const };
    },

    VAULT_CLEAR: async () => {
      await worker.vault_clear();
      engine.lock();
      approvalFlow.cancelAll('Wallet reset');
      // VAULT_CLEAR = fresh wallet => fresh allow-list. Previous dApp
      // permissions don't carry over to the new wallet.
      await connectionState.load();
      await connectionState.revokeAll();
      return { ok: true as const };
    },

    ACCOUNT_GET_EVM_ADDRESS: async (msg) => {
      return worker.account_getEvmAddress(msg.chain, msg.accountIndex);
    },

    ACCOUNT_GET_SOLANA_ADDRESS: async (msg) => {
      return worker.account_getSolanaAddress(msg.chain, msg.accountIndex);
    },

    ACCOUNT_SIGN_MESSAGE: async (msg) => {
      if (msg.chain === 'solana-mainnet' || msg.chain === 'solana-devnet' || msg.chain === 'solana-testnet') {
        throw new Error('Use ACCOUNT_SIGN_SOLANA_MESSAGE for Solana chains');
      }
      return worker.account_signMessage(msg.chain, msg.accountIndex, msg.message);
    },

    ACCOUNT_SIGN_TYPED_DATA: async (msg) => {
      return worker.account_signTypedData(
        msg.chain,
        msg.accountIndex,
        msg.payload as Parameters<typeof worker.account_signTypedData>[2],
      );
    },

    ACCOUNT_SIGN_SOLANA_MESSAGE: async (msg) => {
      const bytes = utf8Encoder.encode(msg.message);
      return worker.account_signSolanaMessage(msg.chain, msg.accountIndex, bytes);
    },

    ACCOUNT_SEND_TRANSACTION: async (msg) => {
      // User-initiated EVM transfer from the popup. value arrives as a base-unit
      // decimal string (L-WIRE-03); WDK signs + broadcasts and returns the hash.
      return worker.account_sendTransaction(msg.chain, msg.accountIndex, {
        to: msg.to,
        value: BigInt(msg.value),
      });
    },

    ACCOUNT_SEND_SOLANA_TRANSACTION: async (msg) => {
      // User-initiated native SOL transfer from the popup. value arrives as a
      // lamports decimal string; WDK builds, signs + broadcasts, returns the sig.
      return worker.account_sendSolanaTransaction(msg.chain, msg.accountIndex, msg.to, BigInt(msg.value));
    },

    RPC_GET_BALANCE: async (msg) => {
      const balance = await worker.rpc_getBalance(msg.chain, msg.address);
      return balance.toString();
    },

    RPC_GET_TOKEN_BALANCE: async (msg) => {
      const balance = await worker.rpc_getTokenBalance(msg.chain, msg.address, msg.tokenAddress);
      return balance.toString();
    },

    DAPP_REQUEST: async (msg) => {
      // ctx.id threads the DAPP_REQUEST envelope id through to approvalFlow.open()
      // so the popup's APPROVAL_GET_PENDING(id) call matches.
      const ctx = { origin: msg.origin, id: msg.id };
      const req = { method: msg.method, params: msg.params };
      try {
        const result = await dappDispatch(req as any, ctx);
        return { result };
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
          const e = err as { code: number; message: string };
          if (typeof e.code === 'number' && typeof e.message === 'string') {
            return { error: { code: e.code, message: e.message } };
          }
        }
        return {
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },

    APPROVAL_GET_PENDING: async (msg) => {
      return approvalFlow.getPending(msg.id);
    },

    APPROVAL_RESPOND: async (msg) => {
      const ok = approvalFlow.respond(msg.id, { approved: msg.approved, data: msg.data });
      return { ok };
    },

    APPROVAL_LIST_PENDING: async () => {
      return approvalFlow.listPending();
    },
  };
}

export type { Eip1193Method };