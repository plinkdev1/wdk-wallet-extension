/**
 * x402 client wire format — runs INSIDE the worklet.
 *
 * Lets a WDK wallet/agent pay an HTTP "402 Payment Required" challenge: given the
 * server's PaymentRequirements, the worker signs an EIP-3009 authorization (the
 * x402 "exact" scheme) and returns the base64 `X-PAYMENT` header the client
 * attaches when it retries the request. The key never leaves the worklet; this
 * module only encodes the wire format (signing happens via the account).
 */

/** Common x402 network name → EVM chain id. */
export const NETWORK_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  'base-sepolia': 84532,
  polygon: 137,
  'polygon-amoy': 80002,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
  'avalanche-fuji': 43113,
  sepolia: 11155111,
};

export function networkToChainId(network: string | number): number {
  if (typeof network === 'number') return network;
  const id = NETWORK_CHAIN_IDS[String(network).toLowerCase()];
  if (!id) throw new Error(`Unknown x402 network: ${network}`);
  return id;
}

/** One entry of a server's 402 `accepts` array (the "exact" / EIP-3009 scheme). */
export interface X402Requirements {
  readonly scheme: string;
  readonly network: string;
  readonly maxAmountRequired: string;
  readonly payTo: string;
  readonly asset: string;
  readonly maxTimeoutSeconds?: number;
  readonly resource?: string;
  /** EIP-712 domain of the asset (name/version) — needed to sign. */
  readonly extra?: { readonly name?: string; readonly version?: string };
}

export interface X402Authorization {
  readonly from: string;
  readonly to: string;
  readonly value: string;
  readonly validAfter: string;
  readonly validBefore: string;
  readonly nonce: string;
}

export interface X402Payment {
  readonly x402Version: number;
  readonly scheme: string;
  readonly network: string;
  readonly payload: { readonly signature: string; readonly authorization: X402Authorization };
}

export const X402_VERSION = 1;
export const SCHEME_EXACT = 'exact';

/** A random 32-byte hex nonce (EIP-3009 nonces are random, not sequential). */
export function generateX402Nonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildExactPayment(network: string, signature: string, authorization: X402Authorization): X402Payment {
  return { x402Version: X402_VERSION, scheme: SCHEME_EXACT, network: String(network), payload: { signature, authorization } };
}

function toBase64(str: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(b64)));
}

/** Encode a payment payload into the `X-PAYMENT` header value. */
export function encodePaymentHeader(payment: X402Payment): string {
  return toBase64(JSON.stringify(payment));
}

/** Decode an `X-PAYMENT` header value. */
export function decodePaymentHeader(headerValue: string): X402Payment {
  if (typeof headerValue !== 'string' || headerValue === '') throw new Error('Empty X-PAYMENT header.');
  try {
    return JSON.parse(fromBase64(headerValue.trim())) as X402Payment;
  } catch {
    throw new Error('Malformed X-PAYMENT header (expected base64-encoded JSON).');
  }
}
