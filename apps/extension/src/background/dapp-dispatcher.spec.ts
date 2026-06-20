import { describe, it, expect, vi } from 'vitest';
import {
  createDappDispatcher,
  type Eip1193HandlerRegistry,
  type Eip1193Handler,
} from './dapp-dispatcher.js';
import type { Eip1193Method } from '../types/dapp-messages.js';

/** Build a fully-typed Eip1193HandlerRegistry from a partial set, defaulting missing entries to a stub. */
function buildRegistry(partial: Partial<Eip1193HandlerRegistry> = {}): Eip1193HandlerRegistry {
  const stub: Eip1193Handler = async () => null;
  return {
    eth_chainId: partial.eth_chainId ?? (stub as Eip1193Handler),
    eth_accounts: partial.eth_accounts ?? (stub as Eip1193Handler),
    eth_requestAccounts: partial.eth_requestAccounts ?? (stub as Eip1193Handler),
    eth_sendTransaction: partial.eth_sendTransaction ?? (stub as Eip1193Handler),
    personal_sign: partial.personal_sign ?? (stub as Eip1193Handler),
    eth_signTypedData_v4: partial.eth_signTypedData_v4 ?? (stub as Eip1193Handler),
    wallet_switchEthereumChain: partial.wallet_switchEthereumChain ?? (stub as Eip1193Handler),
    wallet_addEthereumChain: partial.wallet_addEthereumChain ?? (stub as Eip1193Handler),
  };
}

describe('createDappDispatcher', () => {
  it('routes to the handler matching request.method', async () => {
    const chainIdHandler = vi.fn(async () => '0x1' as `0x${string}`);
    const accountsHandler = vi.fn(async () => ['0xabc'] as `0x${string}`[]);
    const dispatch = createDappDispatcher(buildRegistry({
      eth_chainId: chainIdHandler as Eip1193Handler,
      eth_accounts: accountsHandler as Eip1193Handler,
    }));

    const r1 = await dispatch({ method: 'eth_chainId' }, { origin: 'https://x.example' });
    expect(r1).toBe('0x1');
    expect(chainIdHandler).toHaveBeenCalledOnce();
    expect(accountsHandler).not.toHaveBeenCalled();

    const r2 = await dispatch({ method: 'eth_accounts' }, { origin: 'https://x.example' });
    expect(r2).toEqual(['0xabc']);
    expect(accountsHandler).toHaveBeenCalledOnce();
  });

  it('passes ctx (origin) to the handler unchanged', async () => {
    const handler = vi.fn(async () => null);
    const dispatch = createDappDispatcher(buildRegistry({
      personal_sign: handler as Eip1193Handler,
    }));

    await dispatch(
      { method: 'personal_sign', params: ['0xdead', '0xabc'] },
      { origin: 'https://uniswap.org' }
    );
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      { origin: 'https://uniswap.org' }
    );
  });

  it('passes the request through to the handler with params unchanged', async () => {
    const handler = vi.fn(async () => '0xdeadbeef' as `0x${string}`);
    const dispatch = createDappDispatcher(buildRegistry({
      eth_sendTransaction: handler as Eip1193Handler,
    }));

    const params = [{ from: '0x1', to: '0x2', value: '0x100' }];
    await dispatch({ method: 'eth_sendTransaction', params: params as any }, { origin: 'https://x' });
    expect(handler).toHaveBeenCalledWith(
      { method: 'eth_sendTransaction', params: params as any },
      expect.anything()
    );
  });

  it('throws EIP-1193 -32601 for unknown methods', async () => {
    const dispatch = createDappDispatcher(buildRegistry());
    await expect(
      dispatch({ method: 'eth_bogus' as any }, { origin: 'https://x' })
    ).rejects.toMatchObject({ code: -32601 });
    await expect(
      dispatch({ method: 'eth_bogus' as any }, { origin: 'https://x' })
    ).rejects.toMatchObject({ message: expect.stringContaining('eth_bogus') });
  });

  it('rejects Object.prototype method names with EIP-1193 -32601 (F-SEC-01 INNER TIER)', async () => {
    // Per S12.6.3 + S12.6.5: the inner dispatcher MUST use Object.hasOwn,
    // not `in`, to reject these. Without F-SEC-01, every one of these
    // would traverse Object.prototype and pass the whitelist check.
    const dispatch = createDappDispatcher(buildRegistry());
    for (const proto of ['toString', 'hasOwnProperty', '__proto__', 'constructor', 'valueOf', 'isPrototypeOf', 'propertyIsEnumerable']) {
      await expect(
        dispatch({ method: proto as any, params: [] }, { origin: 'https://evil.example' })
      ).rejects.toMatchObject({ code: -32601 });
    }
  });

  it('passes the handler raw result value through unchanged', async () => {
    const dispatch = createDappDispatcher(buildRegistry({
      wallet_switchEthereumChain: (async () => null) as Eip1193Handler,
    }));

    const r = await dispatch({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }, { origin: 'https://x' });
    expect(r).toBeNull();
  });

  it('propagates handler-thrown exceptions (does NOT swallow)', async () => {
    const dispatch = createDappDispatcher(buildRegistry({
      eth_chainId: (async () => { throw new Error('handler boom'); }) as Eip1193Handler,
    }));

    await expect(
      dispatch({ method: 'eth_chainId' }, { origin: 'https://x' })
    ).rejects.toThrow('handler boom');
  });
});