/**
 * Vitest test setup — registers IndexedDB globals via fake-indexeddb so vault
 * storage tests (and any future tests) can exercise IndexedDB without requiring
 * a real browser environment.
 *
 * Node 22's built-in globalThis.crypto.subtle provides WebCrypto natively
 * (PBKDF2, AES-GCM, etc.), so no extra polyfill is needed for the vault's
 * cryptographic operations.
 *
 * Configured via vitest.config.ts `setupFiles` - runs once before any test
 * file is loaded.
 */
import 'fake-indexeddb/auto';