/**
 * Unit tests for the token-bucket RateLimiter: burst passes immediately, the
 * sustained rate throttles, and ordering is preserved — all deterministic via
 * injected now/sleep.
 */
import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('lets a burst through immediately, then throttles to rps', async () => {
    let t = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter({
      rps: 10, burst: 2,
      now: () => t,
      sleep: async (ms) => { waits.push(ms); t += ms; },
    });

    const order: number[] = [];
    await limiter.schedule(async () => { order.push(1); }); // token 2 -> 1
    await limiter.schedule(async () => { order.push(2); }); // token 1 -> 0
    await limiter.schedule(async () => { order.push(3); }); // empty -> wait 1 token @10rps = 100ms

    expect(order).toEqual([1, 2, 3]);
    expect(waits).toEqual([100]); // only the 3rd call waited
  });

  it('refills over time so later calls do not wait', async () => {
    let t = 0;
    const waits: number[] = [];
    const limiter = new RateLimiter({ rps: 10, burst: 1, now: () => t, sleep: async (ms) => { waits.push(ms); t += ms; } });

    await limiter.schedule(async () => {}); // consume the 1 token
    t += 200; // 200ms passes → 2 tokens refilled (capped at burst=1)
    await limiter.schedule(async () => {}); // token available, no wait

    expect(waits).toEqual([]); // neither call slept
  });

  it('returns the wrapped function result and rejects bad rps', async () => {
    const limiter = new RateLimiter({ rps: 100 });
    expect(await limiter.schedule(async () => 42)).toBe(42);
    expect(() => new RateLimiter({ rps: 0 })).toThrow();
  });
});
