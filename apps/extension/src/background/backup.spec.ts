import { describe, it, expect, vi } from 'vitest';
import {
  encodeBackup, decodeBackup,
  memoryBackupTarget, createRestBackupTarget,
  exportVaultBackup, importVaultBackup,
} from './backup.js';
import type { StoredVaultBlob, VaultStorage } from '@wdk-starter/wdk-web-core/vault';

const blob = (): StoredVaultBlob => ({
  version: 1,
  kdf: { algorithm: 'PBKDF2', iterations: 600_000, hash: 'SHA-256', salt: new Uint8Array([1, 2, 3, 4]) },
  cipher: { algorithm: 'AES-GCM', iv: new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 1, 2]) },
  ciphertext: new Uint8Array([10, 20, 30, 40, 50, 255, 0, 128]),
});

describe('encode/decode backup', () => {
  it('round-trips a stored vault blob exactly', async () => {
    const text = await encodeBackup(blob(), 1_700_000_000_000);
    const out = await decodeBackup(text);
    expect(out).toEqual(blob());
  });

  it('the encoded form is opaque base64 carrying no plaintext seed', async () => {
    const text = await encodeBackup(blob(), 0);
    expect(/^[A-Za-z0-9+/=]+$/.test(text)).toBe(true);
    // it still decodes to a JSON envelope with our magic
    expect(atob(text)).toContain('WDK-VAULT-BACKUP');
  });

  it('rejects a non-backup string', async () => {
    await expect(decodeBackup('not-a-backup')).rejects.toThrow(/valid WDK vault backup|not a WDK/);
  });

  it('rejects a tampered ciphertext (checksum mismatch)', async () => {
    const text = await encodeBackup(blob(), 0);
    const env = JSON.parse(atob(text));
    env.vault.ciphertext = btoa('tampered');
    const tampered = btoa(JSON.stringify(env));
    await expect(decodeBackup(tampered)).rejects.toThrow(/checksum mismatch/);
  });

  it('rejects an unsupported version', async () => {
    const text = await encodeBackup(blob(), 0);
    const env = JSON.parse(atob(text));
    env.v = 999;
    await expect(decodeBackup(btoa(JSON.stringify(env)))).rejects.toThrow(/unsupported backup version/);
  });
});

describe('cloud targets', () => {
  it('memory target stores and reads', async () => {
    const t = memoryBackupTarget();
    expect(await t.get('primary')).toBeNull();
    await t.put('primary', 'blob');
    expect(await t.get('primary')).toBe('blob');
  });

  it('REST target PUTs the body and GETs text, 404 → null', async () => {
    const calls: Array<{ url: string; method: string; body: string | undefined }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      if (init?.method === 'PUT') return { ok: true, status: 200 } as Response;
      if (url.endsWith('/missing')) return { ok: false, status: 404 } as Response;
      return { ok: true, status: 200, text: async () => 'stored-blob' } as unknown as Response;
    });
    const t = createRestBackupTarget({ baseUrl: 'https://vault.example/', fetchImpl: fetchImpl as unknown as typeof fetch });
    await t.put('primary', 'enc');
    expect(calls[0]).toMatchObject({ url: 'https://vault.example/primary', method: 'PUT', body: 'enc' });
    expect(await t.get('primary')).toBe('stored-blob');
    expect(await t.get('missing')).toBeNull();
  });
});

describe('exportVaultBackup / importVaultBackup', () => {
  function fakeStorage(initial: StoredVaultBlob | null): VaultStorage & { current: StoredVaultBlob | null } {
    const s = {
      current: initial,
      read: async () => s.current,
      write: async (b: StoredVaultBlob) => { s.current = b; },
      clear: async () => { s.current = null; },
    };
    return s as VaultStorage & { current: StoredVaultBlob | null };
  }

  it('exports the stored blob and re-imports it into another storage', async () => {
    const src = fakeStorage(blob());
    const text = await exportVaultBackup(src, 0);
    const dst = fakeStorage(null);
    await importVaultBackup(dst, text);
    expect(dst.current).toEqual(blob());
  });

  it('throws when there is nothing to back up', async () => {
    await expect(exportVaultBackup(fakeStorage(null))).rejects.toThrow(/no vault is stored/);
  });
});
