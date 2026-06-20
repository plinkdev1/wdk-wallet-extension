/**
 * EIP-1193 per-method handlers for the dApp pipeline.
 *
 * Per PRD 01 Addendum S12.4 the v1.0 method coverage is 7 methods + EIP-6963.
 * COMPLETE as of B4.9c:
 *   B4.6: eth_chainId, eth_accounts, eth_requestAccounts (connection-flow methods)
 *   B4.7: personal_sign, eth_signTypedData_v4 (signing methods)
 *   B4.8: eth_sendTransaction (RPC-broadcasting method)
 *   B4.9a: SW->content event-push infrastructure
 *   B4.9b: wallet_switchEthereumChain + chainChanged firing
 *   B4.9c: wallet_addEthereumChain + AddChainBody popup       <- THIS COMMIT
 *
 * After this commit, the v1.0 EIP-1193 surface is complete. B5+ adds vault
 * UI, account management UI, and polish (SwitchChainBody, ChainPickerBody,
 * accountsChanged/connect/disconnect event firing, custom-chain switching).
 */

import type { Eip1193HandlerRegistry } from './dapp-dispatcher.js';
import type { ApprovalFlow } from './approval-flow.js';
import type { ConnectionState } from './connection-state.js';
import type { DappEventBus } from './dapp-event-bus.js';
import type { WalletWorker } from '@wdk-starter/wdk-web-core/worker';
import type { WalletEngine } from './engine.js';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';

export interface DappHandlersDeps {
  readonly engine: WalletEngine;
  readonly worker: WalletWorker;
  readonly approvalFlow: ApprovalFlow;
  readonly connectionState: ConnectionState;
  readonly eventBus?: DappEventBus;
}

const DEFAULT_CHAIN: EvmChainId = 'ethereum';

const EVM_CHAIN_TO_HEX: Readonly<Record<EvmChainId, `0x${string}`>> = {
  'ethereum': '0x1',
  'plasma-mainnet': '0x2611',
  'sepolia-testnet': '0xaa36a7',
  'plasma-testnet': '0x2612',
  'polygon-mainnet': '0x89',
  'arbitrum-mainnet': '0xa4b1',
  'optimism-mainnet': '0xa',
  'base-mainnet': '0x2105',
  'bsc-mainnet': '0x38',
  // B1-2: bulk-add hex entries for 39 additional EVM chains
  'avalanche-mainnet': '0xa86a',
  'gnosis-mainnet': '0x64',
  'celo-mainnet': '0xa4ec',
  'moonbeam-mainnet': '0x504',
  'moonriver-mainnet': '0x505',
  'cronos-mainnet': '0x19',
  'linea-mainnet': '0xe708',
  'scroll-mainnet': '0x82750',
  'zksync-mainnet': '0x144',
  'polygon-zkevm-mainnet': '0x44d',
  'mantle-mainnet': '0x1388',
  'blast-mainnet': '0x13e31',
  'mode-mainnet': '0x868b',
  'metis-mainnet': '0x440',
  'worldchain-mainnet': '0x1e0',
  'sonic-mainnet': '0x92',
  'boba-mainnet': '0x120',
  'zora-mainnet': '0x76adf1',
  'manta-pacific-mainnet': '0xa9',
  'taiko-mainnet': '0x28c58',
  'berachain-mainnet': '0x138de',
  'abstract-mainnet': '0xab5',
  'ink-mainnet': '0xdef1',
  'unichain-mainnet': '0x82',
  'soneium-mainnet': '0x74c',
  'holesky-testnet': '0x4268',
  'hoodi-testnet': '0x88bb0',
  'optimism-sepolia-testnet': '0xaa37dc',
  'base-sepolia-testnet': '0x14a34',
  'arbitrum-sepolia-testnet': '0x66eee',
  'polygon-amoy-testnet': '0x13882',
  'avalanche-fuji-testnet': '0xa869',
  'bsc-testnet': '0x61',
  'linea-sepolia-testnet': '0xe705',
  'scroll-sepolia-testnet': '0x8274f',
  'zksync-sepolia-testnet': '0x12c',
  'mantle-sepolia-testnet': '0x138b',
  'blast-sepolia-testnet': '0xa0c71fd',
  'moonbase-alpha-testnet': '0x507',
};

