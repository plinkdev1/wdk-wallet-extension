import { describe, it, expect } from 'vitest';

describe('polyfill-globals (side-effect module)', () => {
  it('imports cleanly and assigns Buffer + process + global onto globalThis', async () => {
    // Side-effect import. ES module evaluation order guarantees the module
    // body runs before this expect() executes. In Node, Buffer and process
    // are already globals from the runtime; the polyfill module overwrites
    // them with the npm 'buffer' / 'process' polyfill exports, which is the
    // behavior we want in real browser/MV3 SW environments where the Node
    // globals are absent.
    await import('./polyfill-globals.js');

    expect(globalThis).toHaveProperty('Buffer');
    expect(globalThis).toHaveProperty('process');
    expect((globalThis as { global?: unknown }).global).toBe(globalThis);

    // Spot-check the polyfill assignments are usable surfaces
    expect(
      typeof (globalThis as { Buffer?: { from: unknown } }).Buffer?.from
    ).toBe('function');
    expect(
      (globalThis as { process?: { env: unknown } }).process?.env
    ).toBeDefined();
  });
});