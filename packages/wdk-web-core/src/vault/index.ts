/**
 * @wdk-starter/wdk-web-core/vault
 *
 * WebCryptoVault - password-derived AES-GCM encryption of arbitrary byte
 * payloads (typically the user's BIP-39 mnemonic), with IndexedDB persistence.
 *
 * Architectural constraints (LOCKED):
 * - PBKDF2-SHA256 @ 600k iterations (KDF_PARAMS, per OWASP 2023)
 * - AES-GCM @ 256-bit key, 96-bit IV (DERIVED_KEY_PARAMS)
 * - Per-vault random salt (16 bytes)
 * - Per-operation random IV (12 bytes)
 * - Authenticated encryption - wrong password OR tampered ciphertext both
 *   produce OperationError on decrypt (F-VAULT-01, ADR-008). The two cases
 *   are cryptographically indistinguishable (property of AES-GCM, not a bug).
 *   Phase 1 UX must collapse them into a single generic "unable to unlock"
 *   message.
 *
 * Phase 0 Test 04 validation (all passed):
 * - Round-trip: store(p, x) then load(p) === x
 * - Wrong password rejects with OperationError
 * - Tampered ciphertext rejects with OperationError
 * - PBKDF2 linearity: ~1.99x at 600k vs 1.2M (iterations honored)
 *
 * See: ADR-008, PRD 02 Addendum 6, M1 v2 Appendix A Test 04, Phase 0 commit
 * b6b7783 (packages/shared/src/vault.ts in wdk-phase0-validation).
 */

import { deriveKey, DERIVED_KEY_PARAMS, KDF_PARAMS } from './kdf.js';
import {
  createIndexedDbVaultStorage,
  type StoredVaultBlob,
  type VaultStorage,
} from './storage.js';

export {
  KDF_PARAMS,
  DERIVED_KEY_PARAMS,
  deriveKey,
  measureKdfTime,
} from './kdf.js';
export type {
  StoredVaultBlob,
  VaultStorage,
  VaultStorageOptions,
} from './storage.js';
export { createIndexedDbVaultStorage } from './storage.js';

const SALT_LENGTH = 16;
const VAULT_VERSION = 1 as const;

export interface WebCryptoVault {
  /** Returns true if a vault blob is stored. */
  hasStoredVault(): Promise<boolean>;
  /**
   * Encrypts plaintext with a key derived from password (PBKDF2 + AES-GCM)
   * and persists the resulting blob. Overwrites any existing stored blob.
   */
  store(password: string, plaintext: Uint8Array): Promise<void>;
  /**
   * Decrypts and returns the stored plaintext.
   *
   * Throws OperationError if the password is wrong OR the ciphertext has been
   * tampered with. Per ADR-008 F-VAULT-01, the two cases are cryptographically
   * indistinguishable; UX must collapse both into a single generic error.
   *
   * Throws (a different) Error if no vault is stored.
   */
  load(password: string): Promise<Uint8Array>;
  /** Removes the stored blob. Idempotent. */
  clear(): Promise<void>;
}

export interface CreateWebCryptoVaultOptions {
  /**
   * Storage backend. Defaults to IndexedDB via createIndexedDbVaultStorage().
   * Tests inject a custom storage (or a custom-DB-named IDB instance) for
   * isolation.
   */
  readonly storage?: VaultStorage;
}

export function createWebCryptoVault(
  options: CreateWebCryptoVaultOptions = {},
): WebCryptoVault {
  const storage = options.storage ?? createIndexedDbVaultStorage();

  return {
    async hasStoredVault(): Promise<boolean> {
      const blob = await storage.read();
      return blob !== null;
    },

    async store(password: string, plaintext: Uint8Array): Promise<void> {
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = crypto.getRandomValues(
        new Uint8Array(DERIVED_KEY_PARAMS.ivLength),
      );
      const key = await deriveKey(password, salt);

      const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: DERIVED_KEY_PARAMS.algorithm, iv },
        key,
        plaintext as unknown as BufferSource,
      );

      const blob: StoredVaultBlob = {
        version: VAULT_VERSION,
        kdf: {
          algorithm: KDF_PARAMS.algorithm,
          iterations: KDF_PARAMS.iterations,
          hash: KDF_PARAMS.hash,
          salt,
        },
        cipher: {
          algorithm: DERIVED_KEY_PARAMS.algorithm,
          iv,
        },
        ciphertext: new Uint8Array(ciphertextBuffer),
      };
      await storage.write(blob);
    },

    async load(password: string): Promise<Uint8Array> {
      const blob = await storage.read();
      if (!blob) {
        throw new Error('No vault stored');
      }

      const key = await deriveKey(password, blob.kdf.salt, blob.kdf.iterations);

      // Wrong password OR tampered ciphertext both surface here as OperationError.
      // See ADR-008 F-VAULT-01.
      const plaintextBuffer = await crypto.subtle.decrypt(
        { name: blob.cipher.algorithm, iv: blob.cipher.iv as unknown as BufferSource },
        key,
        blob.ciphertext as unknown as BufferSource,
      );
      return new Uint8Array(plaintextBuffer);
    },

    async clear(): Promise<void> {
      await storage.clear();
    },
  };
}