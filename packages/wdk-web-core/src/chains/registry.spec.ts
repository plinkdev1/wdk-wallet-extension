import { describe, it, expect, vi } from 'vitest';
import { createChainRegistry, type ChainModule } from './registry.js';

/** A fake chain module — only the runtime shape the registry touches matters. */
function fakeModule(id: string): ChainModule {
  return {
    default: class FakeWalletManager {},
    config: { rpcUrl: 'https://rpc.example/' + id, chainId: 1 },
    meta: {
      id: id as never,
      family: 'evm',
      name: id,
      nativeCurrency: { symbol: 'ETH', decimals: 18 },
      testnet: false,
      bip44CoinType: 60,
    },
  };
}

type WdkArg = Parameters<ReturnType<typeof createChainRegistry>['ensureChainRegistered']>[0];

describe('chains/registry — createChainRegistry (B-12)', () => {
  it('builds CHAIN_LOADERS containing exactly the provided chains (slim path)', () => {
    const reg = createChainRegistry({
      ethereum: fakeModule('ethereum'),
      'plasma-mainnet': fakeModule('plasma-mainnet'),
    });
    expect(Object.keys(reg.CHAIN_LOADERS).sort()).toEqual(['ethereum', 'plasma-mainnet']);
  });

  it('loaders resolve to the passed module', async () => {
    const eth = fakeModule('ethereum');
    const reg = createChainRegistry({ ethereum: eth });
    expect(await reg.CHAIN_LOADERS.ethereum()).toBe(eth);
  });

  it('isSupportedChainId is true only for registered chains, and is prototype-safe (F-SEC-01)', () => {
    const reg = createChainRegistry({ ethereum: fakeModule('ethereum') });
    expect(reg.isSupportedChainId('ethereum')).toBe(true);
    expect(reg.isSupportedChainId('solana-mainnet')).toBe(false);
    // Object.prototype members must NEVER be mistaken for a registered chain.
    expect(reg.isSupportedChainId('toString')).toBe(false);
    expect(reg.isSupportedChainId('constructor')).toBe(false);
    expect(reg.isSupportedChainId('hasOwnProperty')).toBe(false);
  });

  it('ensureChainRegistered registers via wdk.registerWallet with default + config, exactly once', async () => {
    const eth = fakeModule('ethereum');
    const reg = createChainRegistry({ ethereum: eth });
    const registerWallet = vi.fn();
    const wdk = { registerWallet } as unknown as WdkArg;

    await reg.ensureChainRegistered(wdk, 'ethereum');
    await reg.ensureChainRegistered(wdk, 'ethereum'); // idempotent — no second registration

    expect(registerWallet).toHaveBeenCalledTimes(1);
    expect(registerWallet).toHaveBeenCalledWith('ethereum', eth.default, eth.config);
  });

  it('tracks registrations per wdk instance (each WDK registers independently)', async () => {
    const reg = createChainRegistry({ ethereum: fakeModule('ethereum') });
    const a = { registerWallet: vi.fn() };
    const b = { registerWallet: vi.fn() };
    await reg.ensureChainRegistered(a as unknown as WdkArg, 'ethereum');
    await reg.ensureChainRegistered(b as unknown as WdkArg, 'ethereum');
    expect(a.registerWallet).toHaveBeenCalledTimes(1);
    expect(b.registerWallet).toHaveBeenCalledTimes(1);
  });
});
