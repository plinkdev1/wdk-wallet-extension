/**
 * Payment-target types for the shared engine.
 *
 * `payments/` is the single, framework-agnostic source of truth for
 * **address validation** and **payment-URI parsing** across every WDK surface
 * (the browser extension and the Next.js template both import these from
 * `@wdk-starter/wdk-web-core`, instead of re-implementing per-family checks in
 * each UI). The functions here are pure — they touch no key material and need
 * no worker boundary — so they are exported directly from the package.
 *
 * Scope is deliberately broad enough to seed the Lightning/Spark roadmap item:
 * BOLT11 invoice decoding and `spark1…` address recognition live here so the
 * later Spark chain family can reuse them (see `spark-browser-validation`
 * finding F-SPARK-06).
 */

import type { ChainFamily } from '../types/chains.js';

/**
 * Families a payment target can resolve to. Extends the engine's runtime
 * {@link ChainFamily} with two payment-only discriminants that are not (yet)
 * full account families in their own right:
 *  - `spark` — a Spark L2 address (`spark1…`); recognised ahead of the chain
 *    loader so paste/QR flows work the moment Spark ships.
 *  - `lightning` — a BOLT11 invoice, which is a *payment request*, not an
 *    address.
 */
export type PaymentFamily = ChainFamily | 'spark' | 'lightning';

/** Bitcoin-style networks surfaced by the Bitcoin and BOLT11 decoders. */
export type BitcoinNetwork = 'mainnet' | 'testnet' | 'regtest' | 'signet';

/** Result of validating a string against a specific chain family. */
export interface AddressValidation {
  /** Whether `address` is a well-formed address for `family`. */
  readonly valid: boolean;
  /** The family the check was run against. */
  readonly family: ChainFamily;
  /**
   * Canonical form when the family has one (e.g. an EIP-55 checksummed EVM
   * address). Omitted when the input is already canonical or the family has
   * no distinct canonical representation.
   */
  readonly normalized?: string;
  /** Human-readable reason the address was rejected (for UX). */
  readonly reason?: string;
}

/** URI scheme a parsed payment target was derived from. */
export type PaymentScheme = 'address' | 'bip21' | 'eip681' | 'bolt11';

/**
 * A normalised payment target produced by {@link parsePaymentUri}. Discriminated
 * on `scheme` so each variant only carries the fields that make sense for it.
 */
export type ParsedPaymentTarget =
  | {
      readonly scheme: 'address';
      readonly family: PaymentFamily;
      readonly address: string;
      readonly raw: string;
    }
  | {
      readonly scheme: 'bip21';
      readonly family: 'bitcoin';
      readonly address: string;
      readonly network: BitcoinNetwork;
      /** Requested amount in satoshis, if the URI carried `amount`. */
      readonly satoshis?: bigint;
      readonly label?: string;
      readonly message?: string;
      readonly raw: string;
    }
  | {
      readonly scheme: 'eip681';
      readonly family: 'evm';
      /** Target address: the payee for a native transfer, the token contract for `transfer`. */
      readonly address: string;
      readonly chainId?: number;
      /** Native value in wei (no `functionName`). */
      readonly wei?: bigint;
      /** EIP-681 function name, e.g. `transfer` for an ERC-20 send. */
      readonly functionName?: string;
      /** ERC-20 recipient (the `address` parameter of a `transfer`). */
      readonly recipient?: string;
      /** ERC-20 amount (the `uint256` parameter of a `transfer`). */
      readonly tokenAmount?: bigint;
      readonly raw: string;
    }
  | {
      readonly scheme: 'bolt11';
      readonly family: 'lightning';
      readonly network: BitcoinNetwork;
      readonly invoice: string;
      /** Invoice amount in millisatoshis; omitted for "any amount" invoices. */
      readonly millisatoshis?: bigint;
      /** Invoice creation time (unix seconds). */
      readonly timestamp?: number;
      readonly raw: string;
    };
