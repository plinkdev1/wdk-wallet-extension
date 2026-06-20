/**
 * useApprovalQueue - fetches pending approvals on mount.
 *
 * Flow on mount (and on refresh()):
 *   1. send({ type: 'APPROVAL_LIST_PENDING' }) -> string[]
 *   2. If empty -> state: 'empty'
 *   3. If non-empty -> send({ type: 'APPROVAL_GET_PENDING', id: ids[0] })
 *   4. -> state: 'pending' with the ApprovalRequest details
 *   5. Race: if request resolved between LIST and GET (returns null), treat as empty
 *
 * One-shot poll, no setInterval. refresh() bumps an internal key to re-run
 * the effect; called by ApprovalView after APPROVAL_RESPOND so the popup
 * shows the next queued approval (or routes to MainView when queue drains).
 *
 * Why not push-based: B4.5b ships before the SW pushes approval events.
 * Polling is added in B4.6+ if the popup-open-while-second-approval-arrives
 * pattern proves a problem. For now: popup opens -> shows current state ->
 * user decides -> refreshes -> shows next (if any).
 */

import { useEffect, useState } from 'react';
import { send } from '../lib/sw-client.js';
import type { ApprovalRequest } from '../../background/approval-flow.js';

export type ApprovalQueueState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'pending'; request: ApprovalRequest }
  | { status: 'error'; error: string };

export interface UseApprovalQueueResult {
  state: ApprovalQueueState;
  /** Re-fetch the queue. Call after APPROVAL_RESPOND. */
  refresh: () => void;
}

export function useApprovalQueue(): UseApprovalQueueResult {
  const [state, setState] = useState<ApprovalQueueState>({ status: 'loading' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      try {
        const ids = await send({ type: 'APPROVAL_LIST_PENDING' });
        if (cancelled) return;
        if (ids.length === 0) {
          setState({ status: 'empty' });
          return;
        }
        const first = ids[0];
        if (!first) {
          setState({ status: 'empty' });
          return;
        }
        const request = await send({ type: 'APPROVAL_GET_PENDING', id: first });
        if (cancelled) return;
        if (!request) {
          // Race: approval was resolved between LIST_PENDING and GET_PENDING.
          // Treat as empty - caller can refresh to re-check.
          setState({ status: 'empty' });
          return;
        }
        setState({ status: 'pending', request });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return {
    state,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}