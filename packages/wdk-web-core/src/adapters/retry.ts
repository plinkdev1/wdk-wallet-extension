/**
 * Retry-with-backoff for RPC reads (BACKLOG B-6).
 *
 * Public RPC endpoints have transient failures (502/timeout) and free tiers
 * throttle (429). A single network blip should not surface as a failed balance.
 * `withRetry` wraps an idempotent async call with bounded exponential backoff +
 * jitter. It is deliberately tiny and dependency-free; `sleep` is injectable so
 * tests are deterministic.
 *
 * Only use this for **idempotent** operations (reads). Never wrap a transaction
 * broadcast — a retry could double-submit.
 */
export interface RetryOptions {
  /** Total attempts (including the first). Default 3. */
  readonly attempts?: number
  /** First backoff in ms; doubles each retry. Default 200. */
  readonly baseDelayMs?: number
  /** Backoff cap in ms. Default 2000. */
  readonly maxDelayMs?: number
  /** Apply ±50% jitter to each delay (avoids thundering herd). Default true. */
  readonly jitter?: boolean
  /** Decide whether a given error is retryable. Default: always retry. */
  readonly shouldRetry?: (err: unknown, attempt: number) => boolean
  /** Injectable sleep (tests). Default setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>
}

const DEFAULT_SLEEP = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Run `fn`, retrying on failure with exponential backoff. Resolves with the
 * first success; rejects with the last error once attempts are exhausted (or
 * `shouldRetry` returns false).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.floor(opts.attempts ?? 3))
  const base = opts.baseDelayMs ?? 200
  const max = opts.maxDelayMs ?? 2000
  const jitter = opts.jitter ?? true
  const shouldRetry = opts.shouldRetry ?? (() => true)
  const sleep = opts.sleep ?? DEFAULT_SLEEP

  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt >= attempts || !shouldRetry(err, attempt)) break
      const backoff = Math.min(max, base * 2 ** (attempt - 1))
      const delay = jitter ? Math.round(backoff * (0.5 + Math.random() * 0.5)) : backoff
      await sleep(delay)
    }
  }
  throw lastErr
}
