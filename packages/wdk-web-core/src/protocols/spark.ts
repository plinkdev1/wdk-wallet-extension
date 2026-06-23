/**
 * Spark / Lightning — on-demand wallet manager (Phase 2; findings F-SPARK-*).
 *
 * Spark is wired like a protocol, NOT a chain-registry entry:
 *  - It is constructed on demand from the retained mnemonic — the SDK derives
 *    accounts over the network (there is no offline address, F-SPARK-02), the
 *    same shape the ERC-4337 smart-account manager uses.
 *  - It is lazy-loaded via dynamic `import()` so the ~6.4 MB Spark SDK never
 *    enters the default bundle (F-SPARK-03). On a Web-Worker host (the Next.js
 *    template — the validated path) the bundler splits it into its own chunk.
 *    On the MV3 service worker, dynamic `import()` is forbidden (F-MV3-04), so
 *    the import throws and the caller surfaces a clear "needs the MV3 bundler
 *    shim" error until that app-level work lands (see ROADMAP and the
 *    spark-browser-validation harness).
 *
 * The manager/account are reached through narrow local interfaces and a single
 * boundary cast — the same F-WDK-04 pattern the rest of the worker uses for WDK
 * accounts — so this module does not couple wdk-web-core's types to the Spark
 * SDK's (and its @noble/hashes v2) type graph.
 */

/** Spark networks accepted by the SDK (`NetworkType`). */
export type SparkNetwork = 'MAINNET' | 'REGTEST' | 'TESTNET' | 'SIGNET' | 'LOCAL';

export interface SparkManagerConfig {
  /** Network (default `'MAINNET'`). */
  readonly network?: SparkNetwork;
  /** Optional SparkScan REST config — the browser-friendly balance path (F-SPARK-04). */
  readonly sparkscan?: Record<string, unknown>;
}

/** Narrow view of `WalletAccountSpark` — the subset the worker uses. */
export interface SparkAccountLike {
  getAddress(): Promise<string>;
  getBalance(): Promise<bigint>;
  sendTransaction(tx: { to: string; value: bigint }): Promise<unknown>;
  createLightningInvoice(options: {
    amountSats: number;
    memo?: string;
    expirySeconds?: number;
  }): Promise<unknown>;
  payLightningInvoice(options: { invoice: string; maxFeeSats: number }): Promise<unknown>;
}

/** Narrow view of `WalletManagerSpark`. */
export interface SparkManagerLike {
  getAccount(index?: number): Promise<SparkAccountLike>;
}

type SparkManagerCtor = new (seed: string, config?: SparkManagerConfig) => SparkManagerLike;

const IMPORT_ERROR =
  'Spark SDK could not be loaded. On the MV3 service worker, dynamic import() is forbidden ' +
  '(F-MV3-04) and Spark needs the MV3 bundler shim (see ROADMAP); on a Web-Worker host it ' +
  'loads lazily as its own chunk.';

/**
 * Lazily loads the Spark SDK and constructs a manager bound to `mnemonic`.
 * Throws a descriptive error if the SDK cannot be dynamically imported (MV3).
 */
export async function createSparkManager(
  mnemonic: string,
  config: SparkManagerConfig = {},
): Promise<SparkManagerLike> {
  let mod: { default: SparkManagerCtor };
  try {
    // Spark is a real engine dependency that coexists with @tetherto/wdk-wallet-btc:
    // the workspace pins BTC to @noble/hashes v1 via pnpm.packageExtensions while
    // the Spark SDK keeps v2 (see spark-browser-validation/NOBLE-HASHES-V1-V2-CONFLICT.md).
    // A *literal* dynamic import keeps the ~6.4 MB SDK in its own lazy chunk
    // (F-SPARK-03) while letting the bundler statically split it. On an MV3 service
    // worker, runtime dynamic import() may still be unavailable — the catch below
    // surfaces a clear error there (the template / Web-Worker path is unaffected).
    mod = (await import('@tetherto/wdk-wallet-spark')) as unknown as { default: SparkManagerCtor };
  } catch (cause) {
    throw new Error(IMPORT_ERROR, { cause });
  }
  const Manager = mod.default;
  return new Manager(mnemonic, {
    network: config.network ?? 'MAINNET',
    ...(config.sparkscan ? { sparkscan: config.sparkscan } : {}),
  });
}

/**
 * Extracts the BOLT11 string (`encodedInvoice`) from a `createLightningInvoice`
 * result (`LightningReceiveRequest`), tolerating either a nested `invoice`
 * object or a flat shape.
 */
export function extractBolt11(receiveRequest: unknown): string {
  const r = receiveRequest as {
    invoice?: { encodedInvoice?: unknown };
    encodedInvoice?: unknown;
  };
  const encoded = r?.invoice?.encodedInvoice ?? r?.encodedInvoice;
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Spark createLightningInvoice: response carried no encodedInvoice (BOLT11)');
  }
  return encoded;
}

/**
 * Normalizes a Spark `sendTransaction` / `TransactionResult` to its hash string,
 * matching how the other chains' send methods unwrap their result.
 */
export function normalizeSparkTxHash(result: unknown): string {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'hash' in result) {
    const hash = (result as { hash?: unknown }).hash;
    if (typeof hash === 'string') return hash;
  }
  throw new Error('Spark sendTransaction: unexpected result shape (no hash)');
}

/**
 * Extracts the request id from a `payLightningInvoice` result
 * (`LightningSendRequest`) — the returned payment handle.
 */
export function normalizeLightningSendId(result: unknown): string {
  if (result && typeof result === 'object' && 'id' in result) {
    const id = (result as { id?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  throw new Error('Spark payLightningInvoice: response carried no request id');
}