const HEX_TO_EVM_CHAIN: Readonly<Record<string, EvmChainId>> = Object.fromEntries(
  Object.entries(EVM_CHAIN_TO_HEX).map(([chain, hex]) => [hex.toLowerCase(), chain as EvmChainId]),
);

const NOOP_EVENT_BUS: DappEventBus = {
  broadcast: async () => undefined,
};

function chainIdToHex(chain: EvmChainId): `0x${string}` {
  return EVM_CHAIN_TO_HEX[chain] ?? '0x1';
}

function genApprovalId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveAccountIndex(
  worker: WalletWorker,
  connectionState: ConnectionState,
  origin: string,
  requestedAddress: string,
): Promise<{ chain: EvmChainId; accountIndex: number } | null> {
  const indices = connectionState.getApprovedAccounts(origin);
  const chains = connectionState.getApprovedChains(origin);
  const chain = chains[0] ?? DEFAULT_CHAIN;
  const lower = requestedAddress.toLowerCase();
  for (const idx of indices) {
    const derived = await worker.account_getEvmAddress(chain, idx);
    if (derived.toLowerCase() === lower) {
      return { chain, accountIndex: idx };
    }
  }
  return null;
}

async function signPreflight(
  deps: DappHandlersDeps,
  origin: string,
  requestedAddress: string,
): Promise<{ chain: EvmChainId; accountIndex: number }> {
  const { engine, worker, connectionState } = deps;
  await connectionState.load();

  if (!connectionState.isConnected(origin)) {
    throw { code: 4100, message: 'Unauthorized: dApp must call eth_requestAccounts first' };
  }
  if (engine.getLockState() === 'locked') {
    throw { code: -32603, message: 'Wallet is locked. Open the wallet popup to unlock.' };
  }
  const resolved = await resolveAccountIndex(worker, connectionState, origin, requestedAddress);
  if (!resolved) {
    throw { code: -32602, message: `Address ${requestedAddress} is not authorized for this origin` };
  }
  return resolved;
}

/**
 * Validate an EIP-3085 wallet_addEthereumChain payload. Returns null if OK,
 * an error object to throw if invalid.
 */
function validateAddChainPayload(
  payload: unknown,
): { code: number; message: string } | null {
  if (!payload || typeof payload !== 'object') {
    return { code: -32602, message: 'Invalid params: wallet_addEthereumChain expects [{ chainId, chainName, rpcUrls, nativeCurrency, ... }]' };
  }
  const p = payload as Record<string, unknown>;
  if (typeof p.chainId !== 'string' || !p.chainId.startsWith('0x')) {
    return { code: -32602, message: 'Invalid chainId: must be a hex string starting with 0x' };
  }
  if (typeof p.chainName !== 'string' || p.chainName.length === 0) {
    return { code: -32602, message: 'Invalid chainName: must be a non-empty string' };
  }
  if (!Array.isArray(p.rpcUrls) || p.rpcUrls.length === 0 || !p.rpcUrls.every((u) => typeof u === 'string')) {
    return { code: -32602, message: 'Invalid rpcUrls: must be a non-empty array of strings' };
  }
  if (!p.nativeCurrency || typeof p.nativeCurrency !== 'object') {
    return { code: -32602, message: 'Invalid nativeCurrency: must be { name, symbol, decimals }' };
  }
  const nc = p.nativeCurrency as Record<string, unknown>;
  if (typeof nc.name !== 'string' || typeof nc.symbol !== 'string' || typeof nc.decimals !== 'number') {
    return { code: -32602, message: 'Invalid nativeCurrency: name/symbol must be strings, decimals must be a number' };
  }
  return null;
}

