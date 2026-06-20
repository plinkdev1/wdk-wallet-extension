/**
 * SW-side approval flow state.
 *
 * Holds pending approval requests keyed by id. Each entry stores the Promise
 * resolver functions; the popup (B4.5) drives resolution by calling
 * APPROVAL_RESPOND, which routes to ApprovalFlow.respond(id, decision).
 *
 * Pattern: per-method handler in dapp-handlers.ts (real impls land B4.5+)
 * calls `await approvalFlow.open({ id, origin, method, params })` and awaits
 * the user's decision. While the Promise is pending, the popup queries
 * APPROVAL_GET_PENDING(id) to render the request details and offer
 * Approve/Reject buttons. On click, popup sends APPROVAL_RESPOND which
 * resolves the Promise, the handler returns the appropriate EIP-1193
 * response, and the transport pipeline delivers it back to the dApp.
 *
 * No persistence: pendingApprovals is in-memory only. MV3 SW terminations
 * lose pending state, but dApps see the corresponding sendMessage Promises
 * reject with port-closed errors so the failure is observable. Approvals
 * are short-lived (seconds) so persistence would add complexity for marginal
 * value. The dApp can simply retry.
 *
 * Per PRD 01 Addendum S12.6.2 (approval popup <-> SW handshake).
 */

export interface ApprovalRequest {
  /** Matches DAPP_REQUEST envelope id - threads through the whole pipeline. */
  readonly id: string;
  /** Content-script-verified origin. */
  readonly origin: string;
  /** EIP-1193 method that triggered this approval (eth_requestAccounts, etc.). */
  readonly method: string;
  /** Original EIP-1193 params (passthrough; popup renders per-method). */
  readonly params?: readonly unknown[];
  /** Wall-clock ms timestamp for "X seconds ago" display + debug. */
  readonly createdAt: number;
}

export interface ApprovalDecision {
  readonly approved: boolean;
  /**
   * Optional decision payload. Per-method semantics in B4.5+:
   *   - eth_requestAccounts: selected account addresses (string[])
   *   - eth_sendTransaction: edited transaction fields (Partial<EvmTransactionRequest>)
   *   - personal_sign / eth_signTypedData_v4: typically no data (just approve/reject)
   */
  readonly data?: unknown;
}

interface PendingEntry {
  readonly request: ApprovalRequest;
  readonly resolve: (decision: ApprovalDecision) => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * Auto-open the wallet popup on an incoming approval request (Phantom/MetaMask
 * UX parity). Wrapped in defensive checks because chrome.action.openPopup can
 * fail in several runtime contexts (no focused window, Chrome <127, missing
 * permissions, etc.) and we should never let UX wiring kill the approval flow.
 * Falls back to badging the action icon so the user has a visual cue.
 */
function tryOpenPopupForApproval(): void {
  try {
    if (
      typeof chrome !== 'undefined' &&
      chrome.action &&
      typeof chrome.action.openPopup === 'function'
    ) {
      const result = chrome.action.openPopup();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(() => { tryBadge('!'); });
      }
    } else {
      tryBadge('!');
    }
  } catch {
    tryBadge('!');
  }
}

/**
 * Set or clear the action badge as a fallback / cleared-on-resolution signal.
 * '' clears the badge; any other text shows it with the WDK accent color.
 */
function tryBadge(text: string): void {
  try {
    if (typeof chrome === 'undefined' || !chrome.action) return;
    const setText = chrome.action.setBadgeText;
    if (typeof setText === 'function') {
      const r = setText({ text });
      if (r && typeof (r as Promise<unknown>).catch === 'function') {
        (r as Promise<unknown>).catch(() => { /* swallow */ });
      }
    }
    if (text) {
      const setColor = chrome.action.setBadgeBackgroundColor;
      if (typeof setColor === 'function') {
        const r2 = setColor({ color: '#F4642F' });
        if (r2 && typeof (r2 as Promise<unknown>).catch === 'function') {
          (r2 as Promise<unknown>).catch(() => { /* swallow */ });
        }
      }
    }
  } catch { /* swallow - badge is a nice-to-have, never block the flow */ }
}

export class ApprovalFlow {
  private readonly pending = new Map<string, PendingEntry>();

  /**
   * Open a new approval flow. Returns a Promise resolved when the popup calls
   * APPROVAL_RESPOND for the matching id, or rejected via cancel()/cancelAll().
   *
   * Throws synchronously if id is empty or already pending (caller bug).
   */
  public open(request: Omit<ApprovalRequest, 'createdAt'>): Promise<ApprovalDecision> {
    if (!request.id || typeof request.id !== 'string') {
      throw new Error('ApprovalFlow.open: id must be a non-empty string');
    }
    if (this.pending.has(request.id)) {
      throw new Error(`ApprovalFlow.open: id ${request.id} already pending`);
    }
    const fullRequest: ApprovalRequest = { ...request, createdAt: Date.now() };
    const promise = new Promise<ApprovalDecision>((resolve, reject) => {
      this.pending.set(request.id, { request: fullRequest, resolve, reject });
    });
    // B5.X5: auto-open the popup so the user sees the request without
    // manually clicking the extension icon. Falls back to a badge on failure.
    tryOpenPopupForApproval();
    return promise;
  }

  /**
   * Get a pending request by id. Returns null if not pending.
   * Used by the APPROVAL_GET_PENDING handler to feed the popup UI.
   */
  public getPending(id: string): ApprovalRequest | null {
    return this.pending.get(id)?.request ?? null;
  }

  /** List all currently-pending request ids. */
  public listPending(): string[] {
    return Array.from(this.pending.keys());
  }

  /**
   * Respond to a pending approval - resolves the open() Promise with the
   * decision. Returns true if the id matched a pending entry, false otherwise.
   * Used by the APPROVAL_RESPOND handler driven by the popup.
   */
  public respond(id: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.resolve(decision);
    if (this.pending.size === 0) tryBadge('');
    return true;
  }

  /**
   * Cancel a pending approval - rejects the open() Promise with reason.
   * Used when the popup closes without a decision, or on explicit timeout.
   * Returns true if the id matched a pending entry.
   */
  public cancel(id: string, reason: string = 'User cancelled approval'): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    entry.reject(new Error(reason));
    if (this.pending.size === 0) tryBadge('');
    return true;
  }

  /**
   * Cancel ALL pending approvals. Used on bulk SW lifecycle events
   * (engine.lock(), wallet reset, etc.). The SW termination itself doesn't
   * need to call this - the JS context dying loses everything anyway - but
   * explicit lock-time cancellation is helpful for clean state in long-lived
   * tests + edge cases.
   */
  public cancelAll(reason: string = 'Service worker reset'): void {
    for (const entry of this.pending.values()) {
      entry.reject(new Error(reason));
    }
    this.pending.clear();
    tryBadge('');
  }
}

/** Factory matches engine.ts createEngine() pattern. */
export function createApprovalFlow(): ApprovalFlow {
  return new ApprovalFlow();
}