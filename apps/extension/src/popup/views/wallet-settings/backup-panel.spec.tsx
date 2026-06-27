/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const send = vi.fn();
vi.mock('../../lib/sw-client.js', () => ({ send: (...args: unknown[]) => send(...args) }));

import { BackupPanel } from './backup-panel.js';

describe('BackupPanel', () => {
  beforeEach(() => { send.mockReset(); });

  it('exports an encrypted backup and shows it to copy', async () => {
    send.mockResolvedValueOnce({ backup: 'ENCRYPTED-BLOB' });
    render(<BackupPanel />);
    fireEvent.click(screen.getByTestId('backup-export'));
    await waitFor(() => expect(screen.getByTestId('backup-output')).toBeInTheDocument());
    expect(screen.getByTestId('backup-output')).toHaveValue('ENCRYPTED-BLOB');
    expect(send).toHaveBeenCalledWith({ type: 'BACKUP_EXPORT_VAULT' });
  });

  it('restores from a pasted backup', async () => {
    send.mockResolvedValueOnce({ ok: true });
    render(<BackupPanel />);
    fireEvent.change(screen.getByTestId('backup-import-input'), { target: { value: '  RESTORE-ME  ' } });
    fireEvent.click(screen.getByTestId('backup-import'));
    await waitFor(() => expect(screen.getByTestId('backup-status')).toBeInTheDocument());
    expect(send).toHaveBeenCalledWith({ type: 'BACKUP_IMPORT_VAULT', backup: 'RESTORE-ME' });
    expect(screen.getByTestId('backup-status').textContent).toMatch(/restored/i);
  });

  it('disables restore until something is pasted', () => {
    render(<BackupPanel />);
    expect(screen.getByTestId('backup-import')).toBeDisabled();
  });

  it('surfaces a friendly error when export fails', async () => {
    send.mockRejectedValueOnce(new Error('no vault'));
    render(<BackupPanel />);
    fireEvent.click(screen.getByTestId('backup-export'));
    await waitFor(() => expect(screen.getByTestId('backup-status')).toBeInTheDocument());
    expect(screen.getByTestId('backup-status').textContent).toMatch(/could not export/i);
  });
});