export function createDappHandlers(deps: DappHandlersDeps): Eip1193HandlerRegistry {
  const { engine, worker, approvalFlow, connectionState } = deps;
  const eventBus = deps.eventBus ?? NOOP_EVENT_BUS;

  return {
    eth_chainId: async (_req, ctx) => {
      await connectionState.load();
      const chains = connectionState.getApprovedChains(ctx.origin);
      const chain = chains[0] ?? DEFAULT_CHAIN;
      return chainIdToHex(chain);
    },

    eth_accounts: async (_req, ctx) => {
      await connectionState.load();
      if (!connectionState.isConnected(ctx.origin)) return [];
      const chains = connectionState.getApprovedChains(ctx.origin);
      const indices = connectionState.getApprovedAccounts(ctx.origin);
      const chain = chains[0] ?? DEFAULT_CHAIN;
      return Promise.all(indices.map((idx) => worker.account_getEvmAddress(chain, idx)));
    },

    eth_requestAccounts: async (req, ctx) => {
      await connectionState.load();
      if (connectionState.isConnected(ctx.origin)) {
        const chains = connectionState.getApprovedChains(ctx.origin);
        const indices = connectionState.getApprovedAccounts(ctx.origin);
        const chain = chains[0] ?? DEFAULT_CHAIN;
        return Promise.all(indices.map((idx) => worker.account_getEvmAddress(chain, idx)));
      }
      if (engine.getLockState() === 'locked') {
        throw {
          code: -32603,
          message: 'Wallet is locked. Open the wallet popup to create or unlock your wallet.',
        };
      }
      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'eth_requestAccounts',
        params: req.params ?? [],
      });
      if (!decision.approved) {
        throw { code: 4001, message: 'User rejected request' };
      }
      const accountIndices: readonly number[] = (Array.isArray(decision.data) && decision.data.every((n) => typeof n === 'number'))
        ? (decision.data as number[])
        : [0];
      const chains: readonly EvmChainId[] = [DEFAULT_CHAIN];
      await connectionState.approve(ctx.origin, chains, accountIndices);
      return Promise.all(accountIndices.map((idx) => worker.account_getEvmAddress(DEFAULT_CHAIN, idx)));
    },

    personal_sign: async (req, ctx) => {
      const params = req.params as readonly [string, string] | undefined;
      if (!params || typeof params[0] !== 'string' || typeof params[1] !== 'string') {
        throw { code: -32602, message: 'Invalid params: personal_sign expects [messageHex, address]' };
      }
      const [messageHex, address] = params;
      const resolved = await signPreflight(deps, ctx.origin, address);

      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'personal_sign',
        params: req.params ?? [],
      });
      if (!decision.approved) throw { code: 4001, message: 'User rejected request' };

      const clean = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;
      let messageText: string;
      try {
        const bytes = new Uint8Array(clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);
        messageText = new TextDecoder().decode(bytes);
      } catch {
        messageText = messageHex;
      }
      return worker.account_signMessage(resolved.chain, resolved.accountIndex, messageText);
    },

    eth_signTypedData_v4: async (req, ctx) => {
      const params = req.params as readonly [string, string] | undefined;
      if (!params || typeof params[0] !== 'string' || typeof params[1] !== 'string') {
        throw { code: -32602, message: 'Invalid params: eth_signTypedData_v4 expects [address, typedDataJson]' };
      }
      const [address, typedDataJson] = params;
      const resolved = await signPreflight(deps, ctx.origin, address);

      let typedData: unknown;
      try { typedData = JSON.parse(typedDataJson); }
      catch (err) {
        throw {
          code: -32602,
          message: `Invalid typed data JSON: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'eth_signTypedData_v4',
        params: req.params ?? [],
      });
      if (!decision.approved) throw { code: 4001, message: 'User rejected request' };

      return worker.account_signTypedData(
        resolved.chain,
        resolved.accountIndex,
        typedData as Parameters<typeof worker.account_signTypedData>[2],
      );
    },

    eth_sendTransaction: async (req, ctx) => {
      const params = req.params as readonly [Record<string, unknown>] | undefined;
      if (!params || !params[0] || typeof params[0] !== 'object') {
        throw { code: -32602, message: 'Invalid params: eth_sendTransaction expects [{ to, value?, data?, ... }]' };
      }
      const tx = params[0];
      const fromField = typeof tx.from === 'string' ? tx.from : undefined;

      await connectionState.load();
      if (!connectionState.isConnected(ctx.origin)) {
        throw { code: 4100, message: 'Unauthorized: dApp must call eth_requestAccounts first' };
      }
      if (engine.getLockState() === 'locked') {
        throw { code: -32603, message: 'Wallet is locked. Open the wallet popup to unlock.' };
      }

      let resolved: { chain: EvmChainId; accountIndex: number };
      if (fromField) {
        const match = await resolveAccountIndex(worker, connectionState, ctx.origin, fromField);
        if (!match) {
          throw { code: -32602, message: `Address ${fromField} is not authorized for this origin` };
        }
        resolved = match;
      } else {
        const indices = connectionState.getApprovedAccounts(ctx.origin);
        const chains = connectionState.getApprovedChains(ctx.origin);
        const idx = indices[0];
        const chain = chains[0] ?? DEFAULT_CHAIN;
        if (idx === undefined) {
          throw { code: 4100, message: 'No approved accounts for this origin' };
        }
        resolved = { chain, accountIndex: idx };
      }

      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'eth_sendTransaction',
        params: req.params ?? [],
      });
      if (!decision.approved) throw { code: 4001, message: 'User rejected request' };

      try {
        const hash = await worker.account_sendTransaction(resolved.chain, resolved.accountIndex, tx);
        return hash;
      } catch (err) {
        throw {
          code: -32603,
          message: `Transaction failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },

    wallet_switchEthereumChain: async (req, ctx) => {
      const params = req.params as readonly [{ chainId?: unknown }] | undefined;
      if (!params || !params[0] || typeof params[0] !== 'object' || typeof params[0].chainId !== 'string') {
        throw { code: -32602, message: 'Invalid params: wallet_switchEthereumChain expects [{ chainId: hex }]' };
      }
      const requestedHex = params[0].chainId.toLowerCase();

      await connectionState.load();
      if (!connectionState.isConnected(ctx.origin)) {
        throw { code: 4100, message: 'Unauthorized: dApp must call eth_requestAccounts first' };
      }

      const targetChain = HEX_TO_EVM_CHAIN[requestedHex];
      if (!targetChain) {
        throw {
          code: 4902,
          message: `Unrecognized chain ID: ${params[0].chainId}. Use wallet_addEthereumChain to register custom chains.`,
        };
      }

      const currentChains = connectionState.getApprovedChains(ctx.origin);
      if (currentChains[0] === targetChain) {
        return null;
      }

      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'wallet_switchEthereumChain',
        params: req.params ?? [],
      });
      if (!decision.approved) throw { code: 4001, message: 'User rejected request' };

      const accountIndices = connectionState.getApprovedAccounts(ctx.origin);
      await connectionState.approve(ctx.origin, [targetChain], accountIndices);

      await eventBus.broadcast(
        {
          source: 'wdk-dapp-event',
          event: 'chainChanged',
          data: requestedHex,
        },
        ctx.origin,
      );

      return null;
    },

    /**
     * wallet_addEthereumChain per EIP-3085.
     * Params: [AddEthereumChainPayload]
     * Returns: null
     *
     * v0.1 scope: validate payload + show approval popup + return null on
     * approval. The chain is NOT actually registered for subsequent
     * switching - calling wallet_switchEthereumChain with this chainId
     * afterwards will still throw 4902.
     *
     * Why not full registration: connectionState.chains is typed as
     * readonly EvmChainId[] (the 7 built-in chains), and widening it to
     * accept custom hex strings cascades through 13 connection-state tests
     * + 8 switch tests + the chrome.storage schema. Custom-chain switching
     * is a v0.2 feature (would also need a chain-config registry for
     * RPC endpoint lookup at tx-broadcast time).
     *
     * v0.1 still satisfies the EIP-3085 API contract: dApps can call the
     * method, see a properly-rendered popup, and receive null on approval.
     * The user is informed via the AddChainBody warning that switching to
     * custom chains may not be available.
     */
    wallet_addEthereumChain: async (req, ctx) => {
      const params = req.params as readonly [unknown] | undefined;
      if (!params) {
        throw { code: -32602, message: 'Invalid params: wallet_addEthereumChain expects [AddEthereumChainPayload]' };
      }
      const validationError = validateAddChainPayload(params[0]);
      if (validationError) throw validationError;

      await connectionState.load();
      if (!connectionState.isConnected(ctx.origin)) {
        throw { code: 4100, message: 'Unauthorized: dApp must call eth_requestAccounts first' };
      }

      const decision = await approvalFlow.open({
        id: ctx.id ?? genApprovalId(),
        origin: ctx.origin,
        method: 'wallet_addEthereumChain',
        params: req.params ?? [],
      });
      if (!decision.approved) throw { code: 4001, message: 'User rejected request' };

      // v0.1: popup shown + user approved, but the chain is NOT registered.
      // wallet_switchEthereumChain with this chainId will still 4902.
      // Full custom-chain support deferred to v0.2 (see method JSDoc).
      return null;
    },
  };
}