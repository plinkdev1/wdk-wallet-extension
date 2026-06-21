/**
 * Side panel wiring (Phase C).
 *
 * The wallet's full popup app is also exposed as a Chrome side panel
 * (`src/sidepanel/index.html`, which reuses `popup/app`). Unlike the popup —
 * which Chrome closes whenever it loses focus — a side panel stays open while
 * the user browses, so they can watch balances, activity, and approvals
 * alongside a dApp without the wallet disappearing on every click.
 *
 * We keep the toolbar click opening the popup (the default), and add a
 * right-click "Open WDK Wallet in side panel" item on the extension's action
 * icon. `chrome.sidePanel.open()` requires a user gesture; the context-menu
 * click satisfies it.
 *
 * Requires the `sidePanel` (Chrome 114+) and `contextMenus` permissions. All
 * listeners register synchronously at module load (F-MV3-01).
 */

const CONTEXT_MENU_ID = 'wdk-open-side-panel';

/** Registers the side-panel context menu + open handler. Safe no-op pre-Chrome-114. */
export function registerSidePanel(): void {
  if (!chrome.sidePanel) {
    // Chrome < 114: side panel API unavailable. The popup stays the only surface.
    return;
  }

  // Keep the toolbar click opening the popup (explicit — this is also the default).
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err) => {
    console.error('[bg] sidePanel.setPanelBehavior failed:', err);
  });

  // (Re)create the action context-menu item on install/update. Creating it on
  // every SW wake would throw "duplicate id", so it lives in onInstalled.
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create(
      { id: CONTEXT_MENU_ID, title: 'Open WDK Wallet in side panel', contexts: ['action'] },
      () => void chrome.runtime.lastError, // swallow benign "duplicate id" on reinstall
    );
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    const windowId = tab?.windowId;
    if (windowId === undefined) return;
    chrome.sidePanel.open({ windowId }).catch((err) => {
      console.error('[bg] sidePanel.open failed:', err);
    });
  });
}
