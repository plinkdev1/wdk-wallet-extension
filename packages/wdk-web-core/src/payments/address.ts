/**
 * Per-family address validation, built only on primitives already in the
 * engine's dependency tree (viem, bs58, bech32, the polyfilled Buffer) so it
 * adds no bundle weight and no new install surface.
 *
 * These are structural/checksum checks for UX and send-path safety — they
 * answer "is this a well-formed address for family X" — not on-chain existence.
 */

import { isAddress, getAddress, sha256 } from 'viem';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { bech32Decode, bech32WordsToBytes } from './bech32.js';
import type { ChainFamily } from '../types/chains.js';
import type { AddressValidation, BitcoinNetwork, PaymentFamily } from './types.js';

/** Double SHA-256, the checksum primitive for Base58Check (Bitcoin legacy, Tron). */
function sha256d(bytes: Uint8Array): Uint8Array {
  return sha256(sha256(bytes, 'bytes'), 'bytes');
}

/**
 * Decodes a Base58Check string and returns its payload (version byte + data),
 * or `null` if the string is not valid base58 or the 4-byte checksum fails.
 */
function base58CheckDecode(input: string): Uint8Array | null {
  let raw: Uint8Array;
  try {
    raw = bs58.decode(input);
  } catch {
    return null;
  }
  if (raw.length < 5) return null;
  const payload = raw.subarray(0, raw.length - 4);
  const checksum = raw.subarray(raw.length - 4);
  const hash = sha256d(payload);
  for (let i = 0; i < 4; i++) {
    if (hash[i] !== checksum[i]) return null;
  }
  return payload;
}

/** CRC16/XMODEM (poly 0x1021, init 0x0000) — the checksum used by TON friendly addresses. */
function crc16Xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc & 0xffff;
}

// ─── EVM ────────────────────────────────────────────────────────────────────

/** True for any well-formed `0x`-prefixed 20-byte address (checksummed or not). */
export function isEvmAddress(address: string): boolean {
  return isAddress(address, { strict: false });
}

// ─── Solana ───────────────────────────────────────────────────────────────

/** True for a 32-byte base58 ed25519 public key (Solana has no address checksum). */
export function isSolanaAddress(address: string): boolean {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

// ─── Bitcoin ────────────────────────────────────────────────────────────────

const BTC_HRP: Readonly<Record<string, BitcoinNetwork>> = {
  bc: 'mainnet',
  tb: 'testnet',
  bcrt: 'regtest',
};

/**
 * Returns the Bitcoin network an address belongs to, or `null` if it is not a
 * valid Bitcoin address. Handles bech32/bech32m segwit (BIP-173 / BIP-350) and
 * legacy Base58Check P2PKH/P2SH.
 */
export function bitcoinNetworkOf(address: string): BitcoinNetwork | null {
  // Segwit (bech32 for witness v0, bech32m for v1+)
  const decoded = bech32Decode(address, 90);
  if (decoded !== null) {
    const net = BTC_HRP[decoded.hrp];
    if (net !== undefined) {
      if (decoded.words.length < 1) return null;
      const witver = decoded.words[0]!;
      if (witver > 16) return null;
      const expectedEncoding = witver === 0 ? 'bech32' : 'bech32m';
      if (decoded.encoding !== expectedEncoding) return null;
      const program = bech32WordsToBytes(decoded.words.slice(1));
      if (program === null) return null;
      if (witver === 0 && program.length !== 20 && program.length !== 32) return null;
      if (program.length < 2 || program.length > 40) return null;
      return net;
    }
    // A valid bech32 string with a non-Bitcoin HRP (e.g. spark1…) — fall
    // through; the legacy decode below will fail and we return null.
  }
  // Legacy Base58Check (version + 20-byte hash + 4-byte checksum = 21-byte payload)
  const payload = base58CheckDecode(address);
  if (payload && payload.length === 21) {
    const version = payload[0]!;
    if (version === 0x00 || version === 0x05) return 'mainnet'; // P2PKH / P2SH
    if (version === 0x6f || version === 0xc4) return 'testnet'; // P2PKH / P2SH (testnet)
  }
  return null;
}

/** True for any valid Bitcoin address on any network. */
export function isBitcoinAddress(address: string): boolean {
  return bitcoinNetworkOf(address) !== null;
}

// ─── Tron ─────────────────────────────────────────────────────────────────

/** True for a Tron `T…` address (Base58Check over a `0x41`-prefixed 20-byte hash). */
export function isTronAddress(address: string): boolean {
  if (!address.startsWith('T')) return false;
  const payload = base58CheckDecode(address);
  return payload !== null && payload.length === 21 && payload[0] === 0x41;
}

// ─── TON ────────────────────────────────────────────────────────────────────

/** True for a TON address in raw (`workchain:hex`) or user-friendly (base64url) form. */
export function isTonAddress(address: string): boolean {
  // Raw form: <workchain>:<64 hex chars>
  if (/^-?\d+:[0-9a-fA-F]{64}$/.test(address)) return true;
  // Friendly form: 48 chars of base64 / base64url, decoding to 36 bytes.
  if (!/^[A-Za-z0-9_\-+/]{48}$/.test(address)) return false;
  const standard = address.replace(/-/g, '+').replace(/_/g, '/');
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(standard, 'base64'));
  } catch {
    return false;
  }
  if (bytes.length !== 36) return false;
  const expected = crc16Xmodem(bytes.subarray(0, 34));
  const given = (bytes[34]! << 8) | bytes[35]!;
  if (expected !== given) return false;
  const tag = bytes[0]! & 0x7f; // ignore the 0x80 "test only" flag
  const workchain = bytes[1]!;
  if (tag !== 0x11 && tag !== 0x51) return false; // bounceable / non-bounceable
  return workchain === 0x00 || workchain === 0xff;
}

