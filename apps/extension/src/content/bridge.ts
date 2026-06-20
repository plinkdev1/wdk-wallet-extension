/**
 * Content-side message bridge. Translates inpage's window.postMessage
 * DappRequestEnvelope into chrome.runtime DappSwRequestEnvelope, stamping the
 * verified origin in the process. Posts the SW's response back to inpage as
 * DappResponseEnvelope.
 *
 * SECURITY (F-SEC-01 propagation - the dApp-tier critical boundary):
 *   The verified origin is set HERE from getOrigin() (production: () =>
 *   window.location.origin), running in the content script's ISOLATED world.
 *   The inpage script's main-world view of location.origin cannot be trusted -
 *   the page can spoof it. ONLY the origin field this bridge writes is
 *   authoritative. The bridge NEVER reads origin from the inpage envelope.
 *
 * Per PRD 01 Addendum S12.6.4 (envelope types) + S12.6.5 (F-SEC-01 propagation).
 */

import type {
  DappRequestEnvelope,
  DappResponseEnvelope,
  DappSwRequestEnvelope,
  DappSwResponseEnvelope,
} from '../types/dapp-messages.js';

export interface BridgeDeps {
  /** Verified origin source. Production: () => window.location.origin. */
  readonly getOrigin: () => string;
  /** Send the typed envelope to the SW and await the typed response. */
  readonly sendToSw: (msg: DappSwRequestEnvelope) => Promise<DappSwResponseEnvelope>;
  /** Post the response back to inpage. Production: (env) => window.postMessage(env, '*'). */
  readonly postToInpage: (env: DappResponseEnvelope) => void;
}

/**
 * Build a message-event handler that bridges inpage requests to the SW.
 *
 * Filters by source === 'wdk-dapp-request'. Ignores malformed envelopes
 * (missing id or method strings). All other concerns - method validity,
 * params shape, user approval - are SW responsibilities (B4.3+).
 */
export function createBridge(deps: BridgeDeps): (event: MessageEvent) => Promise<void> {
  return async function handleInpageMessage(event: MessageEvent): Promise<void> {
    const data = event.data as unknown;
    if (!data || typeof data !== 'object') return;
    const env = data as { source?: unknown };
    if (env.source !== 'wdk-dapp-request') return;

    const req = data as DappRequestEnvelope;
    if (typeof req.id !== 'string' || typeof req.method !== 'string') return;

    // Stamp the verified origin. SECURITY: this is the authoritative origin
    // the SW will see. Any origin field on the inpage envelope is ignored.
    const swRequest: DappSwRequestEnvelope = {
      type: 'DAPP_REQUEST',
      id: req.id,
      origin: deps.getOrigin(),
      method: req.method,
      ...(req.params !== undefined ? { params: req.params } : {}),
    };

    let response: DappResponseEnvelope;
    try {
      const swResponse = await deps.sendToSw(swRequest);
      response = {
        source: 'wdk-dapp-response',
        id: req.id,
        ...(swResponse.result !== undefined ? { result: swResponse.result } : {}),
        ...(swResponse.error ? { error: swResponse.error } : {}),
      };
    } catch (err) {
      // EIP-1474 internal error code for unexpected transport failures.
      response = {
        source: 'wdk-dapp-response',
        id: req.id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    deps.postToInpage(response);
  };
}