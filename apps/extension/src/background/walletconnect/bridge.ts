/**
 * WalletConnect v2 bridge (Phase 5).
 *
 * A WalletConnect `session_request` is just an EIP-1193 call from a remote dApp —
 * so it routes through the SAME request handler the injected provider uses (the
 * dApp dispatcher), gets the SAME approval prompt, and is recorded as the SAME
 * kind of per-origin connection. This bridge is the glue: it turns the WC
 * client's events into router calls + responses, with zero duplication of the
 * signing/approval logic.
 *
 * It imports no `@walletconnect/*` SDK: the client is a narrow interface the
 * integrator implements over `@walletconnect/sign-client` (and `router` is the
 * existing `createDappDispatcher`). Pure and unit-tested; the live relay wiring
 * is the only piece that needs network to exercise end-to-end.
 */

/** A WC session proposal (subset we read). */
export interface WcSessionProposal {
  readonly id: number | string;
  readonly proposer?: { readonly metadata?: { readonly name?: string; readonly url?: string } };
  readonly requiredNamespaces?: unknown;
  readonly optionalNamespaces?: unknown;
}

/** A WC session request (a method call over an established session). */
export interface WcSessionRequest {
  readonly topic: string;
  readonly id: number | string;
  readonly params: {
    readonly request: { readonly method: string; readonly params?: unknown };
    readonly chainId?: string;
  };
}

/** The narrow surface of `@walletconnect/sign-client` the bridge drives. */
export interface WalletConnectClient {
  approveSession(args: { id: number | string; namespaces: unknown }): Promise<{ topic: string }>;
  rejectSession(args: { id: number | string; reason: { code: number; message: string } }): Promise<void>;
  respondSessionRequest(args: {
    topic: string;
    response: { id: number | string; result?: unknown; error?: { code: number; message: string } };
  }): Promise<void>;
  on(event: 'session_proposal', cb: (p: WcSessionProposal) => void): void;
  on(event: 'session_request', cb: (r: WcSessionRequest) => void): void;
}

/** Routes a method → result (the existing EIP-1193 dApp dispatcher). Throws
 * `{ code, message }` on error, exactly like the dispatcher. */
export type WcRequestRouter = (
  req: { method: string; params?: readonly unknown[] },
  ctx: { origin: string; id: string },
) => Promise<unknown>;

/** A decision for a session proposal — approve with namespaces, or reject. */
export interface WcProposalDecision {
  readonly approved: boolean;
  /** The CAIP-25 namespaces to grant (required when approved). */
  readonly namespaces?: unknown;
}

export interface WalletConnectBridgeDeps {
  readonly client: WalletConnectClient;
  /** Route a request — wire to `createDappDispatcher`. */
  readonly router: WcRequestRouter;
  /** Decide a proposal — wire to the approval flow + namespace building. */
  readonly approveProposal: (proposal: WcSessionProposal) => Promise<WcProposalDecision>;
  /** Origin string for a request's session (default `wc:<topic>`). Used for the
   * router ctx + connection allow-list. */
  readonly originForTopic?: (topic: string) => string;
}

export interface WalletConnectBridge {
  handleProposal(proposal: WcSessionProposal): Promise<void>;
  handleRequest(request: WcSessionRequest): Promise<void>;
  /** Wire the client's events to the handlers (call once after pairing setup). */
  start(): void;
}

function asArray(params: unknown): readonly unknown[] {
  if (Array.isArray(params)) return params;
  if (params === undefined || params === null) return [];
  return [params];
}

function toRpcError(err: unknown): { code: number; message: string } {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const e = err as { code: unknown; message: unknown };
    if (typeof e.code === 'number' && typeof e.message === 'string') return { code: e.code, message: e.message };
  }
  return { code: -32603, message: err instanceof Error ? err.message : String(err) };
}

export function createWalletConnectBridge(deps: WalletConnectBridgeDeps): WalletConnectBridge {
  const originForTopic = deps.originForTopic ?? ((topic: string) => `wc:${topic}`);

  const bridge: WalletConnectBridge = {
    async handleProposal(proposal) {
      let decision: WcProposalDecision;
      try {
        decision = await deps.approveProposal(proposal);
      } catch {
        decision = { approved: false };
      }
      if (decision.approved && decision.namespaces !== undefined) {
        await deps.client.approveSession({ id: proposal.id, namespaces: decision.namespaces });
      } else {
        await deps.client.rejectSession({ id: proposal.id, reason: { code: 5000, message: 'User rejected' } });
      }
    },

    async handleRequest(request) {
      const { topic, id } = request;
      const method = request.params?.request?.method;
      const params = asArray(request.params?.request?.params);
      const origin = originForTopic(topic);

      if (typeof method !== 'string') {
        await deps.client.respondSessionRequest({ topic, response: { id, error: { code: -32600, message: 'Invalid request' } } });
        return;
      }
      try {
        const result = await deps.router({ method, params }, { origin, id: String(id) });
        await deps.client.respondSessionRequest({ topic, response: { id, result } });
      } catch (err) {
        await deps.client.respondSessionRequest({ topic, response: { id, error: toRpcError(err) } });
      }
    },

    start() {
      deps.client.on('session_proposal', (p) => { void bridge.handleProposal(p); });
      deps.client.on('session_request', (r) => { void bridge.handleRequest(r); });
    },
  };

  return bridge;
}
