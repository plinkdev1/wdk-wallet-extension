/**
 * USDT0 cross-chain bridge protocol (EVM, LayerZero OFT) — runs INSIDE the worklet.
 *
 * Wraps @tetherto/wdk-protocol-bridge-usdt0-evm so the worker can quote and
 * execute USDT0 bridge transfers on a plain WalletAccountEvm over a public RPC.
 * The bridge requires an ERC-20 approve to the source-chain OFT contract before
 * bridging; the worker performs that on the same keyed account.
 *
 * Key stays in the worklet — the protocol lives with the secrets.
 */
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm';

export interface Usdt0BridgeOptions {
  readonly targetChain: string;
  readonly recipient: string;
  readonly token: string;
  readonly amount: bigint;
  readonly oftContractAddress: string;
}

export interface Usdt0Quote {
  readonly fee: bigint;
}

export interface Usdt0BridgeResult {
  readonly hash: string;
  readonly fee: bigint;
  readonly approveHash?: string;
}

interface Usdt0Like {
  bridge(o: Usdt0BridgeOptions, config?: Record<string, unknown>): Promise<Record<string, unknown>>;
  quoteBridge(o: Usdt0BridgeOptions): Promise<Record<string, unknown>>;
}

/** Account shape we rely on for the pre-bridge approve. */
export interface ApprovableEvmAccount {
  approve(o: { token: string; spender: string; amount: bigint }, config?: Record<string, unknown>): Promise<{ hash?: string } | string | void>;
}

/** Constructs the USDT0 bridge bound to a WDK EVM account (key stays in the worklet). */
export function createUsdt0Protocol(account: unknown): Usdt0Like {
  return new Usdt0ProtocolEvm(account as never) as unknown as Usdt0Like;
}

function big(v: unknown): bigint {
  return typeof v === 'bigint' ? v : BigInt((v as string | number) ?? 0);
}

export function normalizeUsdt0Quote(raw: Record<string, unknown>): Usdt0Quote {
  return { fee: big(raw.fee ?? raw.nativeFee) };
}

export function normalizeUsdt0Result(raw: Record<string, unknown>, approveHash?: string): Usdt0BridgeResult {
  return {
    hash: String(raw.hash ?? ''),
    fee: big(raw.fee ?? raw.nativeFee),
    ...(approveHash ? { approveHash } : {}),
  };
}
