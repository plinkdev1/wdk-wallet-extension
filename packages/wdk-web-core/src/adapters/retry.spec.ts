/**
 * Unit tests for withRetry: success-after-failure, attempt cap, shouldRetry
 * gating, and backoff via an injected (deterministic) sleep.
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry.js';

const noSleep = (): Promise<void> => Promise.resolve();

describe('withRetry', () => {
  it('returns immediately on first success (no sleep)', async () => {
    const sleep = vi.fn(noSleep);
    const fn = vi.fn(async () => 42);
    expect(await withRetry(fn, { sleep })).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries then succeeds', async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw new Error('flaky');
      return 'ok';
    });
    expect(await withRetry(fn, { attempts: 3, sleep: noSleep })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error once attempts are exhausted', async () => {
    const fn = vi.fn(async () => { throw new Error('down'); });
    await expect(withRetry(fn, { attempts: 3, sleep: noSleep })).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry returns false', async () => {
    const fn = vi.fn(async () => { throw new Error('400 bad request'); });
    await expect(withRetry(fn, { attempts: 5, sleep: noSleep, shouldRetry: () => false })).rejects.toThrow('400');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('backs off with growing, capped delays', async () => {
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => { delays.push(ms); return Promise.resolve(); };
    const fn = vi.fn(async () => { throw new Error('x'); });
    await expect(withRetry(fn, { attempts: 4, baseDelayMs: 100, maxDelayMs: 250, jitter: false, sleep })).rejects.toThrow();
    // 100, 200, capped 250 (no sleep after the final failed attempt)
    expect(delays).toEqual([100, 200, 250]);
  });
});
