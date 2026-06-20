/**
 * EIP-3009 EIP-712 type schemas.
 *
 * EIP-3009 (Transfer With Authorization) adds gasless transfer methods to
 * ERC-20 tokens. The user signs an off-chain authorization (no gas) and a
 * relayer submits the on-chain call (paying gas). USDC and other major
 * stablecoins implement this.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-3009
 */

import type { TypedDataParameter } from 'viem';

/**
 * The TransferWithAuthorization EIP-712 type. Used by the
 * `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)`
 * ERC-3009 function. Field order matters - EIP-712 hashing depends on it.
 */
export const TRANSFER_WITH_AUTHORIZATION_TYPE: readonly TypedDataParameter[] = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const;