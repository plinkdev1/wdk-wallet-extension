/**
 * Payment-URI parsing tests: BIP-21, EIP-681 (native + ERC-20 transfer),
 * BOLT11 (scheme-prefixed and bare), and bare-address detection.
 */
import { describe, it, expect } from 'vitest';
import { parsePaymentUri } from './uri.js';

const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const BTC = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const SPARK = 'spark1pgss85kzu8r3kerhnvxwzzasls3wz3tycfdc4f6d4wgp5trmsel3x8jgad52lz';
const INVOICE =
  'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';

describe('BIP-21 (bitcoin:)', () => {
  it('parses address, amount (BTC→sat), and label', () => {
    const result = parsePaymentUri('bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.001&label=Donation');
    expect(result).toMatchObject({
      scheme: 'bip21',
      family: 'bitcoin',
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      network: 'mainnet',
      satoshis: 100_000n,
      label: 'Donation',
    });
  });
  it('parses a bare bitcoin: URI with no params', () => {
    const result = parsePaymentUri(`bitcoin:${BTC}`);
    expect(result?.scheme).toBe('bip21');
    expect((result as { satoshis?: bigint }).satoshis).toBeUndefined();
  });
  it('rejects an invalid embedded address', () => {
    expect(parsePaymentUri('bitcoin:not-an-address')).toBeNull();
  });
});

describe('EIP-681 (ethereum:)', () => {
  it('parses a native value transfer with chain id', () => {
    const result = parsePaymentUri(`ethereum:${EVM}@1?value=1000000000000000000`);
    expect(result).toMatchObject({
      scheme: 'eip681',
      family: 'evm',
      address: EVM,
      chainId: 1,
      wei: 1_000_000_000_000_000_000n,
    });
  });
  it('parses an ERC-20 transfer (token contract + recipient + amount)', () => {
    const result = parsePaymentUri(`ethereum:${USDC}/transfer?address=${EVM}&uint256=1000000`);
    expect(result).toMatchObject({
      scheme: 'eip681',
      address: USDC,
      functionName: 'transfer',
      recipient: EVM,
      tokenAmount: 1_000_000n,
    });
  });
});

describe('BOLT11 (lightning: / bare)', () => {
  it('parses a scheme-prefixed invoice and strips the prefix', () => {
    const result = parsePaymentUri(`lightning:${INVOICE}`);
    expect(result).toMatchObject({
      scheme: 'bolt11',
      family: 'lightning',
      network: 'mainnet',
      invoice: INVOICE,
      millisatoshis: 250_000_000n,
    });
  });
  it('parses a bare ln… invoice', () => {
    expect(parsePaymentUri(INVOICE)?.scheme).toBe('bolt11');
  });
});

describe('bare addresses', () => {
  it('detects family for bare addresses', () => {
    expect(parsePaymentUri(EVM)).toMatchObject({ scheme: 'address', family: 'evm', address: EVM });
    expect(parsePaymentUri(BTC)).toMatchObject({ scheme: 'address', family: 'bitcoin' });
    expect(parsePaymentUri(SPARK)).toMatchObject({ scheme: 'address', family: 'spark' });
  });
  it('returns null for empty or unrecognised input', () => {
    expect(parsePaymentUri('')).toBeNull();
    expect(parsePaymentUri('   ')).toBeNull();
    expect(parsePaymentUri('random text')).toBeNull();
  });
});
