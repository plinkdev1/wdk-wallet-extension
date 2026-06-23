/**
 * Minimal, checksum-validating BOLT11 (Lightning invoice) decoder.
 *
 * Decodes the human-readable part (network + amount) and the invoice timestamp,
 * and proves integrity via the bech32 checksum. It deliberately does *not* yet
 * walk every tagged field (payment_hash, description, routing hints) — amount,
 * network, and validity are what the send/receive UX gate needs, and the tagged
 * fields are a clean later extension. Lives in the engine so the upcoming Spark
 * Lightning family reuses it (see finding F-SPARK-06).
 */

import { bech32Decode } from './bech32.js';
import type { BitcoinNetwork } from './types.js';

interface LnPrefix {
  readonly prefix: string;
  readonly network: BitcoinNetwork;
}

// Ordered longest-first so `lnbcrt`/`lntbs` match before `lnbc`/`lntb`.
const LN_PREFIXES: readonly LnPrefix[] = [
  { prefix: 'lnbcrt', network: 'regtest' },
  { prefix: 'lnbc', network: 'mainnet' },
  { prefix: 'lntbs', network: 'signet' },
  { prefix: 'lntb', network: 'testnet' },
];

/** Result of {@link decodeBolt11}. */
export interface DecodedBolt11 {
  readonly network: BitcoinNetwork;
  /** Amount in millisatoshis; omitted for "any amount" invoices. */
  readonly millisatoshis?: bigint;
  /** Invoice creation time in unix seconds. */
  readonly timestamp?: number;
}

/** 1 BTC = 100,000,000,000 msat. */
const MSAT_PER_BTC = 100_000_000_000n;

/** Parses the amount portion of the HRP (e.g. `2500u`, `m`, `10n`) to millisatoshis. */
function parseAmountToMsat(amount: string): bigint | undefined {
  const match = /^(\d+)([munp]?)$/.exec(amount);
  if (!match) return undefined;
  const value = BigInt(match[1]!);
  switch (match[2]) {
    case '':
      return value * MSAT_PER_BTC; // whole BTC
    case 'm':
      return value * (MSAT_PER_BTC / 1_000n); // milli
    case 'u':
      return value * (MSAT_PER_BTC / 1_000_000n); // micro
    case 'n':
      return value * (MSAT_PER_BTC / 1_000_000_000n); // nano
    case 'p':
      // pico-BTC = 0.1 msat; only valid if it lands on a whole msat.
      return value % 10n === 0n ? value / 10n : undefined;
    default:
      return undefined;
  }
}

/**
 * Decodes a BOLT11 invoice (with or without a `lightning:` scheme prefix).
 * Returns `null` if the string is not a structurally valid, checksum-correct
 * invoice for a recognised network.
 */
export function decodeBolt11(invoice: string): DecodedBolt11 | null {
  let raw = invoice.trim();
  if (raw.toLowerCase().startsWith('lightning:')) raw = raw.slice('lightning:'.length);
  if (!raw.toLowerCase().startsWith('ln')) return null;

  // BOLT11 invoices exceed bech32's default 90-char limit; raise it. They use
  // the original bech32 checksum constant (not bech32m).
  const decoded = bech32Decode(raw, 2048);
  if (decoded === null || decoded.encoding !== 'bech32') return null;
  const prefix = decoded.hrp;
  const words = decoded.words;

  const matched = LN_PREFIXES.find((p) => prefix.startsWith(p.prefix));
  if (!matched) return null;

  const amountPart = prefix.slice(matched.prefix.length);
  let millisatoshis: bigint | undefined;
  if (amountPart !== '') {
    millisatoshis = parseAmountToMsat(amountPart);
    if (millisatoshis === undefined) return null; // malformed amount
  }

  // Timestamp is the first 7 words (35 bits) of the data part.
  let timestamp: number | undefined;
  if (words.length >= 7) {
    let value = 0;
    for (let i = 0; i < 7; i++) value = value * 32 + words[i]!;
    timestamp = value;
  }

  return {
    network: matched.network,
    ...(millisatoshis !== undefined ? { millisatoshis } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
  };
}
