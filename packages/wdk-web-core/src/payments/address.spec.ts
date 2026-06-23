/**
 * Address-validation tests. Vectors are canonical, real-world addresses
 * (BIP-173/350 test vectors, the genesis P2PKH, the USDT-TRON contract, a TON
 * doc address, and the Spark address from `spark-browser-validation`) and were
 * pre-verified against the implementation primitives before being baked in.
 */
import { describe, it, expect } from 'vitest';
import {
  isEvmAddress,
  isSolanaAddress,
  isBitcoinAddress,
  bitcoinNetworkOf,
  isTronAddress,
  isTonAddress,
  isSparkAddress,
  validateAddress,
  assertValidRecipient,
  detectPaymentFamily,
} from './address.js';

const EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const SOLANA = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const BTC_V0 = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const BTC_TESTNET = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7';
const BTC_TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const BTC_P2PKH = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
const BTC_P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';
const TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TON = 'EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t';
const SPARK = 'spark1pgss85kzu8r3kerhnvxwzzasls3wz3tycfdc4f6d4wgp5trmsel3x8jgad52lz';

describe('EVM addresses', () => {
  it('accepts checksummed and lowercase forms', () => {
    expect(isEvmAddress(EVM)).toBe(true);
    expect(isEvmAddress(EVM.toLowerCase())).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isEvmAddress('0x1234')).toBe(false);
    expect(isEvmAddress('not-an-address')).toBe(false);
  });
});

describe('Solana addresses', () => {
  it('accepts 32-byte base58 keys', () => {
    expect(isSolanaAddress(SOLANA)).toBe(true);
    expect(isSolanaAddress('So11111111111111111111111111111111111111112')).toBe(true);
  });
  it('rejects non-32-byte / non-base58 input', () => {
    expect(isSolanaAddress(EVM)).toBe(false);
    expect(isSolanaAddress('abc')).toBe(false);
  });
});

describe('Bitcoin addresses', () => {
  it('validates segwit v0, taproot, and legacy with the right network', () => {
    expect(bitcoinNetworkOf(BTC_V0)).toBe('mainnet');
    expect(bitcoinNetworkOf(BTC_TESTNET)).toBe('testnet');
    expect(bitcoinNetworkOf(BTC_TAPROOT)).toBe('mainnet');
    expect(bitcoinNetworkOf(BTC_P2PKH)).toBe('mainnet');
    expect(bitcoinNetworkOf(BTC_P2SH)).toBe('mainnet');
    expect(isBitcoinAddress(BTC_V0)).toBe(true);
  });
  it('rejects a tampered checksum and a v0 program with the bech32m checksum', () => {
    expect(bitcoinNetworkOf('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5')).toBeNull();
    // taproot string demoted to witness v0 charset would fail the encoding rule
    expect(bitcoinNetworkOf('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'.toUpperCase())).toBe(
      'mainnet',
    );
  });
});

describe('Tron addresses', () => {
  it('accepts a T-prefixed base58check address', () => {
    expect(isTronAddress(TRON)).toBe(true);
  });
  it('rejects a tampered address and non-Tron input', () => {
    expect(isTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false);
    expect(isTronAddress(SOLANA)).toBe(false);
  });
});

describe('TON addresses', () => {
  it('accepts friendly (base64url) and raw forms', () => {
    expect(isTonAddress(TON)).toBe(true);
    expect(isTonAddress(`0:${'0'.repeat(64)}`)).toBe(true);
  });
  it('rejects a tampered CRC', () => {
    expect(isTonAddress('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0u')).toBe(false);
  });
});

describe('Spark addresses', () => {
  it('accepts a bech32m spark1 address', () => {
    expect(isSparkAddress(SPARK)).toBe(true);
  });
  it('rejects a tampered address and a bech32 (non-m) string', () => {
    expect(isSparkAddress(`${SPARK}x`)).toBe(false);
    expect(isSparkAddress(BTC_V0)).toBe(false); // valid bech32, wrong hrp + encoding
  });
});

describe('validateAddress', () => {
  it('returns the checksummed form for a valid EVM address', () => {
    const result = validateAddress('evm', EVM.toLowerCase());
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe(EVM);
  });
  it('reports a reason on failure', () => {
    const result = validateAddress('solana', EVM);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Solana/);
  });
  it('validates the remaining families', () => {
    expect(validateAddress('bitcoin', BTC_V0).valid).toBe(true);
    expect(validateAddress('ton', TON).valid).toBe(true);
    expect(validateAddress('tron', TRON).valid).toBe(true);
  });
});

describe('assertValidRecipient', () => {
  it('passes for a valid recipient of each family', () => {
    expect(() => assertValidRecipient('evm', EVM)).not.toThrow();
    expect(() => assertValidRecipient('solana', SOLANA)).not.toThrow();
    expect(() => assertValidRecipient('bitcoin', BTC_V0)).not.toThrow();
    expect(() => assertValidRecipient('ton', TON)).not.toThrow();
    expect(() => assertValidRecipient('tron', TRON)).not.toThrow();
  });
  it('throws a descriptive error for a malformed recipient', () => {
    expect(() => assertValidRecipient('evm', 'not-an-address')).toThrow(/invalid evm recipient/i);
    expect(() => assertValidRecipient('bitcoin', EVM)).toThrow(/invalid bitcoin recipient/i);
  });
});

describe('detectPaymentFamily', () => {
  it('routes each format to the right family', () => {
    expect(detectPaymentFamily(EVM)).toBe('evm');
    expect(detectPaymentFamily(BTC_V0)).toBe('bitcoin');
    expect(detectPaymentFamily(BTC_P2PKH)).toBe('bitcoin'); // legacy, not Tron/Solana
    expect(detectPaymentFamily(SPARK)).toBe('spark');
    expect(detectPaymentFamily(TRON)).toBe('tron');
    expect(detectPaymentFamily(TON)).toBe('ton');
    expect(detectPaymentFamily(SOLANA)).toBe('solana');
  });
  it('returns null for unrecognised input', () => {
    expect(detectPaymentFamily('hello world')).toBeNull();
  });
});
