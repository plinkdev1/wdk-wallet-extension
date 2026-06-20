/**
 * ERC-4337 smart-account (account abstraction) support — runs INSIDE the worklet.
 *
 * Wraps @tetherto/wdk-wallet-evm-erc-4337 so the worker can derive a smart-
 * account address and send gasless UserOperations (pay gas in an ERC-20 via a
 * paymaster, or have the smart account pay its own gas in native coin). This is
 * a *template* integration: the consuming app supplies its own **bundler** and
 * (optionally) **paymaster** URLs via configuration — nothing is hard-coded.
 *
 * The manager is constructed from the seed, so it lives in the worklet with the
 * other secrets and never crosses the trust boundary.
 */
import WalletManagerEvmErc4337 from '@tetherto/wdk-wallet-evm-erc-4337';

export interface Erc4337Config {
  /** ERC-4337 bundler RPC URL (required to send UserOperations). */
  readonly bundlerUrl: string;
  /** Optional paymaster URL (sponsorship / ERC-20 gas). */
  readonly paymasterUrl?: string;
}

export interface Erc4337SendResult {
  readonly hash: string;
  readonly fee: bigint;
}

interface SmartAccountLike {
  getAddress(): Promise<string>;
  getBalance(): Promise<bigint>;
  sendTransaction(tx: { to: string; value: bigint; data?: string }, config?: Record<string, unknown>): Promise<Record<string, unknown>>;
  quoteSendTransaction(tx: { to: string; value: bigint; data?: string }, config?: Record<string, unknown>): Promise<Record<string, unknown>>;
}

interface ManagerLike {
  getAccount(index?: number): Promise<SmartAccountLike>;
}

/** Builds the ERC-4337 wallet manager from the seed + app-supplied infra config. */
export function createErc4337Manager(mnemonic: string, providerUrl: string, config: Erc4337Config): ManagerLike {
  return new WalletManagerEvmErc4337(mnemonic, {
    provider: providerUrl,
    bundlerUrl: config.bundlerUrl,
    ...(config.paymasterUrl ? { paymasterUrl: config.paymasterUrl } : {}),
  } as never) as unknown as ManagerLike;
}

/**
 * Gas-payment config for a UserOperation: pay in an ERC-20 token (symbol) when
 * a paymaster is configured, otherwise the smart account pays its own gas in
 * native coin.
 */
export function gasConfig(paymasterToken?: string): Record<string, unknown> {
  return paymasterToken ? { paymasterToken } : { useNativeCoins: true };
}

function big(v: unknown): bigint {
  return typeof v === 'bigint' ? v : BigInt((v as string | number) ?? 0);
}

export function normalizeErc4337Result(raw: Record<string, unknown>): Erc4337SendResult {
  return { hash: String(raw.hash ?? ''), fee: big(raw.fee) };
}
