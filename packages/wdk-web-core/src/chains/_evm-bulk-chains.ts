/**
 * EVM bulk chain registry - B1-2.
 *
 * 28 mainnets + 14 testnets = 42 chains, all sharing the
 * WalletManagerEvm engine via the defineEvmChain factory. RPC URLs default
 * to vetted free public endpoints (PublicNode, official endpoints, etc.).
 * Override per-chain at runtime via EVM_RPC_OVERRIDES in the extension's
 * rpc-adapter (for Alchemy/Infura keys via env vars).
 *
 * Naming convention: <chain>-mainnet / <chain>-testnet. Network family is
 * indicated by the suffix.
 *
 * Adding a new chain: append one row here, add the id to EVM_CHAIN_IDS in
 * types/chains.ts, add the hex chainId to dapp-handlers.ts EVM_CHAIN_TO_HEX,
 * add the RPC override in rpc-adapter.ts, register the loader in
 * chains/index.ts CHAIN_LOADERS. (Future v0.2 phase may consolidate these
 * into a single source.)
 */

import type { EvmChainId } from '../types/chains.js';
import { defineEvmChain, type DefinedEvmChain } from './_evm-factory.js';

export const EVM_BULK_CHAINS: Readonly<Partial<Record<EvmChainId, DefinedEvmChain>>> = {
  'optimism-mainnet': defineEvmChain({ id: 'optimism-mainnet', chainId: 10, name: 'Optimism', testnet: false, rpcUrl: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' }),
  'base-mainnet': defineEvmChain({ id: 'base-mainnet', chainId: 8453, name: 'Base', testnet: false, rpcUrl: 'https://mainnet.base.org', explorer: 'https://basescan.org' }),
  'bsc-mainnet': defineEvmChain({ id: 'bsc-mainnet', chainId: 56, name: 'BNB Smart Chain', testnet: false, rpcUrl: 'https://bsc-rpc.publicnode.com', explorer: 'https://bscscan.com', nativeCurrency: { symbol: 'BNB', decimals: 18 } }),
  'avalanche-mainnet': defineEvmChain({ id: 'avalanche-mainnet', chainId: 43114, name: 'Avalanche C-Chain', testnet: false, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', explorer: 'https://snowtrace.io', nativeCurrency: { symbol: 'AVAX', decimals: 18 } }),
  'gnosis-mainnet': defineEvmChain({ id: 'gnosis-mainnet', chainId: 100, name: 'Gnosis Chain', testnet: false, rpcUrl: 'https://rpc.gnosischain.com', explorer: 'https://gnosisscan.io', nativeCurrency: { symbol: 'XDAI', decimals: 18 } }),
  'celo-mainnet': defineEvmChain({ id: 'celo-mainnet', chainId: 42220, name: 'Celo', testnet: false, rpcUrl: 'https://forno.celo.org', explorer: 'https://celoscan.io', nativeCurrency: { symbol: 'CELO', decimals: 18 } }),
  'moonbeam-mainnet': defineEvmChain({ id: 'moonbeam-mainnet', chainId: 1284, name: 'Moonbeam', testnet: false, rpcUrl: 'https://rpc.api.moonbeam.network', explorer: 'https://moonscan.io', nativeCurrency: { symbol: 'GLMR', decimals: 18 } }),
  'moonriver-mainnet': defineEvmChain({ id: 'moonriver-mainnet', chainId: 1285, name: 'Moonriver', testnet: false, rpcUrl: 'https://rpc.api.moonriver.moonbeam.network', explorer: 'https://moonriver.moonscan.io', nativeCurrency: { symbol: 'MOVR', decimals: 18 } }),
  'cronos-mainnet': defineEvmChain({ id: 'cronos-mainnet', chainId: 25, name: 'Cronos', testnet: false, rpcUrl: 'https://evm.cronos.org', explorer: 'https://cronoscan.com', nativeCurrency: { symbol: 'CRO', decimals: 18 } }),
  'linea-mainnet': defineEvmChain({ id: 'linea-mainnet', chainId: 59144, name: 'Linea', testnet: false, rpcUrl: 'https://rpc.linea.build', explorer: 'https://lineascan.build' }),
  'scroll-mainnet': defineEvmChain({ id: 'scroll-mainnet', chainId: 534352, name: 'Scroll', testnet: false, rpcUrl: 'https://rpc.scroll.io', explorer: 'https://scrollscan.com' }),
  'zksync-mainnet': defineEvmChain({ id: 'zksync-mainnet', chainId: 324, name: 'zkSync Era', testnet: false, rpcUrl: 'https://mainnet.era.zksync.io', explorer: 'https://explorer.zksync.io' }),
  'polygon-zkevm-mainnet': defineEvmChain({ id: 'polygon-zkevm-mainnet', chainId: 1101, name: 'Polygon zkEVM', testnet: false, rpcUrl: 'https://zkevm-rpc.com', explorer: 'https://zkevm.polygonscan.com' }),
  'mantle-mainnet': defineEvmChain({ id: 'mantle-mainnet', chainId: 5000, name: 'Mantle', testnet: false, rpcUrl: 'https://rpc.mantle.xyz', explorer: 'https://explorer.mantle.xyz', nativeCurrency: { symbol: 'MNT', decimals: 18 } }),
  'blast-mainnet': defineEvmChain({ id: 'blast-mainnet', chainId: 81457, name: 'Blast', testnet: false, rpcUrl: 'https://rpc.blast.io', explorer: 'https://blastscan.io' }),
  'mode-mainnet': defineEvmChain({ id: 'mode-mainnet', chainId: 34443, name: 'Mode', testnet: false, rpcUrl: 'https://mainnet.mode.network', explorer: 'https://explorer.mode.network' }),
  'metis-mainnet': defineEvmChain({ id: 'metis-mainnet', chainId: 1088, name: 'Metis Andromeda', testnet: false, rpcUrl: 'https://andromeda.metis.io/?owner=1088', explorer: 'https://andromeda-explorer.metis.io', nativeCurrency: { symbol: 'METIS', decimals: 18 } }),
  'worldchain-mainnet': defineEvmChain({ id: 'worldchain-mainnet', chainId: 480, name: 'World Chain', testnet: false, rpcUrl: 'https://worldchain-mainnet.g.alchemy.com/public', explorer: 'https://worldchain-mainnet.explorer.alchemy.com' }),
  'sonic-mainnet': defineEvmChain({ id: 'sonic-mainnet', chainId: 146, name: 'Sonic', testnet: false, rpcUrl: 'https://rpc.soniclabs.com', explorer: 'https://sonicscan.org', nativeCurrency: { symbol: 'S', decimals: 18 } }),
  'boba-mainnet': defineEvmChain({ id: 'boba-mainnet', chainId: 288, name: 'Boba Network', testnet: false, rpcUrl: 'https://mainnet.boba.network', explorer: 'https://bobascan.com' }),
  'zora-mainnet': defineEvmChain({ id: 'zora-mainnet', chainId: 7777777, name: 'Zora', testnet: false, rpcUrl: 'https://rpc.zora.energy', explorer: 'https://explorer.zora.energy' }),
  'manta-pacific-mainnet': defineEvmChain({ id: 'manta-pacific-mainnet', chainId: 169, name: 'Manta Pacific', testnet: false, rpcUrl: 'https://pacific-rpc.manta.network/http', explorer: 'https://pacific-explorer.manta.network' }),
  'taiko-mainnet': defineEvmChain({ id: 'taiko-mainnet', chainId: 167000, name: 'Taiko Alethia', testnet: false, rpcUrl: 'https://rpc.mainnet.taiko.xyz', explorer: 'https://taikoscan.io' }),
  'berachain-mainnet': defineEvmChain({ id: 'berachain-mainnet', chainId: 80094, name: 'Berachain', testnet: false, rpcUrl: 'https://rpc.berachain.com', explorer: 'https://berascan.com', nativeCurrency: { symbol: 'BERA', decimals: 18 } }),
  'abstract-mainnet': defineEvmChain({ id: 'abstract-mainnet', chainId: 2741, name: 'Abstract', testnet: false, rpcUrl: 'https://api.mainnet.abs.xyz', explorer: 'https://abscan.org' }),
  'ink-mainnet': defineEvmChain({ id: 'ink-mainnet', chainId: 57073, name: 'Ink', testnet: false, rpcUrl: 'https://rpc-gel.inkonchain.com', explorer: 'https://explorer.inkonchain.com' }),
  'unichain-mainnet': defineEvmChain({ id: 'unichain-mainnet', chainId: 130, name: 'Unichain', testnet: false, rpcUrl: 'https://mainnet.unichain.org', explorer: 'https://uniscan.xyz' }),
  'soneium-mainnet': defineEvmChain({ id: 'soneium-mainnet', chainId: 1868, name: 'Soneium', testnet: false, rpcUrl: 'https://rpc.soneium.org', explorer: 'https://soneium.blockscout.com' }),
  'holesky-testnet': defineEvmChain({ id: 'holesky-testnet', chainId: 17000, name: 'Ethereum Holesky', testnet: true, rpcUrl: 'https://ethereum-holesky-rpc.publicnode.com', explorer: 'https://holesky.etherscan.io' }),
  'hoodi-testnet': defineEvmChain({ id: 'hoodi-testnet', chainId: 560048, name: 'Ethereum Hoodi', testnet: true, rpcUrl: 'https://rpc.hoodi.ethpandaops.io', explorer: 'https://hoodi.etherscan.io' }),
  'optimism-sepolia-testnet': defineEvmChain({ id: 'optimism-sepolia-testnet', chainId: 11155420, name: 'Optimism Sepolia', testnet: true, rpcUrl: 'https://sepolia.optimism.io', explorer: 'https://sepolia-optimism.etherscan.io' }),
  'base-sepolia-testnet': defineEvmChain({ id: 'base-sepolia-testnet', chainId: 84532, name: 'Base Sepolia', testnet: true, rpcUrl: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' }),
  'arbitrum-sepolia-testnet': defineEvmChain({ id: 'arbitrum-sepolia-testnet', chainId: 421614, name: 'Arbitrum Sepolia', testnet: true, rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc', explorer: 'https://sepolia.arbiscan.io' }),
  'polygon-amoy-testnet': defineEvmChain({ id: 'polygon-amoy-testnet', chainId: 80002, name: 'Polygon Amoy', testnet: true, rpcUrl: 'https://rpc-amoy.polygon.technology', explorer: 'https://amoy.polygonscan.com', nativeCurrency: { symbol: 'MATIC', decimals: 18 } }),
  'avalanche-fuji-testnet': defineEvmChain({ id: 'avalanche-fuji-testnet', chainId: 43113, name: 'Avalanche Fuji', testnet: true, rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc', explorer: 'https://testnet.snowtrace.io', nativeCurrency: { symbol: 'AVAX', decimals: 18 } }),
  'bsc-testnet': defineEvmChain({ id: 'bsc-testnet', chainId: 97, name: 'BNB Smart Chain Testnet', testnet: true, rpcUrl: 'https://bsc-testnet-rpc.publicnode.com', explorer: 'https://testnet.bscscan.com', nativeCurrency: { symbol: 'BNB', decimals: 18 } }),
  'linea-sepolia-testnet': defineEvmChain({ id: 'linea-sepolia-testnet', chainId: 59141, name: 'Linea Sepolia', testnet: true, rpcUrl: 'https://rpc.sepolia.linea.build', explorer: 'https://sepolia.lineascan.build' }),
  'scroll-sepolia-testnet': defineEvmChain({ id: 'scroll-sepolia-testnet', chainId: 534351, name: 'Scroll Sepolia', testnet: true, rpcUrl: 'https://sepolia-rpc.scroll.io', explorer: 'https://sepolia.scrollscan.com' }),
  'zksync-sepolia-testnet': defineEvmChain({ id: 'zksync-sepolia-testnet', chainId: 300, name: 'zkSync Era Sepolia', testnet: true, rpcUrl: 'https://sepolia.era.zksync.dev', explorer: 'https://sepolia.explorer.zksync.io' }),
  'mantle-sepolia-testnet': defineEvmChain({ id: 'mantle-sepolia-testnet', chainId: 5003, name: 'Mantle Sepolia', testnet: true, rpcUrl: 'https://rpc.sepolia.mantle.xyz', explorer: 'https://explorer.sepolia.mantle.xyz', nativeCurrency: { symbol: 'MNT', decimals: 18 } }),
  'blast-sepolia-testnet': defineEvmChain({ id: 'blast-sepolia-testnet', chainId: 168587773, name: 'Blast Sepolia', testnet: true, rpcUrl: 'https://sepolia.blast.io', explorer: 'https://testnet.blastscan.io' }),
  'moonbase-alpha-testnet': defineEvmChain({ id: 'moonbase-alpha-testnet', chainId: 1287, name: 'Moonbase Alpha', testnet: true, rpcUrl: 'https://rpc.api.moonbase.moonbeam.network', explorer: 'https://moonbase.moonscan.io', nativeCurrency: { symbol: 'DEV', decimals: 18 } }),
};