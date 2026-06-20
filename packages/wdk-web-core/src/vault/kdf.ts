/**
 * KDF helpers for the WebCryptoVault.
 *
 * Architectural constraints (LOCKED per ADR-008):
 * - PBKDF2-SHA256 @ 600k iterations (OWASP 2023 recommendation)
 * - AES-GCM @ 256-bit key, 96-bit IV
 *
 * Phase 0 Test 04 validation: PBKDF2-SHA256 @ 600k completes in ~100ms on
 * Chrome with hardware-accelerated WebCrypto (F-WEBCRYPTO-01), linearity
 * verified at ~1.99x ratio (600k vs 1.2M, proving iterations are honored).
 *
 * Updating KDF_PARAMS.iterations in the future requires a vault migration
 * path (re-derive with old iterations to decrypt, encrypt with new iterations
 * for new blob). The blob format stores the iterations used at write time,
 * so old blobs remain decryptable after a parameter bump.
 *
 * See: ADR-008, PRD 02 Addendum 6, M1 v2 Appendix A Test 04.
 */

export const KDF_PARAMS = {
  algorithm: 'PBKDF2',
  iterations: 600_000,
  hash: 'SHA-256',
} as const;

export const DERIVED_KEY_PARAMS = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
} as const;

/**
 * Derives an AES-GCM CryptoKey from password + salt via PBKDF2.
 *
 * @param password - UTF-8 encoded internally.
 * @param salt - Per-vault random salt (typically 16 bytes / 128 bits).
 * @param iterations - PBKDF2 iteration count. Defaults to KDF_PARAMS.iterations.
 *   Pass the iterations stored in the vault blob when decrypting, to support
 *   future migrations.
 * @returns Non-extractable CryptoKey usable with crypto.subtle.encrypt/decrypt.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = KDF_PARAMS.iterations,
): Promise<CryptoKey> {
  const passwordBytes = new TextEncoder().encode(password);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: KDF_PARAMS.hash,
    },
    passwordKey,
    {
      name: DERIVED_KEY_PARAMS.algorithm,
      length: DERIVED_KEY_PARAMS.keyLength,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Measures wall-clock time of a single PBKDF2 derivation at current KDF_PARAMS.
 *
 * Used by UI clients to decide whether to show an "unlocking..." spinner.
 * Per ADR-008 F-WEBCRYPTO-01: Chrome's hardware-accelerated PBKDF2 completes
 * 600k iterations in ~100ms; an unconditional spinner feels noisy on most
 * user devices. Phase 1 UX uses adaptive thresholding (typically >300ms shows
 * the spinner, <300ms does not).
 */
export async function measureKdfTime(
  password: string = 'measure-only',
  saltSize: number = 16,
): Promise<{ readonly iterations: number; readonly durationMs: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(saltSize));
  const start = performance.now();
  await deriveKey(password, salt);
  const durationMs = performance.now() - start;
  return { iterations: KDF_PARAMS.iterations, durationMs };
}