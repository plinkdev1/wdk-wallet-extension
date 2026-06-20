import { describe, it, expect, vi } from 'vitest';
import { createDispatcher, type HandlerRegistry } from './dispatch.js';

/**
 * F-SEC-01 regression suite for the MV3 SW message dispatcher.
 * Clones packages/wdk-web-core/src/worker/mv3-handler.spec.ts pattern.
 */
describe('SW message dispatcher (F-SEC-01 — Object.hasOwn whitelisting)', () => {
  function makeMinimalHandlers(): HandlerRegistry {
    return {
      PING: vi.fn(async () => 'pong' as const),
      GET_LOCK_STATE: vi.fn(async () => 'locked' as const),
      LOCK: vi.fn(async () => ({ ok: true as const })),
      VAULT_HAS_STORED: vi.fn(async () => true),
      VAULT_STORE: vi.fn(async () => ({ ok: true as const })),
      VAULT_LOAD: vi.fn(async () => ({ ok: true as const })),
      VAULT_CLEAR: vi.fn(async () => ({ ok: true as const })),
      ACCOUNT_GET_EVM_ADDRESS: vi.fn(async () => '0xabcd' as `0x${string}`),
      ACCOUNT_GET_SOLANA_ADDRESS: vi.fn(async () => 'somebase58'),
      ACCOUNT_SIGN_MESSAGE: vi.fn(async () => '0xdeadbeef' as `0x${string}`),
      ACCOUNT_SIGN_TYPED_DATA: vi.fn(async () => '0xdead' as `0x${string}`),
      ACCOUNT_SIGN_SOLANA_MESSAGE: vi.fn(async () => 'sigsig'),
      ACCOUNT_SEND_TRANSACTION: vi.fn(async () => '0xtxhash' as `0x${string}`),
      ACCOUNT_SEND_SOLANA_TRANSACTION: vi.fn(async () => 'soL1gnatureBase58'),
      ACCOUNT_GET_BTC_ADDRESS: vi.fn(async () => 'bc1qexampleaddr'),
      ACCOUNT_GET_BTC_BALANCE: vi.fn(async () => '0'),
      ACCOUNT_SEND_BTC_TRANSACTION: vi.fn(async () => 'btctxid'),
      ACCOUNT_GET_TON_ADDRESS: vi.fn(async () => 'EQexampleTonAddr'),
      ACCOUNT_GET_TON_BALANCE: vi.fn(async () => '0'),
      ACCOUNT_SEND_TON_TRANSACTION: vi.fn(async () => 'tontxhash'),
      ACCOUNT_GET_TRON_ADDRESS: vi.fn(async () => 'TexampleTronAddr'),
      ACCOUNT_GET_TRON_BALANCE: vi.fn(async () => '0'),
      ACCOUNT_SEND_TRON_TRANSACTION: vi.fn(async () => 'trontxhash'),
      RPC_GET_BALANCE: vi.fn(async () => '0'),
      RPC_GET_TOKEN_BALANCE: vi.fn(async () => '0'),
      RPC_GET_TRANSACTION_STATUS: vi.fn(async () => 'pending' as const),
      PRICING_GET_USD_PRICE: vi.fn(async () => null),
      AAVE_GET_ACCOUNT_DATA: vi.fn(async () => ({ totalCollateralBase: '0', totalDebtBase: '0', availableBorrowsBase: '0', currentLiquidationThreshold: '0', ltv: '0', healthFactor: '0' })) as any,
      AAVE_QUOTE: vi.fn(async () => '0') as any,
      AAVE_SUPPLY: vi.fn(async () => ({ hash: '0x', fee: '0' })) as any,
      AAVE_WITHDRAW: vi.fn(async () => ({ hash: '0x', fee: '0' })) as any,
      AAVE_BORROW: vi.fn(async () => ({ hash: '0x', fee: '0' })) as any,
      AAVE_REPAY: vi.fn(async () => ({ hash: '0x', fee: '0' })) as any,
      VELORA_QUOTE_SWAP: vi.fn(async () => ({ fee: '0', tokenInAmount: '0', tokenOutAmount: '0' })) as any,
      VELORA_SWAP: vi.fn(async () => ({ hash: '0x', fee: '0', tokenInAmount: '0', tokenOutAmount: '0' })) as any,
      DAPP_REQUEST: vi.fn(async () => ({ result: 'ok' })) as any,
      BIP39_GENERATE_MNEMONIC: vi.fn(async () => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about') as any,
      BIP39_VALIDATE_MNEMONIC: vi.fn(async () => true) as any,
      APPROVAL_GET_PENDING: vi.fn(async () => null) as any,
      APPROVAL_RESPOND: vi.fn(async () => ({ ok: true })) as any,
      APPROVAL_LIST_PENDING: vi.fn(async () => []) as any,
    };
  }

  it('routes a known message type to the correct handler', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    const result = await dispatch({ type: 'PING' });
    expect(result).toBe('pong');
    expect(handlers.PING).toHaveBeenCalledTimes(1);
    expect(handlers.GET_LOCK_STATE).not.toHaveBeenCalled();
  });

  it('routes a parameterized message with its full payload', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    const msg = { type: 'VAULT_LOAD' as const, password: 'hunter2' };
    await dispatch(msg);
    expect(handlers.VAULT_LOAD).toHaveBeenCalledWith(msg);
  });

  it('throws on unknown message type', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    await expect(dispatch({ type: 'NOT_A_REAL_TYPE' })).rejects.toThrow(/Unknown message type/);
  });

  it('throws on non-object input', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    await expect(dispatch(null)).rejects.toThrow(/Invalid message/);
    await expect(dispatch('PING')).rejects.toThrow(/Invalid message/);
    await expect(dispatch(42)).rejects.toThrow(/Invalid message/);
    await expect(dispatch(undefined)).rejects.toThrow(/Invalid message/);
  });

  it('throws on object without a string `type` field', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    await expect(dispatch({})).rejects.toThrow(/Invalid message/);
    await expect(dispatch({ type: 42 })).rejects.toThrow(/Invalid message/);
    await expect(dispatch({ type: null })).rejects.toThrow(/Invalid message/);
  });

  it('F-SEC-01: rejects prototype-chain method names as message types', async () => {
    const handlers = makeMinimalHandlers();
    const dispatch = createDispatcher(handlers);
    const prototypeMethodNames = [
      'toString', 'constructor', 'hasOwnProperty', 'isPrototypeOf',
      'valueOf', '__proto__', 'toLocaleString', 'propertyIsEnumerable',
    ];
    for (const name of prototypeMethodNames) {
      await expect(dispatch({ type: name })).rejects.toThrow(/Unknown message type/);
    }
  });

  it('F-SEC-01: rejects polluted type even when Object.prototype is poisoned', async () => {
    const POISONED_KEY = 'PROTOTYPE_POLLUTED_TYPE';
    (Object.prototype as Record<string, unknown>)[POISONED_KEY] = async () => 'pwned';
    try {
      const handlers = makeMinimalHandlers();
      const dispatch = createDispatcher(handlers);
      await expect(dispatch({ type: POISONED_KEY })).rejects.toThrow(/Unknown message type/);
      // Sanity: the polluted key IS visible via `in` (confirms pollution worked)
      expect(POISONED_KEY in handlers).toBe(true);
      expect(Object.hasOwn(handlers, POISONED_KEY)).toBe(false);
    } finally {
      delete (Object.prototype as Record<string, unknown>)[POISONED_KEY];
    }
  });
});