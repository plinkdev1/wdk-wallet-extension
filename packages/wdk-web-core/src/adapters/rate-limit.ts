/**
 * Token-bucket rate limiter for RPC calls (BACKLOG B-7).
 *
 * Free-tier RPC endpoints throttle aggressively (429). With concurrent reads
 * (e.g. getTokenBalances, B-5) a burst can trip that limit. `withRetry` (B-6)
 * recovers reactively; this limiter prevents it proactively by capping the rate
 * at which calls start. Token-bucket semantics allow short bursts up to `burst`
 * then settle to `rps`.
 *
 * Dependency-free; `now`/`sleep` are injectable so it's deterministic in tests.
 * Acquisition is serialized so concurrent callers can't double-spend a token.
 */
export interface RateLimiterOptions {
  /** Sustained rate: tokens refilled per second. */
  readonly rps: number
  /** Bucket capacity (max burst). Default ceil(rps). */
  readonly burst?: number
  /** Injectable monotonic clock in ms (tests). Default Date.now. */
  readonly now?: () => number
  /** Injectable sleep (tests). Default setTimeout. */
  readonly sleep?: (ms: number) => Promise<void>
}

export class RateLimiter {
  readonly #rps: number
  readonly #burst: number
  readonly #now: () => number
  readonly #sleep: (ms: number) => Promise<void>
  #tokens: number
  #last: number
  /** Serializes token acquisition so concurrent schedule() calls queue fairly. */
  #tail: Promise<void> = Promise.resolve()

  constructor (opts: RateLimiterOptions) {
    if (!(opts.rps > 0) || !isFinite(opts.rps)) throw new Error('RateLimiter: rps must be a positive finite number')
    this.#rps = opts.rps
    this.#burst = Math.max(1, Math.floor(opts.burst ?? Math.ceil(opts.rps)))
    this.#now = opts.now ?? (() => Date.now())
    this.#sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.#tokens = this.#burst
    this.#last = this.#now()
  }

  async #acquire (): Promise<void> {
    const prev = this.#tail
    let release!: () => void
    this.#tail = new Promise<void>((r) => { release = r })
    await prev
    try {
      for (;;) {
        const t = this.#now()
        this.#tokens = Math.min(this.#burst, this.#tokens + ((t - this.#last) * this.#rps) / 1000)
        this.#last = t
        if (this.#tokens >= 1) {
          this.#tokens -= 1
          return
        }
        const waitMs = Math.ceil(((1 - this.#tokens) / this.#rps) * 1000)
        await this.#sleep(waitMs)
      }
    } finally {
      release()
    }
  }

  /** Acquire a token (waiting if necessary), then run `fn`. */
  async schedule<T> (fn: () => Promise<T>): Promise<T> {
    await this.#acquire()
    return fn()
  }
}
