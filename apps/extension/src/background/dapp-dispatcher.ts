/**
 * EIP-1193 method dispatcher for the dApp pipeline.
 *
 * SECURITY: F-SEC-01 INNER TIER - we whitelist method names via Object.hasOwn,
 * NOT the `in` operator. Same Object.prototype-pollution risk as the outer
 * dispatcher in dispatch.ts (PING/VAULT_LOAD/DAPP_REQUEST level); see
 * PRD 01 Addendum S12.6.3 + S12.6.5 for the two-tier rationale.
 *
 * The inner tier guards EIP-1193 METHOD names (eth_chainId, eth_requestAccounts,
 * personal_sign, ...) - one level deeper than the outer tier's message TYPE
 * whitelist (DAPP_REQUEST, APPROVAL_GET_PENDING, ...).
 *
 * Throws plain `{ code: -32601, message }` for unknown methods per EIP-1193's
 * error spec. The DAPP_REQUEST handler in handlers.ts converts thrown errors
 * to `{ error: { code, message } }` shape for the outer envelope.
 */

import type { Eip1193Method, Eip1193Request, Eip1193ResultValue } from '../types/dapp-messages.js';

/** Per-request context. Includes verified origin from the content bridge. */
export interface Eip1193Context {
  /** Origin verified by the content bridge - inpage script cannot spoof. */
  readonly origin: string;
  /** DAPP_REQUEST envelope id - threads through to approval-flow id (B4.6+). */
  readonly id?: string;
}

export type Eip1193Handler = (
  request: Eip1193Request,
  context: Eip1193Context,
) => Promise<Eip1193ResultValue>;

export type Eip1193HandlerRegistry = Partial<Record<Eip1193Method, Eip1193Handler>>;

export function createDappDispatcher(handlers: Eip1193HandlerRegistry) {
  return async function dispatch(request: Eip1193Request, context: Eip1193Context): Promise<Eip1193ResultValue> {
    const method = request.method;
    if (typeof method !== 'string') {
      throw { code: -32600, message: 'Invalid request: method must be a string' };
    }
    // F-SEC-01 inner tier: Object.hasOwn, NOT `in`. Critical security boundary.
    if (!Object.hasOwn(handlers, method)) {
      throw { code: -32601, message: `Method not supported: ${method}` };
    }
    const handler = handlers[method as Eip1193Method];
    if (!handler) {
      throw { code: -32601, message: `Method not supported: ${method}` };
    }
    return handler(request, context);
  };
}