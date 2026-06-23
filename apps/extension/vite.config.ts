/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import manifest from './manifest.config.js';

/**
 * Vite + Vitest config for the extension.
 *
 * - nodePolyfills: Buffer/process/stream/util shims for WDK's Node dependencies
 *   running in MV3 service worker context (F-MV3-01 / F-MV3-02 mitigations).
 * - @vitejs/plugin-react: B4.5a addition - JSX transform for popup React app.
 *   React is a runtime dep, not a test-only dep; the plugin runs at build time.
 * - crx: bundles manifest.config.ts entries (background SW, popup HTML, content
 *   scripts, web-accessible inpage).
 *
 * Test config (B4.5a addition):
 * - environment: jsdom for DOM-touching tests (popup React tests). Background
 *   tests are environment-agnostic and still pass. Single environment beats
 *   per-file @vitest-environment hints for simplicity.
 * - setupFiles: vitest.setup.ts registers @testing-library/jest-dom matchers
 *   and afterEach(cleanup) to prevent test bleed.
 * - globals: false matches existing test style (explicit describe/it/expect
 *   imports).
 */
export default defineConfig({
  envDir: '../../',
  envPrefix: ['VITE_', 'WDK_', 'PLASMA_'],
  plugins: [
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    react(),
    crx({ manifest }),
  ],
  build: {
    target: 'es2022',
    // Production sourcemaps are off on purpose. @web3icons/react/dynamic
    // lazy-loads the full ~4000-icon catalog as one chunk per icon, and emitting
    // a sourcemap for each (2000+ .map files, all held in memory while Rollup
    // renders) is what pushed the production build past the default heap limit
    // ("JavaScript heap out of memory"). A shipped extension doesn't need them.
    // The build script also raises the heap ceiling as a safety margin. If you
    // need to debug the bundle, flip this to true and give the build more memory.
    sourcemap: false,
  },
  test: {
    // Default environment is 'node'. Popup tests opt into jsdom via per-file
    // /** @vitest-environment jsdom */ docblock (L-EXT-02). Globally switching to
    // jsdom breaks Uint8Array instanceof checks in background tests because Node's
    // TextEncoder returns a Uint8Array from a different realm than globalThis.Uint8Array.
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
    // @web3icons (bundled in wdk-ui) lazy-loads each icon via dynamic import.
    // When a popup view that renders icons (e.g. the settings ChainSelector) is
    // unmounted at test teardown, those imports can still resolve a tick later and
    // call React setState against an already-torn-down jsdom `window`, surfacing as
    // post-teardown "Unhandled Rejection: window is not defined". Every assertion
    // (412 tests) passes; this only ignores those late third-party teardown
    // rejections so the run is deterministic. Real test failures still fail the run.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});