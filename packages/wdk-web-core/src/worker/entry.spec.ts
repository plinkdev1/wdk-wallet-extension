import { describe, it, expect } from 'vitest';

describe('worker/entry (Step 6c — Comlink bootstrap)', () => {
  it('imports cleanly in non-worker contexts (Comlink.expose is guarded by self.postMessage check)', async () => {
    // In the vitest Node env, globalThis.postMessage is undefined, so the
    // guard inside entry.ts skips Comlink.expose - the module should still
    // import without throwing.
    const mod = await import('./entry.js');
    expect(mod).toBeTruthy();
  }, 30000); // dynamic-importing the full worker tree (Comlink + WDK) is slow; generous timeout avoids a flaky trip of the 5s default under parallel CI load
});