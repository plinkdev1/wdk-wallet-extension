/**
 * Integration smoke test - Step 11 of kickoff Part V, final foundation step.
 *
 * Per Master Agent decision (Session 02 review): mock-only smoke test exercising
 * the full v0.1.0 public surface end-to-end. Real-RPC + real-relayer integration
 * testing belongs in product-level CI, not the foundation package.
 *
 * Stages and what each validates:
 *
 *   1.  WebCryptoVault round-trip (store / hasStored / load / byte-match decode)
 *   2.  WalletWorker construction with injected vault and mock RPC adapter
 *   3.  vault_load side-effect-inits WDK per ADR-010 implicit-unlock contract
 *   4.  account_getEvmAddress on plasma-mainnet at accountIndex 0 matches the
 *       known Phase 1 test address byte-for-byte. This is the regression guard.
 *       If derivation drifts, polyfill regresses, WDK upgrade breaks BIP-44
 *       path, or the m/44/60/0/0/0 invariant (ADR-009) is violated in any way,
 *       this assertion fails loudly.
 *   5.  account_signMessage produces a 132-char (65-byte) ECDSA signature.
 *   6.  buildEip3009TransferAuthorization builds an EIP-712 payload from
 *       ERC-3009 transferWithAuthorization params (note nested token object
 *       shape: { address, name, version }).
 *   7.  account_signTypedData over that payload produces another 132-char sig.
 *   8.  Signature is split to v/r/s and used to encode transferWithAuthorization
 *       calldata via viem.encodeFunctionData. This is what the relayer would
 *       actually submit on-chain - the real product flow, not a fixture.
 *   9.  F-EIP3009-01 invariant: calldata is under MAX_TX_DATA=3000 characters.
 *  10.  Mock RelayerAdapter.submit returns the configured fixedTxHash,
 *       validating Step 7 wiring against a real signed payload.
 *  11.  RPC adapter delegation: rpc_getBalance returns the mock-configured
 *       value, validating Step 9 wiring against the live worker boundary.
 *  12.  Cleanup: vault_clear leaves hasStored returning false.
 *
 * Phase 1 test mnemonic (distinct from Phase 0 per kickoff handover section 10
 * mnemonic hygiene): "real fury scan various trend network reward review will
 * fiscal miracle unfair" derives 0xD9022E95DD4BfEFBeCe17AD19d6b044C5b082359
 * at m/44/60/0/0/0 (the ADR-009 standard BIP-44 path).
 *
 * The mnemonic is hardcoded as a test constant rather than read from env.
 * This is a deterministic regression test for derivation, not a credential-
 * protection scenario. The test mnemonic is not a secret. Hardcoding makes
 * the test self-contained: clone repo, pnpm install, pnpm test, see the
 * regression guard fire if anything in the derivation stack regresses.
 *
 * After this test lands, wdk-web-core is at v0.1.0 acceptance per kickoff
 * Part V acceptance criteria.
 */

import { describe, it, expect } from 'vitest';
import { encodeFunctionData, type Address, type Hex } from 'viem';
import './polyfill-globals.js';
import { WalletWorker } from './worker/index.js';
import { createWebCryptoVault } from './vault/index.js';
import { createMockRpcAdapter, createMockRelayerAdapter } from './adapters/index.js';
import { buildEip3009TransferAuthorization } from './eip3009/index.js';

const PHASE_1_TEST_MNEMONIC =
  'real fury scan various trend network reward review will fiscal miracle unfair';
const PHASE_1_TEST_EVM_ADDRESS =
  '0xD9022E95DD4BfEFBeCe17AD19d6b044C5b082359' as Address;
const TEST_PASSWORD = 'integration-smoke-test-password';

// transferWithAuthorization function ABI - used to encode the relayer
// calldata from the typed-data payload and the signed authorization v/r/s
// split. Standard ERC-3009 signature, used by USDC, USDT, USDT0, etc.
const TRANSFER_WITH_AUTHORIZATION_FUNCTION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const;

