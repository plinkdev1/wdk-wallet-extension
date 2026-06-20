/**
 * Extension-local RpcAdapter with per-chain URL overrides.
 *
 * v0.1 motivation: wdk-web-core's createHttpRpcAdapter() takes no args and
 * resolves RPC URLs from each chain module's baked-in config. The default
 * ethereum RPC (LlamaRPC) was returning HTML error pages instead of JSON
 * during B6 smoke. Rather than modify the shared wdk-web-core package, this
 * adapter keeps the URL choice extension-local where it can be swapped to
 * Alchemy/Infura without touching the dependency.
 *
 * Same interface as the upstream adapter (RpcAdapter). Uses viem for EVM
 * chains. Solana is not implemented at v0.1 (no Solana UI yet); add when
 * Solana surfaces ship.
 *
 * v0.2 swap path:
 *   - Add Alchemy key support via env-driven config
 *   - Multi-endpoint fallback (primary/secondary/tertiary per chain)
 *   - WebSocket subscription support for live balance updates
 */

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import type { ChainId } from '@wdk-starter/wdk-web-core/types';
import type { RpcAdapter } from '@wdk-starter/wdk-web-core';

/**
 * Per-chain RPC URL overrides. v0.1 only configures ethereum since that's
 * the only chain the wallet surfaces a balance for. Add other chains as
 * the UI starts using them.
 *
 * URL choices:
 *   - cloudflare-eth.com: Cloudflare's public ETH RPC. Free, no API key,
 *     reliable, supports CORS. Production-suitable for low-medium volume.
 *
 * When you have an Alchemy/Infura API key, swap the URL here:
 *   'ethereum': `https://eth-mainnet.g.alchemy.com/v2/${YOUR_KEY}`
 */
// Vite statically replaces `import.meta.env.VITE_ETH_RPC_URL` at build time
// when the build runs from a project whose envDir contains a .env file with
// that key. See vite-env.d.ts for the type declaration that lets TS accept it.
// Falls back to Cloudflare's public ETH RPC when the env var is not set.
const ETHEREUM_RPC_URL: string =
  import.meta.env.VITE_ETH_RPC_URL ?? 'https://ethereum-rpc.publicnode.com';
