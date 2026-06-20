/**
 * Content-side receiver for SW-pushed EIP-1193 events. Listens on
 * chrome.runtime.onMessage for DappSwEventEnvelope, checks targetOrigin
 * against the page's window.location.origin, and forwards matching events
 * to inpage via window.postMessage.
 *
 * Per-origin filtering happens HERE rather than in the SW because the SW
 * cannot filter by URL without the "tabs" permission, which we deliberately
 * avoid (broader privilege = larger attack surface). Instead the SW
 * broadcasts to all tabs and each tab decides whether the event applies to
 * its origin.
 *
 * The trust model:
 *   - SW broadcasts are themselves trusted (they originate from our own
 *     extension's privileged context)
 *   - currentOrigin() reads window.location.origin from the CONTENT script's
 *     isolated world (trusted, same boundary as bridge.ts F-SEC-01 stamp)
 *   - The page's main world cannot tamper with this filter
 *
 * Per PRD 01 Addendum S12.4 v1.0 EIP-1193 event delivery + S12.6.4 envelope
 * types + S12.6.5 F-SEC-01 propagation.
 */

import type { DappEventEnvelope, DappSwEventEnvelope } from '../types/dapp-messages.js';

export interface EventReceiverDeps {
  /** Source of the page's verified origin. Production: () => window.location.origin. */
  readonly currentOrigin: () => string;
  /** Post the event envelope to the inpage script. Production: (env) => window.postMessage(env, '*'). */
  readonly postToInpage: (env: DappEventEnvelope) => void;
  /**
   * Listener registration. Production: omitted (defaults to
   * chrome.runtime.onMessage.addListener). Tests inject a mock to capture
   * the listener directly.
   */
  readonly addListener?: (cb: (msg: unknown) => void) => void;
}

/**
 * Register a chrome.runtime.onMessage listener that filters DAPP_EVENT messages,
 * validates the envelope shape, applies targetOrigin filtering, and forwards
 * valid events to inpage.
 */
export function startEventReceiver(deps: EventReceiverDeps): void {
  const listener = (msg: unknown): void => {
    if (!msg || typeof msg !== 'object') return;
    const m = msg as { type?: unknown };
    if (m.type !== 'DAPP_EVENT') return;

    const swEvent = msg as DappSwEventEnvelope;
    if (!swEvent.envelope || typeof swEvent.envelope !== 'object') return;
    if (swEvent.envelope.source !== 'wdk-dapp-event') return;

    // Per-origin filtering: if the SW specified a targetOrigin and this
    // page's origin doesn't match, drop the event silently.
    if (swEvent.targetOrigin && swEvent.targetOrigin !== deps.currentOrigin()) return;

    deps.postToInpage(swEvent.envelope);
  };

  if (deps.addListener) {
    deps.addListener(listener);
  } else {
    chrome.runtime.onMessage.addListener(listener);
  }
}