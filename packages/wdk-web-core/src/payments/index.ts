/**
 * `payments/` — framework-agnostic address validation and payment-URI parsing
 * shared by every WDK surface. Pure functions, no key material, no worker
 * boundary. See `./types.ts` for the rationale.
 */

export * from './types.js';
export {
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
export { decodeBolt11 } from './bolt11.js';
export type { DecodedBolt11 } from './bolt11.js';
export { parsePaymentUri } from './uri.js';