// ─── Spark (forward-looking; Lightning roadmap item) ──────────────────────────

/** True for a Spark address (`spark1…`, bech32m). Recognised ahead of the chain loader. */
export function isSparkAddress(address: string): boolean {
  const decoded = bech32Decode(address, 256);
  if (decoded === null || decoded.encoding !== 'bech32m') return false;
  const { hrp } = decoded;
  return hrp.startsWith('spark') || hrp === 'sp' || hrp === 'sprt';
}

// ─── Dispatch / detection ─────────────────────────────────────────────────────

/**
 * Validates `address` against a specific chain family. Returns a structured
 * result so callers can surface a reason and (for EVM) a checksummed form.
 */
export function validateAddress(family: ChainFamily, address: string): AddressValidation {
  switch (family) {
    case 'evm':
      return isEvmAddress(address)
        ? { valid: true, family, normalized: getAddress(address) }
        : { valid: false, family, reason: 'not a valid EVM (0x + 20-byte) address' };
    case 'solana':
      return isSolanaAddress(address)
        ? { valid: true, family }
        : { valid: false, family, reason: 'not a 32-byte base58 Solana address' };
    case 'bitcoin':
      return isBitcoinAddress(address)
        ? { valid: true, family }
        : { valid: false, family, reason: 'not a valid Bitcoin address (segwit or legacy)' };
    case 'ton':
      return isTonAddress(address)
        ? { valid: true, family }
        : { valid: false, family, reason: 'not a valid TON address' };
    case 'tron':
      return isTronAddress(address)
        ? { valid: true, family }
        : { valid: false, family, reason: 'not a valid Tron (T…) address' };
  }
}

/**
 * Throws if `address` is not a well-formed recipient for `family`. Used at the
 * worker send boundary as a last-line guard so the engine never asks the WDK
 * account to sign a transfer to a malformed or wrong-family address. The check
 * is family-level (not network-level): a valid testnet address still passes on
 * a mainnet chain.
 */
export function assertValidRecipient(family: ChainFamily, address: string): void {
  const result = validateAddress(family, address);
  if (!result.valid) {
    throw new Error(
      `Refusing to send: invalid ${family} recipient address — ${result.reason ?? 'malformed address'}`,
    );
  }
}

/**
 * Best-effort detection of which family a bare address belongs to. Order is
 * chosen so unambiguous formats win first and the checksum-bearing families
 * (Bitcoin/Tron/TON) are tried before checksum-free Solana.
 */
export function detectPaymentFamily(address: string): PaymentFamily | null {
  if (isEvmAddress(address)) return 'evm';
  if (isBitcoinAddress(address)) return 'bitcoin';
  if (isSparkAddress(address)) return 'spark';
  if (isTronAddress(address)) return 'tron';
  if (isTonAddress(address)) return 'ton';
  if (isSolanaAddress(address)) return 'solana';
  return null;
}
