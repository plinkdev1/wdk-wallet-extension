import { describe, it, expect } from 'vitest';
import { CHAIN_LOADERS, isSupportedChainId } from './index.js';

describe('chains/index', () => {
  it('B1-2: registers 50+ chain loaders (count + presence checks)', () => {
    const keys = Object.keys(CHAIN_LOADERS);
    // B1-2 ships 51 chains total (49 EVM + 3 Solana incl mainnet/devnet/testnet).
    // Exact list would be brittle - just sanity-check the count and key entries.
    expect(keys.length).toBeGreaterThanOrEqual(50);
    // Spot-check that existing entries are still there
    expect(keys).toContain('ethereum');
    expect(keys).toContain('sepolia-testnet');
    expect(keys).toContain('plasma-mainnet');
    expect(keys).toContain('arbitrum-mainnet');
    expect(keys).toContain('polygon-mainnet');
    expect(keys).toContain('solana-mainnet');
    // Spot-check B1-2 additions
    expect(keys).toContain('optimism-mainnet');
    expect(keys).toContain('base-mainnet');
    expect(keys).toContain('avalanche-mainnet');
    expect(keys).toContain('solana-devnet');
    expect(keys).toContain('solana-testnet');
    // Bitcoin (BIP-84 native segwit via @tetherto/wdk-wallet-btc)
    expect(keys).toContain('bitcoin-mainnet');
    expect(keys).toContain('bitcoin-testnet');
    // TON (v5r1 via @tetherto/wdk-wallet-ton)
    expect(keys).toContain('ton-mainnet');
    // Tron (via @tetherto/wdk-wallet-tron)
    expect(keys).toContain('tron-mainnet');
  });

  it('B1-2: all loaders resolve to chain modules with the right id meta', async () => {
    const entries = Object.entries(CHAIN_LOADERS) as Array<[keyof typeof CHAIN_LOADERS, () => Promise<unknown>]>;
    for (const [chainId, loader] of entries) {
      const mod = (await loader()) as { default: unknown; config: Record<string, unknown>; meta: { id: string } };
      expect(mod.meta.id, chainId + ' meta.id mismatch').toBe(chainId);
    }
  });

  it('each loader resolves to a module with default + config + meta', async () => {
    const entries = Object.entries(CHAIN_LOADERS) as Array<[keyof typeof CHAIN_LOADERS, () => Promise<unknown>]>;
    for (const [chainId, loader] of entries) {
      const mod = (await loader()) as { default: unknown; config: Record<string, unknown>; meta: { id: string } };
      expect(mod, chainId + ' module').toHaveProperty('default');
      expect(mod, chainId + ' module').toHaveProperty('config');
      expect(mod, chainId + ' module').toHaveProperty('meta');
      expect(mod.meta.id, chainId + ' meta.id mismatch').toBe(chainId);
    }
  });

  it('isSupportedChainId classifies known and unknown chain ids correctly', () => {
    expect(isSupportedChainId('plasma-mainnet')).toBe(true);
    expect(isSupportedChainId('plasma-testnet')).toBe(true);
    expect(isSupportedChainId('ethereum')).toBe(true);
    expect(isSupportedChainId('polygon-mainnet')).toBe(true);
    expect(isSupportedChainId('arbitrum-mainnet')).toBe(true);
    expect(isSupportedChainId('solana-mainnet')).toBe(true);
    // B1-2: solana-devnet + solana-testnet now have loaders
    expect(isSupportedChainId('solana-devnet')).toBe(true);
    expect(isSupportedChainId('solana-testnet')).toBe(true);
    expect(isSupportedChainId('optimism-mainnet')).toBe(true);
    expect(isSupportedChainId('base-mainnet')).toBe(true);
    expect(isSupportedChainId('not-a-chain')).toBe(false);
    expect(isSupportedChainId('')).toBe(false);
  });
});