/**
 * Typed wrapper around chrome.runtime.sendMessage for popup -> SW communication.
 *
 * Maps WalletMessage type literal to its corresponding WalletResponseData entry
 * so callers get full TS inference:
 *
 *   const ids = await send({ type: 'APPROVAL_LIST_PENDING' });
 *   //    ^? string[]
 *
 *   const req = await send({ type: 'APPROVAL_GET_PENDING', id: 'r1' });
 *   //    ^? ApprovalRequest | null
 *
 * Throws Error(response.error) when SW returns { ok: false }. Callers can
 * try/catch to handle EIP-1474 / SW-internal errors per their UI needs.
 *
 * The chrome.runtime.sendMessage call is only made when send() is called,
 * not at module init - safe to import in tests without stubbing chrome.
 */

import type {
  WalletMessage,
  WalletResponse,
  WalletResponseData,
} from '../../types/messages.js';

export async function send<M extends WalletMessage>(
  message: M,
): Promise<WalletResponseData[M['type']]> {
  const response = (await chrome.runtime.sendMessage(message)) as WalletResponse<
    WalletResponseData[M['type']]
  >;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}