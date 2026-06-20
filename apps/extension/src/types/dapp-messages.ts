/**
 * dApp message protocol - the WHOLE pipeline from inpage to SW.
 *
 * Different trust boundary from src/types/messages.ts (which is internal
 * popup <-> SW). This file describes the OUTSIDE-IN pipeline:
 *
 *   dApp page         <-- untrusted: anything in the web page can call this
 *     |  EIP-1193 request via window.ethereum.request({method, params})
 *     V
 *   inpage script     <-- our code in MAIN world (still untrusted)
 *     |  window.postMessage(DappRequestEnvelope, '*')
 *     V
 *   content script    <-- our code in ISOLATED world (trusted to read origin)
 *     |  port.postMessage(DappSwRequestEnvelope) [adds verified origin]
 *     V
 *   service worker    <-- the trust anchor
 *
 * Response path runs in reverse with DappResponseEnvelope / DappSwResponseEnvelope.
 *
 * Per PRD 01 Addendum S12.6.4.
 *
 * CRITICAL SECURITY: DappRequestEnvelope intentionally OMITS the origin field.
 * The inpage script runs in the page's main world and cannot be trusted to
 * report its own origin honestly (a malicious script could spoof it). Only the
 * content-script-set origin in DappSwRequestEnvelope is authoritative.
 */

// --- Supporting types (referenced from the request union below) ---

/** EVM transaction request shape per Ethereum JSON-RPC + EIP-1559. All fields hex-encoded. */
export interface EvmTransactionRequest {
  readonly from?: string;
  readonly to?: string;
  readonly value?: string;
  readonly data?: string;
  readonly gas?: string;
  readonly gasPrice?: string;             // legacy (pre-1559)
  readonly maxFeePerGas?: string;         // EIP-1559
  readonly maxPriorityFeePerGas?: string; // EIP-1559
  readonly nonce?: string;
  readonly chainId?: string;
}

/** wallet_addEthereumChain payload per EIP-3085. */
export interface AddEthereumChainPayload {
  readonly chainId: string;
  readonly chainName: string;
  readonly rpcUrls: readonly string[];
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly blockExplorerUrls?: readonly string[];
  readonly iconUrls?: readonly string[];
}

// --- EIP-1193 method whitelist (used by SW dispatcher in B4.3) ---

/** EIP-1193 method discriminator. v1.0 ships these 8 + the EIP-6963 announce event. */
export type Eip1193Method =
  | 'eth_chainId'
  | 'eth_accounts'
  | 'eth_requestAccounts'
  | 'eth_sendTransaction'
  | 'personal_sign'
  | 'eth_signTypedData_v4'
  | 'wallet_switchEthereumChain'
  | 'wallet_addEthereumChain';

export type Eip1193Request =
  | { method: 'eth_chainId'; params?: readonly [] }
  | { method: 'eth_accounts'; params?: readonly [] }
  | { method: 'eth_requestAccounts'; params?: readonly [] }
  | { method: 'eth_sendTransaction'; params: readonly [EvmTransactionRequest] }
  | { method: 'personal_sign'; params: readonly [hex_message: string, address: string] }
  | { method: 'eth_signTypedData_v4'; params: readonly [address: string, typedData_json: string] }
  | { method: 'wallet_switchEthereumChain'; params: readonly [{ readonly chainId: string }] }
  | { method: 'wallet_addEthereumChain'; params: readonly [AddEthereumChainPayload] };

/**
 * The result value an Eip1193Handler resolves to. The dispatcher passes this
 * through unchanged; handlers.ts wraps it in the `{ result: ... }` envelope at
 * the SW boundary (the DAPP_REQUEST handler in handlers.ts).
 *
 * The wire-format envelope `Eip1193Response` is the OUTER shape that crosses
 * the SW <-> content script boundary; `Eip1193ResultValue` is the INNER value
 * each individual EIP-1193 method handler produces. Errors are THROWN by
 * handlers (not returned as { error } shapes); handlers.ts converts thrown
 * errors into the { error } envelope at the SW boundary.
 *
 * EIP-1193 mandates hex-string encoding for byte values, so we keep the
 * template-literal types (`0x${string}`) rather than widening to plain
 * string. A union of `0x${string}` and `string` would FLATTEN to `string`
 * (the supertype absorbs the subtype), silently losing the hex guarantee -
 * so `string` is deliberately excluded from this union.
 *
 * When adding new handlers, extend this union with the new return shape.
 */
