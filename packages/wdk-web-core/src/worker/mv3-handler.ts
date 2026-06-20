/**
 * @wdk-starter/wdk-web-core/worker/mv3-handler
 *
 * Raw chrome.runtime message dispatch for the Browser Extension MV3 SW
 * context. Per F-MV3-01 (ADR-011), Comlink does NOT work in MV3 service
 * workers because Comlink.expose defers listener registration to a
 * microtask, which Chrome treats as too late (MV3 requires synchronous
 * listener registration on script load, before any await/yield).
 *
 * This module is the workaround: a synchronous installMv3MessageHandler
 * that registers chrome.runtime.onMessage.addListener immediately, and a
 * pure handleMv3Request that does the actual dispatch (testable without
 * a chrome runtime).
 *
 * Envelope shapes (MV3Request, MV3Response, MV3ErrorResponse) are from
 * src/types/messages.ts, declared verbatim per ADR-011 in Step 1.
 *
 * Consumer pattern (Browser Extension background.ts):
 *
 *   import '@wdk-starter/wdk-web-core/polyfill-globals';
 *   import { WalletWorker, installMv3MessageHandler } from '@wdk-starter/wdk-web-core/worker';
 *
 *   const worker = new WalletWorker();
 *   installMv3MessageHandler(worker, chrome.runtime);
 */

import type {
  MV3Request,
  MV3Response,
  MV3ErrorResponse,
  WalletWorkerApi,
} from '../types/index.js';
import type { WalletWorker } from './wallet-worker.js';

/**
 * Minimal Chrome onMessage listener signature - the subset of
 * @types/chrome's `chrome.runtime.onMessage.addListener` callback that we
 * actually exercise. We avoid depending on @types/chrome to keep
 * wdk-web-core platform-agnostic; products choose chrome typings or
 * polyfills at their layer.
 */
export type ChromeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

/** Minimal shape of chrome.runtime we need for handler registration. */
export interface ChromeRuntimeMessageHook {
  readonly onMessage: {
    addListener(listener: ChromeMessageListener): void;
  };
}

/**
 * Whitelist of WalletWorkerApi method names the MV3 dispatcher will
 * invoke. Acts as a security boundary - prevents crafted MV3 messages
 * from invoking inherited Object.prototype methods (toString, constructor,
 * etc.) on the worker.
 *
 * Typed as Record<keyof WalletWorkerApi, true> so adding a method to
 * WalletWorkerApi forces a typecheck error here until the new key is
 * added below - bidirectional enforcement.
 */
const ALLOWED_METHODS = {
  vault_hasStored: true,
  vault_store: true,
  vault_load: true,
  vault_clear: true,
  account_getEvmAddress: true,
  account_getSolanaAddress: true,
  account_signMessage: true,
  account_signTypedData: true,
  account_signSolanaMessage: true,
  rpc_getBalance: true,
  rpc_getTokenBalance: true,
  rpc_getTransactionStatus: true,
  pricing_getUsdPrice: true,
  account_sendTransaction: true,
  account_sendSolanaTransaction: true,
  account_getBtcAddress: true,
  account_getBtcBalance: true,
  account_sendBtcTransaction: true,
  account_getTonAddress: true,
  account_getTonBalance: true,
  account_sendTonTransaction: true,
  account_getTronAddress: true,
  account_getTronBalance: true,
  account_sendTronTransaction: true,
  bip39_generateMnemonic: true,
  bip39_validateMnemonic: true,
} as const satisfies Record<keyof WalletWorkerApi, true>;

/**
 * Structural validator for incoming messages. Anything that does not
 * look like an MV3Request envelope is rejected so other extension
 * listeners (if any) can claim the message.
 */
export function isValidMv3Request(message: unknown): message is MV3Request {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as { method?: unknown; args?: unknown; requestId?: unknown };
  return (
    typeof m.method === 'string' &&
    typeof m.requestId === 'string' &&
    Array.isArray(m.args)
  );
}

/**
 * Dispatches a single MV3Request to the WalletWorker and wraps the
 * result (or any thrown error) in the appropriate response envelope.
 * Pure async function - does not touch chrome.runtime; testable.
 *
 * Method name is checked against ALLOWED_METHODS (the security
 * boundary). Errors thrown by the worker method itself surface as
 * MV3ErrorResponse with the original error.name preserved (so e.g.
 * F-VAULT-01 OperationError on wrong password reaches the client
 * with name === 'OperationError').
 */
export async function handleMv3Request(
  worker: WalletWorker,
  request: MV3Request,
): Promise<MV3Response | MV3ErrorResponse> {
  try {
    if (!Object.hasOwn(ALLOWED_METHODS, request.method)) {
      throw new Error('Method not allowed in MV3 dispatch: ' + request.method);
    }
    const workerAny = worker as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const fn = workerAny[request.method];
    if (typeof fn !== 'function') {
      throw new Error('Method not implemented on worker: ' + request.method);
    }
    const result = await fn.apply(worker, request.args);
    return {
      requestId: request.requestId,
      ok: true,
      result: result as never,
    };
  } catch (err) {
    const e = err as Error;
    return {
      requestId: request.requestId,
      ok: false,
      error: {
        name: e.name ?? 'Error',
        message: e.message ?? String(e),
      },
    };
  }
}

/**
 * Registers the MV3 message handler synchronously on the given runtime.
 *
 * MUST be called synchronously at SW startup, immediately after
 * polyfill-globals import, before any await/yield. Chrome MV3 service
 * workers drop async listener registrations - see F-MV3-01 (ADR-011)
 * for the failure mode this avoids.
 *
 * Listener returns true synchronously for valid MV3 envelopes (signals
 * to Chrome that an async response will arrive via sendResponse) and
 * false for non-MV3 messages (leaves them for other listeners).
 */
export function installMv3MessageHandler(
  worker: WalletWorker,
  runtime: ChromeRuntimeMessageHook,
): void {
  runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isValidMv3Request(message)) {
      return false;
    }
    handleMv3Request(worker, message)
      .then(sendResponse)
      .catch((err: unknown) => {
        // Defensive: handleMv3Request catches internally. If something
        // really weird happens (broken worker reference, etc.), surface
        // a final error envelope so the client does not hang.
        const e = err as Error;
        const fallback: MV3ErrorResponse = {
          requestId: message.requestId,
          ok: false,
          error: {
            name: e.name ?? 'Error',
            message: e.message ?? String(e),
          },
        };
        sendResponse(fallback);
      });
    return true;
  });
}