/**
 * Unit tests for the Spark protocol helpers — the pure result-normalizers.
 * The networked manager/account path (createSparkManager → getAccount) is a
 * browser/Web-Worker integration concern (validated in spark-browser-validation)
 * and deliberately not imported here, so this spec never pulls the ~6.4 MB SDK.
 */
import { describe, it, expect } from 'vitest';
import { extractBolt11, normalizeSparkTxHash, normalizeLightningSendId } from './spark.js';

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
