/**
 * Unit tests for the DeFi/on-ramp protocol wrappers' pure surface:
 * the Comlink-cloneable normalizers and the MoonPay config gating on the
 * WalletWorker. Network calls and on-chain execution are out of scope here
 * (covered by integration/testnet runs); these lock the data-shape contracts
 * that the background handlers and popup views depend on.
 */
import { describe, it, expect } from 'vitest';
import { normalizeActionResult, normalizeAccountData } from './aave.js';
import { normalizeQuote, normalizeSwapResult } from './velora.js';
import { normalizeUsdt0Quote, normalizeUsdt0Result } from './usdt0.js';
import { normalizeBuyQuote } from './moonpay.js';
import { WalletWorker } from '../worker/wallet-worker.js';

describe('aave normalizers', () => {
  it('coerces account data fields to bigint', () => {
    const d = normalizeAccountData({ totalCollateralBase: '100', totalDebtBase: 5n, healthFactor: '2000000000000000000' });
    expect(d.totalCollateralBase).toBe(100n);
    expect(d.totalDebtBase).toBe(5n);
    expect(d.healthFactor).toBe(2000000000000000000n);
    expect(d.ltv).toBe(0n); // missing -> 0
  });

  it('normalizes an action result and keeps optional approveHash only when present', () => {
    expect(normalizeActionResult({ hash: '0xabc', fee: 21000n })).toEqual({ hash: '0xabc', fee: 21000n });
    const withApprove = normalizeActionResult({ hash: '0xabc', fee: '1', approveHash: '0xdef' });
    expect(withApprove.approveHash).toBe('0xdef');
  });
});

describe('velora normalizers', () => {
  it('normalizes a quote to bigints', () => {
    expect(normalizeQuote({ fee: '10', tokenInAmount: 1000000n, tokenOutAmount: '999' })).toEqual({
      fee: 10n, tokenInAmount: 1000000n, tokenOutAmount: 999n,
    });
  });

  it('normalizes a swap result', () => {
    const r = normalizeSwapResult({ hash: '0x1', fee: 7n, tokenInAmount: 100n, tokenOutAmount: 95n });
    expect(r).toEqual({ hash: '0x1', fee: 7n, tokenInAmount: 100n, tokenOutAmount: 95n });
  });
});

describe('usdt0 normalizers', () => {
  it('reads fee from fee or nativeFee', () => {
    expect(normalizeUsdt0Quote({ nativeFee: '500' }).fee).toBe(500n);
    expect(normalizeUsdt0Quote({ fee: 7n }).fee).toBe(7n);
  });

  it('threads approveHash through the result', () => {
    expect(normalizeUsdt0Result({ hash: '0x9', fee: 1n }, '0xapprove')).toEqual({ hash: '0x9', fee: 1n, approveHash: '0xapprove' });
  });
});

describe('moonpay normalizers', () => {
  it('maps MoonPay quote fields to fiat/crypto numbers', () => {
    expect(normalizeBuyQuote({ baseCurrencyAmount: 100, quoteCurrencyAmount: 0.03, feeAmount: 4.99, totalAmount: 104.99 })).toEqual({
      fiatAmount: 100, cryptoAmount: 0.03, feeAmount: 4.99, totalAmount: 104.99,
    });
  });
});

describe('MoonPay config gating on WalletWorker', () => {
  it('reports not-configured and returns null quote when no key is supplied', async () => {
    const w = new WalletWorker({});
    expect(await w.moonpay_isConfigured()).toBe(false);
    expect(await w.moonpay_quoteBuy('usd', 'eth', 100)).toBeNull();
    await expect(w.moonpay_buy('usd', 'eth', 100, '0xabc')).rejects.toThrow(/not configured/i);
  });

  it('reports configured when an app key is supplied', async () => {
    const w = new WalletWorker({ moonpayConfig: { apiKey: 'pk_test_example' } });
    expect(await w.moonpay_isConfigured()).toBe(true);
  });
});