// Sepolia testnet RPC. Override with VITE_SEPOLIA_RPC_URL for Alchemy/Infura/etc;
// public default is PublicNode's free Sepolia gateway. Added B1b polish followup.
const SEPOLIA_RPC_URL: string =
  import.meta.env.VITE_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const EVM_RPC_OVERRIDES: Partial<Record<ChainId, string>> = {
  'ethereum': ETHEREUM_RPC_URL,
  'sepolia-testnet': SEPOLIA_RPC_URL,
  // B1-2 polish: previously-wired chains that never had RPC overrides
  // (picker only offered ethereum+sepolia until B1-2 made them selectable).
  'plasma-mainnet': 'https://rpc.plasma.to',
  'plasma-testnet': 'https://testnet-rpc.plasma.to',
  'polygon-mainnet': 'https://polygon-bor-rpc.publicnode.com',  // polygon-rpc.com deprecated public access in 2026
  'arbitrum-mainnet': 'https://arb1.arbitrum.io/rpc',
  // B1-2: bulk-add public RPCs for 42 additional EVM chains.
  // To override any of these with Alchemy/Infura keys, add a VITE_<CHAIN>_RPC_URL
  // env var and a parallel `const FOO_RPC_URL = import.meta.env.VITE_FOO_RPC_URL ?? ...`
  // pattern above, then reference it here. Done piecemeal as needed; no point
  // declaring 42 env vars up-front since most consumers will only use a few.
  'optimism-mainnet': 'https://mainnet.optimism.io',
  'base-mainnet': 'https://mainnet.base.org',
  'bsc-mainnet': 'https://bsc-rpc.publicnode.com',
  'avalanche-mainnet': 'https://api.avax.network/ext/bc/C/rpc',
  'gnosis-mainnet': 'https://rpc.gnosischain.com',
  'celo-mainnet': 'https://forno.celo.org',
  'moonbeam-mainnet': 'https://rpc.api.moonbeam.network',
  'moonriver-mainnet': 'https://rpc.api.moonriver.moonbeam.network',
  'cronos-mainnet': 'https://evm.cronos.org',
  'linea-mainnet': 'https://rpc.linea.build',
  'scroll-mainnet': 'https://rpc.scroll.io',
  'zksync-mainnet': 'https://mainnet.era.zksync.io',
  'polygon-zkevm-mainnet': 'https://zkevm-rpc.com',
  'mantle-mainnet': 'https://rpc.mantle.xyz',
  'blast-mainnet': 'https://rpc.blast.io',
  'mode-mainnet': 'https://mainnet.mode.network',
  'metis-mainnet': 'https://andromeda.metis.io/?owner=1088',
  'worldchain-mainnet': 'https://worldchain-mainnet.g.alchemy.com/public',
  'sonic-mainnet': 'https://rpc.soniclabs.com',
  'boba-mainnet': 'https://mainnet.boba.network',
  'zora-mainnet': 'https://rpc.zora.energy',
  'manta-pacific-mainnet': 'https://pacific-rpc.manta.network/http',
  'taiko-mainnet': 'https://rpc.mainnet.taiko.xyz',
  'berachain-mainnet': 'https://rpc.berachain.com',
  'abstract-mainnet': 'https://api.mainnet.abs.xyz',
  'ink-mainnet': 'https://rpc-gel.inkonchain.com',
  'unichain-mainnet': 'https://mainnet.unichain.org',
  'soneium-mainnet': 'https://rpc.soneium.org',
  'holesky-testnet': 'https://ethereum-holesky-rpc.publicnode.com',
  'hoodi-testnet': 'https://rpc.hoodi.ethpandaops.io',
  'optimism-sepolia-testnet': 'https://sepolia.optimism.io',
  'base-sepolia-testnet': 'https://sepolia.base.org',
  'arbitrum-sepolia-testnet': 'https://sepolia-rollup.arbitrum.io/rpc',
  'polygon-amoy-testnet': 'https://rpc-amoy.polygon.technology',
  'avalanche-fuji-testnet': 'https://api.avax-test.network/ext/bc/C/rpc',
  'bsc-testnet': 'https://bsc-testnet-rpc.publicnode.com',
  'linea-sepolia-testnet': 'https://rpc.sepolia.linea.build',
  'scroll-sepolia-testnet': 'https://sepolia-rpc.scroll.io',
  'zksync-sepolia-testnet': 'https://sepolia.era.zksync.dev',
  'mantle-sepolia-testnet': 'https://rpc.sepolia.mantle.xyz',
  'blast-sepolia-testnet': 'https://sepolia.blast.io',
  'moonbase-alpha-testnet': 'https://rpc.api.moonbase.moonbeam.network',
};

const ERC20_BALANCE_OF_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
] as const;

export function createExtensionRpcAdapter(): RpcAdapter {
  // Per-adapter viem client cache (keyed by chain:rpcUrl).
  const clientCache = new Map<string, PublicClient>();

  function getClient(chain: ChainId): PublicClient {
    const rpcUrl = EVM_RPC_OVERRIDES[chain];
    if (!rpcUrl) {
      throw new Error('No RPC override configured for chain: ' + chain);
    }
    const key = chain + ':' + rpcUrl;
    let client = clientCache.get(key);
    if (!client) {
      client = createPublicClient({ transport: http(rpcUrl) });
      clientCache.set(key, client);
    }
    return client;
  }

  return {
    async getBalance(chain, address) {
      const client = getClient(chain);
      return client.getBalance({ address: address as Address });
    },
    async getTokenBalance(chain, address, tokenAddress) {
      const client = getClient(chain);
      return client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [address as Address],
      });
    },
    async getTransactionStatus(chain, hash) {
      // EVM-only here: no override (e.g. Solana) → report pending (unreadable
      // via this adapter). The Activity poller treats 'pending' as keep-trying.
      const rpcUrl = EVM_RPC_OVERRIDES[chain];
      if (!rpcUrl) return 'pending';
      const client = getClient(chain);
      try {
        const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
        return receipt.status === 'success' ? 'success' : 'failed';
      } catch {
        return 'pending'; // not yet mined or transient RPC error
      }
    },
  };
}