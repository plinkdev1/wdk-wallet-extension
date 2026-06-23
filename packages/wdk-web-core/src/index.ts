/**
 * @wdk-starter/wdk-web-core
 *
 * Framework-agnostic engine powering WDK browser wallet products
 * (Next.js Template + Browser Extension).
 *
 * Phase 1 carryover of the Phase 0 prototype. The deep-import surface
 * (./types, ./polyfill-globals, ./vault, ./chains, ./worker,
 * ./adapters/relayer) is the canonical consumer entry per PRD 02
 * Addendum 2.4; this barrel re-export exists for ergonomics when callers
 * want everything in one import.
 */

export * from './types/index.js';
export * from './vault/index.js';
export * from './chains/index.js';
export * from './eip3009/index.js';
export * from './worker/index.js';
export * from './adapters/index.js';
export * from './payments/index.js';
export * from './design';
export * from './storage';
