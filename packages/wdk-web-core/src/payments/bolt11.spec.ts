/**
 * BOLT11 decoder tests, using the canonical invoices from the BOLT #11 spec
 * (timestamp 1496314658). Amount/network/validity are asserted; the deeper
 * tagged fields are a documented later extension.
 */
import { describe, it, expect } from 'vitest';
import { decodeBolt11 } from './bolt11.js';

// "Any amount" invoice (no amount in the HRP).
const NO_AMOUNT =
  'lnbc1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w';

// 2500 µBTC invoice → 250,000,000 msat.
const WITH_AMOUNT =
  'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';

describe('decodeBolt11', () => {
  it('decodes an "any amount" mainnet invoice', () => {
    const result = decodeBolt11(NO_AMOUNT);
    expect(result).not.toBeNull();
    expect(result?.network).toBe('mainnet');
    expect(result?.millisatoshis).toBeUndefined();
    expect(result?.timestamp).toBe(1496314658);
  });

  it('decodes the amount (2500u → 250,000,000 msat)', () => {
    const result = decodeBolt11(WITH_AMOUNT);
    expect(result?.network).toBe('mainnet');
    expect(result?.millisatoshis).toBe(250_000_000n);
  });

  it('tolerates the lightning: scheme prefix and an all-uppercase QR form', () => {
    expect(decodeBolt11(`lightning:${WITH_AMOUNT}`)?.millisatoshis).toBe(250_000_000n);
    expect(decodeBolt11(NO_AMOUNT.toUpperCase())?.network).toBe('mainnet');
  });

  it('rejects non-invoices, tampered checksums, and mixed case', () => {
    expect(decodeBolt11('not an invoice')).toBeNull();
    expect(decodeBolt11(`${NO_AMOUNT.slice(0, -1)}x`)).toBeNull();
    expect(decodeBolt11(`LNBC1${NO_AMOUNT.slice(5)}`)).toBeNull(); // mixed case
  });
});
