/**
 * Aave V3 lending protocol wrapper (EVM) — runs INSIDE the worklet.
 *
 * Wraps @tetherto/wdk-protocol-lending-aave-evm so the worker can supply,
 * withdraw, borrow, and repay against Aave V3 pools using a plain WDK
 * WalletAccountEvm over a public RPC — no bundler/paymaster required. The
 * smart-account (ERC-4337) path is supported by the same SDK once a bundler is
 * configured (see ROADMAP "infrastructure-gated" notes).
 *
 * The account this wraps holds the private key, so the protocol never crosses
 * the trust boundary — it lives with the secrets, in the worklet.
 */
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';

/** Aave V3 user-account snapshot. USD-base values use Aave's 8-decimal base. */
export interface AaveAccountData {
  readonly totalCollateralBase: bigint;
  readonly totalDebtBase: bigint;
  readonly availableBorrowsBase: bigint;
  readonly currentLiquidationThreshold: bigint;
  readonly ltv: bigint;
  readonly healthFactor: bigint;
}

/** Result of a state-changing Aave action. */
export interface AaveActionResult {
  readonly hash: string;
  readonly fee: bigint;
  /** Present on plain EVM accounts when an ERC-20 approve was needed (e.g. USDT). */
  readonly approveHash?: string;
  readonly resetAllowanceHash?: string;
}

export type AaveAction = 'supply' | 'withdraw' | 'borrow' | 'repay';

type Cfg = Record<string, unknown> | undefined;
interface AaveLike {
  supply(o: { token: string; amount: bigint }, config?: Cfg): Promise<unknown>;
  withdraw(o: { token: string; amount: bigint }, config?: Cfg): Promise<unknown>;
  borrow(o: { token: string; amount: bigint }, config?: Cfg): Promise<unknown>;
  repay(o: { token: string; amount: bigint }, config?: Cfg): Promise<unknown>;
  quoteSupply(o: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
  quoteWithdraw(o: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
  quoteBorrow(o: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
  quoteRepay(o: { token: string; amount: bigint }): Promise<{ fee: bigint }>;
  getAccountData(): Promise<Record<string, unknown>>;
}

/** Constructs the Aave protocol bound to a WDK EVM account (key stays in the worklet). */
export function createAaveProtocol(account: unknown): AaveLike {
  return new AaveProtocolEvm(account as never) as unknown as AaveLike;
}

/** Normalises the SDK's action return into a plain, Comlink-cloneable shape. */
export function normalizeActionResult(raw: unknown): AaveActionResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hash: String(r.hash ?? ''),
    fee: typeof r.fee === 'bigint' ? r.fee : BigInt((r.fee as string | number) ?? 0),
    ...(r.approveHash ? { approveHash: String(r.approveHash) } : {}),
    ...(r.resetAllowanceHash ? { resetAllowanceHash: String(r.resetAllowanceHash) } : {}),
  };
}

/** Normalises getAccountData() into bigints. */
export function normalizeAccountData(raw: Record<string, unknown>): AaveAccountData {
  const big = (k: string): bigint => {
    const v = raw[k];
    return typeof v === 'bigint' ? v : BigInt((v as string | number) ?? 0);
  };
  return {
    totalCollateralBase: big('totalCollateralBase'),
    totalDebtBase: big('totalDebtBase'),
    availableBorrowsBase: big('availableBorrowsBase'),
    currentLiquidationThreshold: big('currentLiquidationThreshold'),
    ltv: big('ltv'),
    healthFactor: big('healthFactor'),
  };
}
