/**
 * Minimal bech32 / bech32m decoder (BIP-173 / BIP-350).
 *
 * Decode-only and dependency-free. The engine needs to *validate* segwit
 * Bitcoin addresses, Spark (`spark1…`) addresses, and BOLT11 invoices — all
 * bech32-family strings — but never to encode them. Owning this ~40-line
 * decoder avoids a runtime dependency on the `bech32` package, which is only a
 * transitive (undeclared) entry in this package's tree and so would not resolve
 * under strict (pnpm) `node_modules`.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3] as const;

export type Bech32Encoding = 'bech32' | 'bech32m';

const CHECKSUM_CONST: Readonly<Record<Bech32Encoding, number>> = {
  bech32: 1,
  bech32m: 0x2bc830a3,
};

export interface Bech32Decoded {
  /** Human-readable part (lower-cased), e.g. `bc`, `tb`, `spark`, `lnbc2500u`. */
  readonly hrp: string;
  /** 5-bit data groups with the 6-word checksum already stripped. */
  readonly words: number[];
  /** Which checksum constant validated — callers enforce the expected one. */
  readonly encoding: Bech32Encoding;
}

function polymod(values: number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if (((top >> i) & 1) !== 0) chk ^= GENERATOR[i]!;
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

/**
 * Decodes a bech32/bech32m string, verifying its checksum. Returns `null` for
 * any malformed input (bad characters, mixed case, missing separator, failed
 * checksum). `limit` defaults to the BIP-173 maximum of 90; pass a larger value
 * for BOLT11 invoices, which intentionally lift that limit.
 */
export function bech32Decode(input: string, limit = 90): Bech32Decoded | null {
  if (input.length < 8 || input.length > limit) return null;
  if (input !== input.toLowerCase() && input !== input.toUpperCase()) return null;
  const str = input.toLowerCase();
  const sep = str.lastIndexOf('1');
  if (sep < 1 || sep + 7 > str.length) return null;
  const hrp = str.slice(0, sep);
  const dataPart = str.slice(sep + 1);
  const words: number[] = [];
  for (const ch of dataPart) {
    const idx = CHARSET.indexOf(ch);
    if (idx === -1) return null;
    words.push(idx);
  }
  const checksum = polymod(hrpExpand(hrp).concat(words));
  let encoding: Bech32Encoding | null = null;
  if (checksum === CHECKSUM_CONST.bech32) encoding = 'bech32';
  else if (checksum === CHECKSUM_CONST.bech32m) encoding = 'bech32m';
  if (encoding === null) return null;
  return { hrp, words: words.slice(0, words.length - 6), encoding };
}

/**
 * Converts 5-bit bech32 data groups to bytes, enforcing valid (zero, < 5-bit)
 * padding. Returns `null` if the padding is non-zero or over-long.
 */
export function bech32WordsToBytes(words: number[]): Uint8Array | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const word of words) {
    if (word < 0 || word >> 5 !== 0) return null;
    acc = (acc << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) return null;
  return Uint8Array.from(out);
}
