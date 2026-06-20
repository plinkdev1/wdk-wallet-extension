import type {
  Hex,
  SignableMessage,
  TransactionRequest,
  TypedDataDomain,
  TypedDataParameter,
} from 'viem';

/**
 * Typed account surfaces (per PRD 02 Addendum 2.2).
 *
 * Phase 0 surfaced (F-WDK-06) that `wdk.getAccount()` returns the abstract
 * `IWalletAccountWithProtocols`, not a chain-specific concrete type. Chain-specific
 * methods like `signTypedData` are not visible to TypeScript on the returned account.
 *
 * wdk-web-core's worker layer wraps the cast once internally and exposes typed
 * accessors per chain family via WalletWorkerApi. Consumers never call
 * `wdk.getAccount()` directly.
 *
 * See: ADR-009 (address parity), PRD 02 Addendum 2.2, M1 v2 Appendix B item B.4.
 */

/** EIP-712 typed-data payload as accepted by signTypedData. */
export interface TypedDataPayload {
  readonly domain: TypedDataDomain;
  readonly types: Record<string, readonly TypedDataParameter[]>;
  readonly primaryType?: string;
  readonly message: Record<string, unknown>;
}

/**
 * EVM account surface. All EVM chains share this shape; the chain context
 * is supplied at the worker-API call site, not bound to the account.
 */
export interface EvmAccount {
  getAddress(): Promise<Hex>;
  signMessage(message: SignableMessage): Promise<Hex>;
  signTypedData(payload: TypedDataPayload): Promise<Hex>;
  signTransaction(tx: TransactionRequest): Promise<Hex>;
}

/** Solana base58-encoded public key (branded). */
export type Base58Address = string & { readonly __brand: 'Base58Address' };

/** Solana signature, base58-encoded (branded). */
export type SolanaSignature = string & { readonly __brand: 'SolanaSignature' };

/**
 * Solana transaction placeholder. Step 4 (chain loaders) refines this when
 * the Solana wallet manager wires up @solana/web3.js transaction handling.
 */
export interface SolanaTransaction {
  readonly serializedMessage: Uint8Array;
}

/** Solana signed transaction placeholder. Mirror of SolanaTransaction. */
export interface SolanaSignedTransaction {
  readonly serialized: Uint8Array;
}

/** Solana account surface. */
export interface SolanaAccount {
  getAddress(): Promise<Base58Address>;
  signMessage(message: Uint8Array): Promise<SolanaSignature>;
  signTransaction(tx: SolanaTransaction): Promise<SolanaSignedTransaction>;
}