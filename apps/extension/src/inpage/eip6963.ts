/**
 * EIP-6963 multi-provider discovery for the WDK inpage script.
 *
 * Two events:
 *   - 'eip6963:announceProvider' (we dispatch) - announces our provider to dApps
 *   - 'eip6963:requestProvider' (we listen) - dApps request all wallets to re-announce
 *
 * Per EIP-6963: wallet announces immediately on script load AND re-announces
 * when the dApp explicitly requests. This handles both load-orders (wallet
 * loads first vs dApp loads first).
 *
 * UUID: in production this MUST be the per-wallet-install UUID stored in
 * chrome.storage.local. Inpage cannot access chrome.storage, so the content
 * script will inject the real UUID at B4.2 (via document.currentScript.dataset
 * or via a window.postMessage init handshake). For B4.1 the caller passes
 * whatever it has; placeholder until B4.2.
 *
 * Per PRD 01 Addendum S12.6.4.
 */

import type { Eip6963ProviderDetail } from '../types/dapp-messages.js';

// 1x1 transparent PNG. Replaced by the real WDK icon in B4.2 (content script
// will inject the data URI from chrome.runtime.getURL('icons/icon-128.png')).
export const WDK_ICON_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Announce a provider per EIP-6963. Dispatches once immediately, then listens
 * for re-announce requests from dApps.
 *
 * @param provider The EIP-1193 provider instance (WdkInpageProvider).
 * @param uuid The per-wallet-install UUID. See module header.
 * @param icon Optional icon data URI. Defaults to WDK_ICON_PLACEHOLDER.
 * @returns A cleanup function that removes the request listener.
 */
export function announceEip6963Provider(
  provider: unknown,
  uuid: string,
  icon: string = WDK_ICON_PLACEHOLDER
): () => void {
  const detail: Eip6963ProviderDetail = {
    info: {
      uuid,
      name: 'WDK Wallet',
      icon,
      rdns: 'app.wdkstarter.wallet',
    },
    provider,
  };

  const dispatch = (): void => {
    if (typeof window === 'undefined') return;
    // Freeze the detail per EIP-6963 recommendation - prevents dApps from mutating
    // wallet identity in-place. Frozen separately each dispatch so a dApp mutating
    // one announce's detail can't poison subsequent announces.
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ ...detail, info: Object.freeze({ ...detail.info }) }),
    }));
  };

  // Announce immediately for dApps that loaded before us.
  dispatch();

  // Re-announce on request for dApps that load after us.
  if (typeof window !== 'undefined') {
    window.addEventListener('eip6963:requestProvider', dispatch);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('eip6963:requestProvider', dispatch);
    }
  };
}