export type Eip1193ResultValue =
  | `0x${string}`       // tx hash, signature, hex-encoded data, chain id hex
  | `0x${string}`[]     // accounts arrays
  | null;               // wallet_switch/addEthereumChain idempotent success

/**
 * Wire-format envelope crossing the SW <-> content boundary. Handlers do not
 * construct this directly; the handlers.ts DAPP_REQUEST handler wraps
 * successful handler returns into { result } and thrown errors into { error }.
 */
export type Eip1193Response =
  | { readonly result: Eip1193ResultValue }
  | { readonly error: { readonly code: number; readonly message: string; readonly data?: unknown } };

// --- Envelope types (each hop's wire format) ---

/** Inpage -> content envelope (window.postMessage). */
export interface DappRequestEnvelope {
  readonly source: 'wdk-dapp-request';
  readonly id: string;                  // crypto.randomUUID() generated by inpage
  readonly method: string;              // EIP-1193 method (unchecked at envelope tier; SW dispatcher whitelists)
  readonly params?: readonly unknown[]; // EIP-1193 params (passthrough; method-specific validation in SW)
}

/** Content -> inpage envelope (window.postMessage). */
export interface DappResponseEnvelope {
  readonly source: 'wdk-dapp-response';
  readonly id: string;                  // matches DappRequestEnvelope.id
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

/**
 * SW -> content -> inpage envelope for EIP-1193 events.
 * Sent SW->content via chrome.tabs.sendMessage (wrapped in DappSwEventEnvelope
 * for runtime-channel framing), then content->inpage via window.postMessage
 * (this raw DappEventEnvelope). No request/response correlation.
 * Events: chainChanged, accountsChanged, connect, disconnect.
 */
export interface DappEventEnvelope {
  readonly source: 'wdk-dapp-event';
  readonly event: 'chainChanged' | 'accountsChanged' | 'connect' | 'disconnect';
  readonly data: unknown;
}

/**
 * SW -> content runtime message wrapper for EIP-1193 events. The content
 * event-receiver unwraps the inner DappEventEnvelope and posts it to inpage
 * via window.postMessage.
 *
 * Per-origin filtering happens at the content-receiver tier (not SW): the SW
 * broadcasts to all tabs via chrome.tabs.sendMessage, and each receiver
 * checks targetOrigin against its window.location.origin. This avoids
 * requiring "tabs" permission in the manifest (which would broaden the SW's
 * privileges to read tab URLs - unnecessary attack surface for v0.1).
 *
 * Per PRD 01 Addendum S12.4 v1.0 + S12.6.4 envelope shapes.
 */
export interface DappSwEventEnvelope {
  readonly type: 'DAPP_EVENT';
  readonly envelope: DappEventEnvelope;
  /** Optional origin filter - only deliver to content scripts on this origin. */
  readonly targetOrigin?: string;
}

/**
 * Content -> SW envelope (chrome.runtime port message).
 * `origin` is set by the content script from window.location.origin and is
 * the only origin value the SW will trust. F-SEC-01 applies at this tier:
 * the SW dispatcher whitelists `type` via Object.hasOwn.
 */
export interface DappSwRequestEnvelope {
  readonly type: 'DAPP_REQUEST';
  readonly id: string;                  // matches DappRequestEnvelope.id (round-tripped)
  readonly origin: string;              // CONTENT-SCRIPT-VERIFIED window.location.origin
  readonly method: string;
  readonly params?: readonly unknown[];
}

/** SW -> content envelope (chrome.runtime port message). */
export interface DappSwResponseEnvelope {
  readonly id: string;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}

// --- EIP-6963 multi-provider discovery ---

/**
 * EIP-6963 provider announcement detail.
 * Wallet dispatches CustomEvent('eip6963:announceProvider', { detail }) and
 * also listens for 'eip6963:requestProvider' to re-announce on demand.
 */
export interface Eip6963ProviderDetail {
  readonly info: {
    readonly uuid: string;              // wallet-install UUID (stored in chrome.storage.local)
    readonly name: 'WDK Wallet';
    readonly icon: string;              // data URI
    readonly rdns: 'app.wdkstarter.wallet';
  };
  readonly provider: unknown;           // EIP-1193 provider instance (typed as unknown to break circular dep)
}