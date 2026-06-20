/**
 * SW-side broadcast bus for EIP-1193 events (chainChanged, accountsChanged,
 * connect, disconnect) per EIP-1193 + PRD 01 Addendum S12.4 v1.0 scope.
 *
 * B4.9a ships the plumbing; no events are fired yet. B4.9b adds chainChanged
 * firing from wallet_switchEthereumChain; later commits may add accountsChanged
 * (on account picker change) and connect/disconnect (on revoke flows).
 *
 * Architecture decisions:
 *   - SW broadcasts to ALL tabs via chrome.tabs.sendMessage. No "tabs"
 *     permission needed because the manifest's content_scripts match
 *     <all_urls> grants host permissions for sendMessage to those tabs.
 *   - Per-origin filtering happens at the content-receiver tier (each tab
 *     decides whether targetOrigin matches its window.location.origin).
 *     The SW doesn't read tab URLs - that would require "tabs" permission
 *     and broaden the SW's privilege footprint unnecessarily.
 *   - Tabs without our content script (chrome://, about:blank, dev tools)
 *     reject sendMessage with "Could not establish connection" - we silently
 *     swallow these. Expected behavior, not a bug.
 *   - All sends fire in parallel via Promise.all so a slow tab doesn't
 *     block delivery to others.
 *
 * Deps-injection pattern matches the rest of the SW codebase (engine,
 * approval-flow, connection-state): the production factory wires
 * chrome.tabs.*; tests inject mocks. No chrome.* globals in the spec.
 */

import type { DappEventEnvelope, DappSwEventEnvelope } from '../types/dapp-messages.js';

export interface DappEventBus {
  /**
   * Broadcast an EIP-1193 event to all tabs with our content script. If
   * targetOrigin is provided, only tabs whose window.location.origin matches
   * deliver the event to inpage (filtering at the receiver tier per the
   * file header).
   */
  broadcast(envelope: DappEventEnvelope, targetOrigin?: string): Promise<void>;
}

export interface DappEventBusDeps {
  readonly tabsQuery: (info: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
  readonly tabsSendMessage: (tabId: number, message: unknown) => Promise<unknown>;
}

export function createDappEventBus(deps: DappEventBusDeps): DappEventBus {
  return {
    async broadcast(envelope: DappEventEnvelope, targetOrigin?: string): Promise<void> {
      const tabs = await deps.tabsQuery({});
      const swEvent: DappSwEventEnvelope = targetOrigin
        ? { type: 'DAPP_EVENT', envelope, targetOrigin }
        : { type: 'DAPP_EVENT', envelope };

      const sends: Promise<unknown>[] = [];
      for (const tab of tabs) {
        if (typeof tab.id !== 'number') continue;
        sends.push(
          deps.tabsSendMessage(tab.id, swEvent).catch(() => {
            // Tab has no WDK content script (chrome://, about:blank, etc.).
            // Silently swallow - this is expected for non-WDK tabs.
          }),
        );
      }
      await Promise.all(sends);
    },
  };
}

/**
 * Production factory wiring chrome.tabs APIs. Use this in background/index.ts;
 * tests should use createDappEventBus with injected deps.
 */
export function createBrowserDappEventBus(): DappEventBus {
  return createDappEventBus({
    tabsQuery: (info) => chrome.tabs.query(info),
    tabsSendMessage: (id, msg) => chrome.tabs.sendMessage(id, msg),
  });
}