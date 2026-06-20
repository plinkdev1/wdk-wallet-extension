import { describe, it, expect } from 'vitest';
import { mnemonicToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
import {
  buildEip3009TransferAuthorization,
  assertEip3009TxDataFits,
  MAX_TX_DATA,
} from './builder.js';

// Phase 1 test mnemonic. Same one used across cross-impl parity checks.
// Address derives to 0xD9022E95DD4BfEFBeCe17AD19d6b044C5b082359 at m/44'/60'/0'/0/0.
const TEST_MNEMONIC =
  'real fury scan various trend network reward review will fiscal miracle unfair';

// USDC mainnet token metadata - canonical EIP-3009 fixture.
const USDC_TOKEN = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
  name: 'USD Coin',
  version: '2',
};

describe('eip3009/builder', () => {
  it('builds a TypedDataPayload with the expected EIP-712 structure', () => {
    const payload = buildEip3009TransferAuthorization({
      token: USDC_TOKEN,
      chainId: 1,
      from: '0xD9022E95DD4BfEFBeCe17AD19d6b044C5b082359',
      to: '0x0000000000000000000000000000000000000001',
      value: 1000000n,
      validBefore: 1893456000n,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });

    expect(payload.primaryType).toBe('TransferWithAuthorization');
    expect(payload.domain.name).toBe('USD Coin');
    expect(payload.domain.version).toBe('2');
    expect(payload.domain.chainId).toBe(1);
    expect(payload.domain.verifyingContract).toBe(USDC_TOKEN.address);
    expect(payload.types.TransferWithAuthorization).toHaveLength(6);
    // validAfter defaults to 0n when omitted from params.
    expect(payload.message.validAfter).toBe(0n);
    expect(payload.message.value).toBe(1000000n);
  });

  it('builds typed-data that viem signs identically to a hand-written equivalent', async () => {
    const account = mnemonicToAccount(TEST_MNEMONIC);

    const commonMessage = {
      from: account.address,
      to: '0x0000000000000000000000000000000000000001' as const,
      value: 1000000n,
      validAfter: 0n,
      validBefore: 1893456000n,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    };

    // Sign via the builder output.
    const builderPayload = buildEip3009TransferAuthorization({
      token: USDC_TOKEN,
      chainId: 1,
      ...commonMessage,
    });
    const sigFromBuilder = await account.signTypedData(builderPayload as never);

    // Sign the same shape constructed inline by hand.
    const sigDirect = await account.signTypedData({
      domain: {
        name: USDC_TOKEN.name,
        version: USDC_TOKEN.version,
        chainId: 1,
        verifyingContract: USDC_TOKEN.address,
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      },
      primaryType: 'TransferWithAuthorization',
      message: commonMessage,
    });

    // If the builder produced wrong typed data, signatures diverge.
    expect(sigFromBuilder).toBe(sigDirect);
  });

  it('assertEip3009TxDataFits accepts calldata at and below the boundary', () => {
    expect(() => assertEip3009TxDataFits('a'.repeat(MAX_TX_DATA))).not.toThrow();
    expect(() => assertEip3009TxDataFits('a'.repeat(MAX_TX_DATA - 1))).not.toThrow();
    expect(() => assertEip3009TxDataFits('')).not.toThrow();
  });

  it('assertEip3009TxDataFits rejects calldata over the boundary with RangeError + F-EIP3009-01 reference', () => {
    expect(() => assertEip3009TxDataFits('a'.repeat(MAX_TX_DATA + 1))).toThrow(RangeError);
    expect(() => assertEip3009TxDataFits('a'.repeat(MAX_TX_DATA + 1))).toThrow(/F-EIP3009-01/);
  });
});