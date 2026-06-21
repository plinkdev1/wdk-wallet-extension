/**
 * Unit tests for the x402 client wire format (network mapping, nonce, and the
 * base64 X-PAYMENT header round-trip). The end-to-end signing path
 * (x402_createPayment) is exercised against a loaded account in integration runs.
 */
import { describe, it, expect } from 'vitest';
import { networkToChainId, generateX402Nonce, buildExactPayment, encodePaymentHeader, decodePaymentHeader } from './x402.js';

describe('x402 wire format', () => {
  it('maps networks to chain ids', () => {
    expect(networkToChainId('base')).toBe(8453);
    expect(networkToChainId('ethereum')).toBe(1);
    expect(networkToChainId(137)).toBe(137);
    expect(() => networkToChainId('nope')).toThrow(/Unknown x402 network/);
  });

  it('generates unique 32-byte hex nonces', () => {
    const n = generateX402Nonce();
    expect(n).toMatch(/^0x[0-9a-f]{64}$/);
    expect(generateX402Nonce()).not.toBe(n);
  });

  it('round-trips the X-PAYMENT header', () => {
    const authorization = { from: '0xabc', to: '0xdef', value: '10000', validAfter: '0', validBefore: '9999999999', nonce: '0x' + '11'.repeat(32) };
    const payment = buildExactPayment('base', '0xsig', authorization);
    expect(payment).toMatchObject({ x402Version: 1, scheme: 'exact', network: 'base' });
    const header = encodePaymentHeader(payment);
    expect(typeof header).toBe('string');
    expect(decodePaymentHeader(header)).toEqual(payment);
    expect(() => decodePaymentHeader('')).toThrow(/Empty/);
    expect(() => decodePaymentHeader('!!notbase64')).toThrow(/Malformed/);
  });
});
