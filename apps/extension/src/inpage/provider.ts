/**
 * WdkInpageProvider - the EIP-1193 provider object that becomes window.ethereum.
 *
 * Architecture:
 *   - `request({method, params})` -> generates uuid, posts DappRequestEnvelope
 *     via window.postMessage(envelope, '*'). Stores resolver in pending map.
 *   - 'message' event listener filters by data.source. Routes 'wdk-dapp-response'
 *     to pending request by id; routes 'wdk-dapp-event' to registered event
 *     listeners.
 *   - `on(event, listener)` / `removeListener(event, listener)` - standard
 *     EIP-1193 EventEmitter API for chainChanged / accountsChanged / connect /
 *     disconnect. Internal storage is a Map<event, Set<listener>>.
 *
 * Trust model: this code runs in the page's main world. The page can read and
 * tamper with this object. Security boundary is at the content script (which
 * runs in isolated world and stamps the verified origin onto each request
 * before forwarding to the SW). See S12.6.4.
 *
 * Per PRD 01 Addendum S12.6.4.
 */

import type { DappRequestEnvelope, DappResponseEnvelope, DappEventEnvelope } from '../types/dapp-messages.js';

/** EIP-1193 ProviderRpcError shape. Code follows EIP-1474 / EIP-1193 conventions. */
export class ProviderRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ProviderRpcError';
    this.code = code;
    this.data = data;
  }
}

export interface RequestArgs {
  readonly method: string;
  readonly params?: readonly unknown[];
}

type EventListener = (data: unknown) => void;
type PendingResolver = {
  readonly resolve: (value: unknown) => void;
  readonly reject: (reason: unknown) => void;
};

export class WdkInpageProvider {
  private readonly pending = new Map<string, PendingResolver>();
  private readonly listeners = new Map<string, Set<EventListener>>();
  /** Bound handler retained so it can be removed in destroy(). */
  private readonly boundMessageHandler: (event: MessageEvent) => void;

  constructor() {
    this.boundMessageHandler = (event: MessageEvent) => this.handleMessage(event);
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.boundMessageHandler);
    }
  }

  /**
   * EIP-1193 request method. Generates a unique id, posts the envelope to the
   * content script via window.postMessage, and returns a Promise that resolves
   * when the matching DappResponseEnvelope arrives.
   */
  public request = async (args: RequestArgs): Promise<unknown> => {
    if (!args || typeof args.method !== 'string') {
      throw new ProviderRpcError(-32602, 'Invalid request: { method, params? } required');
    }
    const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `wdk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const envelope: DappRequestEnvelope = {
      source: 'wdk-dapp-request',
      id,
      method: args.method,
      ...(args.params !== undefined ? { params: args.params } : {}),
    };
    const promise = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    window.postMessage(envelope, '*');
    return promise;
  };

  /** Register an event listener (EIP-1193 EventEmitter API). */
  public on = (event: string, listener: EventListener): this => {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  };

  /** Remove an event listener. Idempotent. */
  public removeListener = (event: string, listener: EventListener): this => {
    this.listeners.get(event)?.delete(listener);
    return this;
  };

  /** Tear down. Useful for tests. */
  public destroy = (): void => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.boundMessageHandler);
    }
    this.pending.clear();
    this.listeners.clear();
  };

  // --- internal ---

  private handleMessage(event: MessageEvent): void {
    const data = event.data as unknown;
    if (!data || typeof data !== 'object') return;
    const env = data as { source?: unknown };

    if (env.source === 'wdk-dapp-response') {
      this.handleResponse(data as DappResponseEnvelope);
    } else if (env.source === 'wdk-dapp-event') {
      this.handleEvent(data as DappEventEnvelope);
    }
    // 'wdk-dapp-request' (self-echo) and unknown sources: ignored
  }

  private handleResponse(env: DappResponseEnvelope): void {
    if (typeof env.id !== 'string') return;
    const pending = this.pending.get(env.id);
    if (!pending) return;
    this.pending.delete(env.id);
    if (env.error) {
      pending.reject(new ProviderRpcError(env.error.code, env.error.message));
    } else {
      pending.resolve(env.result);
    }
  }

  private handleEvent(env: DappEventEnvelope): void {
    if (typeof env.event !== 'string') return;
    const set = this.listeners.get(env.event);
    if (!set) return;
    for (const listener of set) {
      try { listener(env.data); } catch { /* swallow listener errors per EventEmitter convention */ }
    }
  }
}