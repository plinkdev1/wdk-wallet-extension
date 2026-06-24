/**
 * Unit tests for the Spark protocol helpers — the pure result-normalizers.
 * The networked manager/account path (createSparkManager → getAccount) is a
 * browser/Web-Worker integration concern (validated in spark-browser-validation)
 * and deliberately not imported here, so this spec never pulls the ~6.4 MB SDK.
 */
import { describe, it, expect } from 'vitest';
import {
  extractBolt11,
  normalizeSparkTxHash,
  normalizeLightningSendId,
  normalizeWithdrawQuote,
  normalizeWithdrawResult,
} from './spark.js';

describe('extractBolt11', () => {
  it('reads the encodedInvoice from a nested LightningReceiveRequest', () => {
    expect(extractBolt11({ invoice: { encodedInvoice: 'lnbc1xyz' } })).toBe('lnbc1xyz');
  });
  it('reads a flat encodedInvoice', () => {
    expect(extractBolt11({ encodedInvoice: 'lnbc1abc' })).toBe('lnbc1abc');
  });
  it('throws when no invoice string is present', () => {
    expect(() => extractBolt11({})).toThrow(/encodedInvoice/);
    expect(() => extractBolt11({ invoice: {} })).toThrow(/encodedInvoice/);
  });
});

describe('normalizeSparkTxHash', () => {
  it('accepts a bare string or a { hash } object', () => {
    expect(normalizeSparkTxHash('deadbeef')).toBe('deadbeef');
    expect(normalizeSparkTxHash({ hash: 'cafe' })).toBe('cafe');
  });
  it('throws on an unexpected shape', () => {
    expect(() => normalizeSparkTxHash({})).toThrow(/no hash/);
    expect(() => normalizeSparkTxHash(null)).toThrow(/no hash/);
  });
});

describe('normalizeLightningSendId', () => {
  it('reads the request id', () => {
    expect(normalizeLightningSendId({ id: 'req_123', status: 'PENDING' })).toBe('req_123');
  });
  it('throws when no id is present', () => {
    expect(() => normalizeLightningSendId({})).toThrow(/request id/);
  });
});

describe('normalizeWithdrawQuote', () => {
  // A CoopExitFeeQuote carries per-speed user + L1-broadcast fees as CurrencyAmounts.
  const quote = {
    id: 'quote_abc',
    userFeeFast: { originalValue: 120, originalUnit: 'SATOSHI' },
    l1BroadcastFeeFast: { originalValue: 800, originalUnit: 'SATOSHI' },
    userFeeMedium: { originalValue: 90, originalUnit: 'SATOSHI' },
    l1BroadcastFeeMedium: { originalValue: 400, originalUnit: 'SATOSHI' },
    userFeeSlow: { originalValue: 60, originalUnit: 'SATOSHI' },
    l1BroadcastFeeSlow: { originalValue: 150, originalUnit: 'SATOSHI' },
  };

  it('selects the per-speed fee and sums user + L1 broadcast (matching the SDK math)', () => {
    expect(normalizeWithdrawQuote(quote, 'FAST')).toEqual({
      quoteId: 'quote_abc',
      exitSpeed: 'FAST',
      userFeeSats: 120,
      l1BroadcastFeeSats: 800,
      totalFeeSats: 920,
    });
    expect(normalizeWithdrawQuote(quote, 'MEDIUM').totalFeeSats).toBe(490);
    expect(normalizeWithdrawQuote(quote, 'SLOW').totalFeeSats).toBe(210);
  });

  it('tolerates a missing/empty quote (zeroed fees, null id)', () => {
    expect(normalizeWithdrawQuote(null, 'MEDIUM')).toEqual({
      quoteId: null,
      exitSpeed: 'MEDIUM',
      userFeeSats: 0,
      l1BroadcastFeeSats: 0,
      totalFeeSats: 0,
    });
  });
});

describe('normalizeWithdrawResult', () => {
  it('reads the coop-exit id, status, and fee', () => {
    expect(
      normalizeWithdrawResult({ id: 'exit_1', status: 'PENDING', fee: { originalValue: 500 } }),
    ).toEqual({ id: 'exit_1', status: 'PENDING', feeSats: 500 });
  });
  it('treats null/undefined (request could not be completed) as an error', () => {
    expect(() => normalizeWithdrawResult(null)).toThrow(/could not be completed/);
    expect(() => normalizeWithdrawResult(undefined)).toThrow(/could not be completed/);
  });
  it('throws when no id is present', () => {
    expect(() => normalizeWithdrawResult({ status: 'PENDING' })).toThrow(/request id/);
  });
});
