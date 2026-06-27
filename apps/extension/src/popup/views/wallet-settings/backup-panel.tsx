/**
 * BackupPanel — encrypted cloud backup (Phase 5).
 *
 * Export the vault's ALREADY-ENCRYPTED blob as a portable string the user saves
 * anywhere (a file, their own cloud), and restore it on another device. The seed
 * never leaves in plaintext; restoring still requires the original password — so a
 * leaked backup is useless without it.
 */
import { useState, type CSSProperties, type JSX } from 'react';
import { send } from '../../lib/sw-client.js';

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary, currentColor)',
  display: 'block',
  marginBottom: 4,
};

const buttonStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--border, #4444)',
  background: 'var(--surface, transparent)',
  color: 'var(--text-primary, currentColor)',
  cursor: 'pointer',
};

const areaStyle: CSSProperties = {
  width: '100%',
  minHeight: 64,
  fontFamily: 'var(--font-mono, monospace)',
  fontSize: 10,
  wordBreak: 'break-all',
  marginTop: 6,
  boxSizing: 'border-box',
};

export function BackupPanel(): JSX.Element {
  const [backup, setBackup] = useState('');
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onExport(): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      const result = await send({ type: 'BACKUP_EXPORT_VAULT' });
      setBackup(result.backup);
    } catch {
      setStatus('Could not export a backup. Make sure a wallet is set up.');
    } finally {
      setBusy(false);
    }
  }

  async function onImport(): Promise<void> {
    const text = importText.trim();
    if (text === '') return;
    setBusy(true);
    setStatus(null);
    try {
      await send({ type: 'BACKUP_IMPORT_VAULT', backup: text });
      setImportText('');
      setStatus('Backup restored. Unlock with the password it was created with.');
    } catch {
      setStatus('Import failed — check that you pasted a complete WDK vault backup.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }} data-testid="wallet-backup-panel">
      <label style={labelStyle}>Encrypted backup</label>
      <p style={{ fontSize: 10, color: 'var(--text-secondary, currentColor)', margin: '0 0 6px' }}>
        Exports your <strong>encrypted</strong> vault — the seed never leaves in plaintext, and
        restoring it still needs your password.
      </p>

      <button type="button" style={buttonStyle} onClick={() => { void onExport(); }} disabled={busy} data-testid="backup-export">
        Export encrypted backup
      </button>

      {backup !== '' && (
        <textarea
          readOnly
          value={backup}
          style={areaStyle}
          aria-label="Encrypted vault backup"
          data-testid="backup-output"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}

      <label style={{ ...labelStyle, marginTop: 12 }}>Restore from a backup</label>
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Paste a WDK vault backup…"
        style={areaStyle}
        aria-label="Paste a backup to restore"
        data-testid="backup-import-input"
      />
      <button
        type="button"
        style={{ ...buttonStyle, marginTop: 6 }}
        onClick={() => { void onImport(); }}
        disabled={busy || importText.trim() === ''}
        data-testid="backup-import"
      >
        Restore backup
      </button>

      {status !== null && (
        <p style={{ fontSize: 10, marginTop: 8, color: 'var(--text-secondary, currentColor)' }} role="status" data-testid="backup-status">
          {status}
        </p>
      )}
    </div>
  );
}
