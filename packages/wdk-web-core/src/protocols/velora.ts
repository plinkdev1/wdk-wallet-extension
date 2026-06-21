/**
 * Velora (ParaSwap) DEX-aggregator swap protocol (EVM) — runs INSIDE the worklet.
 *
 * Wraps @tetherto/wdk-protocol-swap-velora-evm so the worker can quote and
 * execute token swaps on a plain WalletAccountEvm over a public RPC (Velora's
 * aggregator API is public; no key required). The ERC-4337 gasless path is
 * supported by the same SDK once a bundler is configured (see ROADMAP).
 *
 * The wrapped account holds the key, so the protocol lives with the secrets in
 * the worklet and never crosses the trust boundary.
 */
import ParaSwapProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm';

export interface VeloraQuote {
  readonly fee: bigint;
  readonly tokenInAmount: bigint;
  readonly tokenOutAmount: bigint;
}

export interface VeloraSwapResult {
  readonly hash: string;
  readonly fee: bigint;
  readonly tokenInAmount: bigint;
  readonly tokenOutAmount: bigint;
  readonly approveHash?: string;
}

export interface VeloraSwapOptions {
  readonly tokenIn: string;
  readonly tokenOut: string;
  /** Exact input (sell) — mutually exclusive with tokenOutAmount. */
  readonly tokenInAmount?: bigint;
  /** Exact output (buy) — mutually exclusive with tokenInAmount. */
  readonly tokenOutAmount?: bigint;
}

interface ParaSwapLike {
  swap(o: VeloraSwapOptions, config?: Record<string, unknown>): Promise<Record<string, unknown>>;
  quoteSwap(o: VeloraSwapOptions): Promise<Record<string, unknown>>;
}

/** Constructs the swap protocol bound to a WDK EVM account (key stays in the worklet). */
export function createVeloraProtocol(account: unknown): ParaSwapLike {
  return new ParaSwapProtocolEvm(account as never) as unknown as ParaSwapLike;
}

function big(v: unknown): bigint {
  return typeof v === 'bigint' ? v : BigInt((v as string | number) ?? 0);
}

export function normalizeQuote(raw: Record<string, unknown>): VeloraQuote {
  return { fee: big(raw.fee), tokenInAmount: big(raw.tokenInAmount), tokenOutAmount: big(raw.tokenOutAmount) };
}

export function normalizeSwapResult(raw: Record<string, unknown>): VeloraSwapResult {
  return {
    hash: String(raw.hash ?? ''),
    fee: big(raw.fee),
    tokenInAmount: big(raw.tokenInAmount),
    tokenOutAmount: big(raw.tokenOutAmount),
    ...(raw.approveHash ? { approveHash: String(raw.approveHash) } : {}),
  };
}