describe('wdk-web-core integration smoke test (Step 11 - kickoff Part V final foundation step)', () => {
  it(
    'full v0.1.0 surface round-trip: vault / worker / derive / sign / encode / relayer / rpc / clear',
    async () => {
      // -------------------------------------------------------------------
      // Stage 1: WebCryptoVault round-trip
      // -------------------------------------------------------------------
      const vault = createWebCryptoVault();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      await vault.store(TEST_PASSWORD, encoder.encode(PHASE_1_TEST_MNEMONIC));
      const loadedBytes = await vault.load(TEST_PASSWORD);
      expect(decoder.decode(loadedBytes)).toBe(PHASE_1_TEST_MNEMONIC);

      // -------------------------------------------------------------------
      // Stage 2: Adapter setup - everything external is mocked
      // -------------------------------------------------------------------
      const rpcAdapter = createMockRpcAdapter({
        balances: new Map([
          [
            'plasma-mainnet:' + PHASE_1_TEST_EVM_ADDRESS,
            1_000_000_000_000_000_000n,
          ],
        ]),
      });

      const expectedTxHash = ('0x' + 'aa'.repeat(32)) as Hex;
      const relayerAdapter = createMockRelayerAdapter({
        fixedTxHash: expectedTxHash,
      });

      // -------------------------------------------------------------------
      // Stage 3: WalletWorker construction and unlock
      // -------------------------------------------------------------------
      const worker = new WalletWorker({ vault, rpcAdapter });
      await worker.vault_load(TEST_PASSWORD);

      // -------------------------------------------------------------------
      // Stage 4: EVM address derivation - the REGRESSION GUARD
      // -------------------------------------------------------------------
      const evmAddress = await worker.account_getEvmAddress('plasma-mainnet', 0);
      expect(evmAddress.toLowerCase()).toBe(PHASE_1_TEST_EVM_ADDRESS.toLowerCase());
      expect(evmAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // -------------------------------------------------------------------
      // Stage 5: Message signing
      // -------------------------------------------------------------------
      const messageSig = await worker.account_signMessage(
        'plasma-mainnet',
        0,
        'integration-smoke-test',
      );
      expect(messageSig).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // -------------------------------------------------------------------
      // Stage 6: EIP-3009 typed-data build (nested token shape)
      // -------------------------------------------------------------------
      const validAfter = 0n;
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const nonce = ('0x' + '01'.repeat(32)) as Hex;
      const tokenAddress =
        '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address;
      const recipient =
        '0x0000000000000000000000000000000000000001' as Address;
      const value = 100_000n;
      const plasmaChainId = 9745;

      const typedData = buildEip3009TransferAuthorization({
        token: {
          address: tokenAddress,
          name: 'Tether USD',
          version: '1',
        },
        chainId: plasmaChainId,
        from: evmAddress as Address,
        to: recipient,
        value,
        validAfter,
        validBefore,
        nonce,
      });

      // -------------------------------------------------------------------
      // Stage 7: Sign the typed data
      // -------------------------------------------------------------------
      const eip712Sig = await worker.account_signTypedData(
        'plasma-mainnet',
        0,
        typedData,
      );
      expect(eip712Sig).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // -------------------------------------------------------------------
      // Stage 8: Split signature to v/r/s and encode calldata
      // -------------------------------------------------------------------
      const sigHex = eip712Sig.slice(2);
      const r = ('0x' + sigHex.slice(0, 64)) as Hex;
      const s = ('0x' + sigHex.slice(64, 128)) as Hex;
      const v = parseInt(sigHex.slice(128, 130), 16);
      expect(v === 27 || v === 28).toBe(true);

      const calldata = encodeFunctionData({
        abi: TRANSFER_WITH_AUTHORIZATION_FUNCTION_ABI,
        functionName: 'transferWithAuthorization',
        args: [
          evmAddress as Address,
          recipient,
          value,
          validAfter,
          validBefore,
          nonce,
          v,
          r,
          s,
        ],
      });
      expect(calldata).toMatch(/^0x[a-fA-F0-9]+$/);

      // -------------------------------------------------------------------
      // Stage 9: F-EIP3009-01 invariant - calldata fits Plasma relayer window
      // -------------------------------------------------------------------
      expect(calldata.length).toBeLessThan(3000);

      // -------------------------------------------------------------------
      // Stage 10: Submit calldata through the mock relayer
      // -------------------------------------------------------------------
      const submission = await relayerAdapter.submit({
        chainId: plasmaChainId,
        to: tokenAddress,
        calldata,
      });
      expect(submission.txHash).toBe(expectedTxHash);

      // -------------------------------------------------------------------
      // Stage 11: RPC balance lookup delegates to the injected adapter
      // -------------------------------------------------------------------
      const balance = await worker.rpc_getBalance(
        'plasma-mainnet',
        PHASE_1_TEST_EVM_ADDRESS,
      );
      expect(balance).toBe(1_000_000_000_000_000_000n);

      // -------------------------------------------------------------------
      // Stage 12: Cleanup
      // -------------------------------------------------------------------
      await worker.vault_clear();
      expect(await worker.vault_hasStored()).toBe(false);
    },
    30_000,
  );
});