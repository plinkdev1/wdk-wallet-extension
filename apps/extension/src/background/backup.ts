/**
 * Encrypted cloud backup (Phase 5 hardening).
 *
 * Exports the vault's ALREADY-ENCRYPTED blob (PBKDF2 + AES-GCM ciphertext — the
 * seed never leaves in plaintext) as a portable, versioned, integrity-checked
 * envelope, and restores it. Decryption still requires the user's password on the
 * destination device, so a leaked backup is useless without it.
 *
 * The "cloud" is a pluggable {@link CloudBackupTarget} — the encrypted envelope is
 * opaque bytes, so any store works (a REST endpoint, a memory target in tests, or
 * the user pasting the string into their own drive). Nothing here custodies keys.
 */

import type { StoredVaultBlob, VaultStorage } from '@wdk-starter/wdk-web-core/vault';

const MAGIC = 'WDK-VAULT-BACKUP';
const BACKUP_VERSION = 1;

/* ----------------------------- base64 (binary) ---------------------------- */

function u8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

function base64ToU8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/* ------------------------------- envelope --------------------------------- */

interface BackupEnvelope {
  readonly magic: typeof MAGIC;
  readonly v: number;
  readonly createdAt: number;
  readonly vault: {
    readonly version: number;
    readonly kdf: { algorithm: string; iterations: number; hash: string; salt: string };
    readonly cipher: { algorithm: string; iv: string };
    readonly ciphertext: string;
  };
  /** SHA-256 (hex) over the canonical vault JSON — detects corruption early. */
  readonly checksum: string;
}

/** Canonical JSON of the (base64) vault fields, for a stable checksum. */
function canonicalVaultJson(vault: BackupEnvelope['vault']): string {
  return JSON.stringify([
    vault.version,
    vault.kdf.algorithm, vault.kdf.iterations, vault.kdf.hash, vault.kdf.salt,
    vault.cipher.algorithm, vault.cipher.iv,
    vault.ciphertext,
  ]);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function vaultToEnvelopeVault(blob: StoredVaultBlob): BackupEnvelope['vault'] {
  return {
    version: blob.version,
    kdf: {
      algorithm: blob.kdf.algorithm,
      iterations: blob.kdf.iterations,
      hash: blob.kdf.hash,
      salt: u8ToBase64(blob.kdf.salt),
    },
    cipher: { algorithm: blob.cipher.algorithm, iv: u8ToBase64(blob.cipher.iv) },
    ciphertext: u8ToBase64(blob.ciphertext),
  };
}

/**
 * Encode a stored vault blob into a portable backup string (base64 of the signed
 * envelope JSON). `now` is injectable for deterministic tests.
 */
export async function encodeBackup(blob: StoredVaultBlob, now: number = Date.now()): Promise<string> {
  const vault = vaultToEnvelopeVault(blob);
  const envelope: BackupEnvelope = {
    magic: MAGIC,
    v: BACKUP_VERSION,
    createdAt: now,
    vault,
    checksum: await sha256Hex(canonicalVaultJson(vault)),
  };
  return u8ToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

/**
 * Decode + validate a backup string back into a stored vault blob. Throws on a
 * bad magic, an unsupported version, or a checksum mismatch (corruption).
 */
export async function decodeBackup(text: string): Promise<StoredVaultBlob> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(new TextDecoder().decode(base64ToU8(text.trim()))) as BackupEnvelope;
  } catch {
    throw new Error('backup: not a valid WDK vault backup (could not parse).');
  }
  if (envelope?.magic !== MAGIC) throw new Error('backup: not a WDK vault backup.');
  if (envelope.v !== BACKUP_VERSION) throw new Error(`backup: unsupported backup version ${envelope.v}.`);

  const expected = await sha256Hex(canonicalVaultJson(envelope.vault));
  if (expected !== envelope.checksum) throw new Error('backup: checksum mismatch — the backup is corrupted.');

  const v = envelope.vault;
  return {
    version: v.version as 1,
    kdf: {
      algorithm: v.kdf.algorithm as 'PBKDF2',
      iterations: v.kdf.iterations,
      hash: v.kdf.hash as 'SHA-256',
      salt: base64ToU8(v.kdf.salt),
    },
    cipher: { algorithm: v.cipher.algorithm as 'AES-GCM', iv: base64ToU8(v.cipher.iv) },
    ciphertext: base64ToU8(v.ciphertext),
  };
}

/* ----------------------------- cloud targets ------------------------------ */

/** Where an encrypted backup is stored. The data is opaque, encrypted bytes. */
export interface CloudBackupTarget {
  put(id: string, data: string): Promise<void>;
  get(id: string): Promise<string | null>;
}

/** An in-memory target (tests / a default no-op). */
export function memoryBackupTarget(): CloudBackupTarget {
  const store = new Map<string, string>();
  return {
    put: async (id, data) => { store.set(id, data); },
    get: async (id) => store.get(id) ?? null,
  };
}

export interface RestBackupTargetOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
  readonly headers?: Record<string, string>;
}

/**
 * A {@link CloudBackupTarget} over a generic REST endpoint the user controls:
 * `PUT {baseUrl}/{id}` to store, `GET {baseUrl}/{id}` to read. The body is the
 * encrypted backup string. Bring any storage that speaks this shape.
 */
export function createRestBackupTarget(opts: RestBackupTargetOptions): CloudBackupTarget {
  const f = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  const base = opts.baseUrl.replace(/\/$/, '');
  const ensure = (): typeof fetch => {
    if (typeof f !== 'function') throw new Error('backup: no fetch available; pass opts.fetchImpl');
    return f;
  };
  return {
    async put(id, data) {
      const res = await ensure()(`${base}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'text/plain', ...(opts.headers ?? {}) },
        body: data,
      });
      if (!res.ok) throw new Error(`backup: put HTTP ${res.status}`);
    },
    async get(id) {
      const res = await ensure()(`${base}/${encodeURIComponent(id)}`, { headers: { ...(opts.headers ?? {}) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`backup: get HTTP ${res.status}`);
      return res.text();
    },
  };
}

/* --------------------------- vault export/import -------------------------- */

/** Read the stored (encrypted) vault and encode it as a backup string. */
export async function exportVaultBackup(storage: VaultStorage, now?: number): Promise<string> {
  const blob = await storage.read();
  if (!blob) throw new Error('backup: no vault is stored to back up.');
  return encodeBackup(blob, now);
}

/** Decode a backup string and write it as the stored vault (overwrites). */
export async function importVaultBackup(storage: VaultStorage, text: string): Promise<void> {
  const blob = await decodeBackup(text);
  await storage.write(blob);
}
