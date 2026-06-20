/**
 * @wdk-starter/wdk-web-core/adapters/relayer
 *
 * Submission boundary for EIP-3009 transferWithAuthorization relays.
 * Caller has already built calldata (encoded transferWithAuthorization(...)
 * with v/r/s from the signed authorization baked in); this adapter submits
 * it for on-chain broadcast by a relayer service (which pays gas).
 *
 * Two implementations:
 *   - createHttpRelayerAdapter: real HTTP client, POSTs JSON to a configured
 *     endpoint. Used by products in production.
 *   - createMockRelayerAdapter: in-memory fake for tests + dev fixtures.
 *     Returns a configurable txHash without making any network call.
 *
 * Both implementations call assertEip3009TxDataFits(calldata) before
 * submission. F-EIP3009-01 (Plasma relayer's 3000-char calldata limit) is
 * enforced at THIS layer rather than inside the EIP-3009 builder because
 * the builder produces typed-data payloads (signed off-chain, no size
 * constraint), while the relayer is the actual binding constraint. The
 * mock honors the same check so consumer-side bugs (e.g., constructing
 * oversized calldata) surface in test fixtures, not just production.
 *
 * See: F-EIP3009-01, ADR-010 (relayer flow), kickoff Part V Step 7,
 * Phase 0 relayer adapter prototype (apps/web/src/adapters/relayer.ts).
 */

import type { Address, Hex } from 'viem';
import { assertEip3009TxDataFits } from '../eip3009/builder.js';

/** Inputs to a relay submission. The signature is already encoded in calldata. */
export interface RelaySubmitParams {
  /** EVM chain ID the calldata targets. Relayer routes per chain. */
  readonly chainId: number;
  /** The token contract address - the `to` of the on-chain tx the relayer broadcasts. */
  readonly to: Address;
  /** Encoded transferWithAuthorization call with v/r/s baked in. */
  readonly calldata: Hex;
}

/** Successful relay result. */
export interface RelaySubmitResult {
  /** Hash of the on-chain transaction the relayer broadcast. */
  readonly txHash: Hex;
}

/** The abstraction product code depends on. Either http or mock backs it. */
export interface RelayerAdapter {
  submit(params: RelaySubmitParams): Promise<RelaySubmitResult>;
}

/** Configuration for the production HTTP relayer adapter. */
export interface HttpRelayerAdapterOptions {
  /** Full URL to POST submissions to (e.g. 'https://relayer.plasma.to/relay'). */
  readonly endpoint: string;
  /**
   * Optional fetch override - for tests injecting a mock, or for products
   * that want retry / circuit-breaker wrappers around fetch. Defaults to
   * globalThis.fetch.
   */
  readonly fetch?: typeof fetch;
}

/**
 * Real HTTP relayer adapter. POSTs the submit params as JSON to the
 * configured endpoint and expects a JSON response with a string `txHash`
 * field. Throws on HTTP error responses (with status code + body context)
 * and on responses missing txHash.
 */
export function createHttpRelayerAdapter(options: HttpRelayerAdapterOptions): RelayerAdapter {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async submit(params: RelaySubmitParams): Promise<RelaySubmitResult> {
      assertEip3009TxDataFits(params.calldata);

      const response = await fetchImpl(options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: params.chainId,
          to: params.to,
          calldata: params.calldata,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '<no body>');
        throw new Error('Relayer HTTP error: ' + response.status + ' ' + response.statusText + ' - ' + errorBody);
      }

      const data = await response.json() as { txHash?: unknown };
      if (typeof data.txHash !== 'string') {
        throw new Error('Relayer response missing txHash (got ' + JSON.stringify(data) + ')');
      }
      return { txHash: data.txHash as Hex };
    },
  };
}

/** Configuration for the mock relayer adapter (tests + fixtures). */
export interface MockRelayerAdapterOptions {
  /** Fixed txHash to return from every submit. Defaults to 0x000...0000 (32 bytes). */
  readonly fixedTxHash?: Hex;
  /**
   * Optional submit handler for fixtures that want per-call behavior
   * (varying hashes, simulated failures, etc.). If provided, takes
   * precedence over fixedTxHash.
   */
  readonly onSubmit?: (params: RelaySubmitParams) => Promise<RelaySubmitResult> | RelaySubmitResult;
}

/**
 * In-memory mock relayer adapter. Does not touch the network. Useful in
 * tests (Step 7 spec + Step 11 integration smoke) and in dev fixtures
 * where a real relayer is not yet wired. Honors the same MAX_TX_DATA
 * size check as the HTTP adapter (F-EIP3009-01).
 */
export function createMockRelayerAdapter(options: MockRelayerAdapterOptions = {}): RelayerAdapter {
  const defaultHash = ('0x' + '00'.repeat(32)) as Hex;
  return {
    async submit(params: RelaySubmitParams): Promise<RelaySubmitResult> {
      assertEip3009TxDataFits(params.calldata);
      if (options.onSubmit) {
        return options.onSubmit(params);
      }
      return { txHash: options.fixedTxHash ?? defaultHash };
    },
  };
}