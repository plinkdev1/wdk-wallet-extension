/**
 * EIP-3009 typed-data builder.
 *
 * `buildEip3009TransferAuthorization` constructs an EIP-712 payload ready
 * for signing (via viem signTypedData, account.signTypedData, or any other
 * EIP-712 signer). The output is a TypedDataPayload (defined in
 * ../types/index.ts) with domain, types, primaryType, and message populated.
 *
 * MAX_TX_DATA: per F-EIP3009-01 (Phase 0 empirical finding), the Plasma
 * relayer rejects transaction calldata over 3000 characters. This constant
 * is exposed for downstream code (the relayer adapter, Step 8) to enforce
 * at submission time. The builder itself does NOT enforce, because its
 * output is the typed-data payload (what gets signed), not the encoded
 * calldata (what the relayer submits). Cleaner separation of concerns.
 *
 * See: ADR-010 (relayer flow), F-EIP3009-01.
 */

import type { Address, Hex } from 'viem';
import type { TypedDataPayload } from '../types/index.js';
import { TRANSFER_WITH_AUTHORIZATION_TYPE } from './types.js';

/**
 * Per F-EIP3009-01: the Plasma relayer rejects calldata over this length.
 * Apply via `assertEip3009TxDataFits` at the relayer-submission boundary.
 */
export const MAX_TX_DATA = 3000;

export interface BuildEip3009TransferParams {
  /** Token contract metadata used in the EIP-712 domain. */
  readonly token: {
    readonly address: Address;
    readonly name: string;
    readonly version: string;
  };
  /** EVM chain ID (1 for Ethereum mainnet, 9745 for Plasma, etc.). */
  readonly chainId: number;
  /** Authorization sender (must match the recovered signer). */
  readonly from: Address;
  /** Authorization recipient. */
  readonly to: Address;
  /** Token amount in base units (uint256). */
  readonly value: bigint;
  /** Unix timestamp - auth invalid before this. Defaults to 0n (immediate). */
  readonly validAfter?: bigint;
  /** Unix timestamp - auth invalid at or after this. */
  readonly validBefore: bigint;
  /** 32-byte hex nonce, prevents replay. */
  readonly nonce: Hex;
}

/**
 * Build the EIP-712 typed-data payload for an ERC-3009
 * `transferWithAuthorization` signature request.
 *
 * The returned payload is structurally compatible with viem signTypedData
 * and any other EIP-712 signer. To sign:
 *
 *     const payload = buildEip3009TransferAuthorization(params);
 *     const signature = await account.signTypedData(payload);
 */
export function buildEip3009TransferAuthorization(
  params: BuildEip3009TransferParams,
): TypedDataPayload {
  return {
    domain: {
      name: params.token.name,
      version: params.token.version,
      chainId: params.chainId,
      verifyingContract: params.token.address,
    },
    types: {
      TransferWithAuthorization: [...TRANSFER_WITH_AUTHORIZATION_TYPE],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter ?? 0n,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
  };
}

/**
 * Asserts that encoded transaction calldata fits within the relayer
 * 3000-char limit (F-EIP3009-01). Throws RangeError if exceeded.
 *
 * Use at the relayer-submission boundary, not at signing time. The builder
 * itself does not call this because the typed-data payload (what gets
 * signed) is not the same as the calldata (what the relayer submits).
 */
export function assertEip3009TxDataFits(calldata: string): void {
  if (calldata.length > MAX_TX_DATA) {
    throw new RangeError(
      'EIP-3009 calldata exceeds MAX_TX_DATA (' +
        MAX_TX_DATA +
        ' chars): got ' +
        calldata.length +
        ' chars. See F-EIP3009-01.',
    );
  }
}