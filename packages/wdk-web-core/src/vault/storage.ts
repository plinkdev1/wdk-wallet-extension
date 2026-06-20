import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * IndexedDB-backed storage for the WebCryptoVault.
 *
 * Layout:
 *   database: 'wdk-web-core-vault' (configurable via options.dbName for tests)
 *   version:  1
 *   store:    'vault'
 *   key:      'primary' (single-blob model; Phase 1 = one vault per origin)
 *
 * The blob shape embeds the KDF + cipher parameters used at write time, so
 * future iteration-count migrations can decrypt old blobs cleanly without a
 * separate metadata table.
 *
 * Tests inject a unique dbName per test (typically via crypto.randomUUID) to
 * isolate state without relying on cross-test cleanup. fake-indexeddb provides
 * the Node-side implementation; production environments use the browser/SW
 * native IndexedDB.
 */

export interface StoredVaultBlob {
  readonly version: 1;
  readonly kdf: {
    readonly algorithm: 'PBKDF2';
    readonly iterations: number;
    readonly hash: 'SHA-256';
    readonly salt: Uint8Array;
  };
  readonly cipher: {
    readonly algorithm: 'AES-GCM';
    readonly iv: Uint8Array;
  };
  readonly ciphertext: Uint8Array;
}

export interface VaultStorage {
  /** Returns the stored blob, or null if none. */
  read(): Promise<StoredVaultBlob | null>;
  /** Overwrites the stored blob. */
  write(blob: StoredVaultBlob): Promise<void>;
  /** Removes the stored blob. Idempotent. */
  clear(): Promise<void>;
}

export interface VaultStorageOptions {
  readonly dbName?: string;
}

interface VaultDbSchema extends DBSchema {
  vault: {
    key: string;
    value: StoredVaultBlob;
  };
}

const DEFAULT_DB_NAME = 'wdk-web-core-vault';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const PRIMARY_KEY = 'primary';

export function createIndexedDbVaultStorage(
  options: VaultStorageOptions = {},
): VaultStorage {
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  let dbPromise: Promise<IDBPDatabase<VaultDbSchema>> | null = null;

  function getDb(): Promise<IDBPDatabase<VaultDbSchema>> {
    if (!dbPromise) {
      dbPromise = openDB<VaultDbSchema>(dbName, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        },
      });
    }
    return dbPromise;
  }

  return {
    async read(): Promise<StoredVaultBlob | null> {
      const db = await getDb();
      const value = await db.get(STORE_NAME, PRIMARY_KEY);
      return value ?? null;
    },

    async write(blob: StoredVaultBlob): Promise<void> {
      const db = await getDb();
      await db.put(STORE_NAME, blob, PRIMARY_KEY);
    },

    async clear(): Promise<void> {
      const db = await getDb();
      await db.delete(STORE_NAME, PRIMARY_KEY);
    },
  };
}