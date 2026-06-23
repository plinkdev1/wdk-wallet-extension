/**
 * Payment-URI parsing: turns a pasted/scanned string into a normalised
 * {@link ParsedPaymentTarget}. Recognises BIP-21 (`bitcoin:`), EIP-681
 * (`ethereum:`), BOLT11 (`lightning:` or a bare `ln…` invoice), and bare
 * addresses (family auto-detected).
 */

import { bitcoinNetworkOf, detectPaymentFamily } from './address.js';
import { decodeBolt11 } from './bolt11.js';
import type { ParsedPaymentTarget } from './types.js';

/** Parses a decimal BTC amount string (e.g. `0.001`) to satoshis without floating point. */
function btcToSatoshis(amount: string): bigint | undefined {
  if (!/^\d*\.?\d*$/.test(amount) || amount === '' || amount === '.') return undefined;
  const [whole = '0', frac = ''] = amount.split('.');
  if (frac.length > 8) return undefined; // more precision than satoshis can hold
  const fracPadded = (frac + '00000000').slice(0, 8);
  return BigInt(whole) * 100_000_000n + BigInt(fracPadded || '0');
}

/** Parses a BIP-21 `bitcoin:` URI. */
function parseBip21(raw: string): ParsedPaymentTarget | null {
  const body = raw.slice('bitcoin:'.length);
  const queryIndex = body.indexOf('?');
  const address = queryIndex >= 0 ? body.slice(0, queryIndex) : body;
  const network = bitcoinNetworkOf(address);
  if (!network) return null;

  const params = new URLSearchParams(queryIndex >= 0 ? body.slice(queryIndex + 1) : '');
  const amount = params.get('amount');
  const satoshis = amount !== null ? btcToSatoshis(amount) : undefined;
  const label = params.get('label') ?? undefined;
  const message = params.get('message') ?? undefined;

  return {
    scheme: 'bip21',
    family: 'bitcoin',
    address,
    network,
    ...(satoshis !== undefined ? { satoshis } : {}),
    ...(label !== undefined ? { label } : {}),
    ...(message !== undefined ? { message } : {}),
    raw,
  };
}

/** Parses an EIP-681 `ethereum:` URI (native value or ERC-20 `transfer`). */
function parseEip681(raw: string): ParsedPaymentTarget | null {
  let work = raw.slice('ethereum:'.length);
  if (work.startsWith('pay-')) work = work.slice('pay-'.length);

  const queryIndex = work.indexOf('?');
  const query = queryIndex >= 0 ? work.slice(queryIndex + 1) : '';
  let path = queryIndex >= 0 ? work.slice(0, queryIndex) : work;

  let functionName: string | undefined;
  const slashIndex = path.indexOf('/');
  if (slashIndex >= 0) {
    functionName = path.slice(slashIndex + 1);
    path = path.slice(0, slashIndex);
  }

  let chainId: number | undefined;
  let address = path;
  const atIndex = path.indexOf('@');
  if (atIndex >= 0) {
    address = path.slice(0, atIndex);
    const parsed = Number(path.slice(atIndex + 1));
    if (Number.isInteger(parsed) && parsed > 0) chainId = parsed;
  }

  const detected = detectPaymentFamily(address);
  if (detected !== 'evm') return null;

  const params = new URLSearchParams(query);
  const base = {
    scheme: 'eip681' as const,
    family: 'evm' as const,
    address,
    ...(chainId !== undefined ? { chainId } : {}),
    ...(functionName !== undefined ? { functionName } : {}),
    raw,
  };

  if (functionName === 'transfer') {
    const recipient = params.get('address') ?? undefined;
    const uint256 = params.get('uint256');
    const tokenAmount = uint256 !== null ? safeBigInt(uint256) : undefined;
    return {
      ...base,
      ...(recipient !== undefined ? { recipient } : {}),
      ...(tokenAmount !== undefined ? { tokenAmount } : {}),
    };
  }

  const value = params.get('value');
  const wei = value !== null ? safeBigInt(value) : undefined;
  return { ...base, ...(wei !== undefined ? { wei } : {}) };
}

/** BigInt parse that tolerates decimal and scientific-free integer strings, else undefined. */
function safeBigInt(value: string): bigint | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

/**
 * Parses any payment string into a normalised target, or returns `null` if it
 * is not a recognised address or payment URI.
 */
export function parsePaymentUri(input: string): ParsedPaymentTarget | null {
  const raw = input.trim();
  if (raw === '') return null;
  const lower = raw.toLowerCase();

  if (lower.startsWith('bitcoin:')) return parseBip21(raw);
  if (lower.startsWith('ethereum:')) return parseEip681(raw);

  if (lower.startsWith('lightning:') || lower.startsWith('ln')) {
    const decoded = decodeBolt11(raw);
    if (decoded) {
      const invoice = lower.startsWith('lightning:') ? raw.slice('lightning:'.length) : raw;
      return {
        scheme: 'bolt11',
        family: 'lightning',
        network: decoded.network,
        invoice,
        ...(decoded.millisatoshis !== undefined ? { millisatoshis: decoded.millisatoshis } : {}),
        ...(decoded.timestamp !== undefined ? { timestamp: decoded.timestamp } : {}),
        raw,
      };
    }
    if (lower.startsWith('lightning:')) return null; // explicit scheme but undecodable
  }

  // Bare address — detect the family.
  const family = detectPaymentFamily(raw);
  if (family) return { scheme: 'address', family, address: raw, raw };

  return null;
}
