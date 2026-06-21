/**
 * ConnectionsSection - Settings → Connections.
 *
 * Lists the dApps the wallet is connected to (the per-origin allow-list the dApp
 * pipeline reads) and lets the user revoke any of them. Self-contained: loads its
 * own data over the SW message bus (CONNECTIONS_LIST / CONNECTIONS_REVOKE) and
 * refreshes after a revoke. Giving the user visible control over granted
 * permissions is a core security-credibility surface.
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@wdk-starter/wdk-ui';
import { send } from '../../../lib/sw-client.js';
import type { ConnectionDto } from '../../../../types/messages.js';

function hostOf(origin: string): string {
  try {
    return new URL(origin).host || origin;
  } catch {
    return origin;
  }
}

export function ConnectionsSection(): JSX.Element {
  const [conns, setConns] = useState<readonly ConnectionDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConns(await send({ type: 'CONNECTIONS_LIST' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(async (origin: string) => {
    setBusy(origin);
    try {
      await send({ type: 'CONNECTIONS_REVOKE', origin });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke');
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (error) {
    return <p style={muted}>{error}</p>;
  }
  if (conns === null) {
    return <p style={muted}>Loading…</p>;
  }
  if (conns.length === 0) {
    return <p style={muted}>No connected sites. When you connect to a dApp, it appears here so you can revoke access anytime.</p>;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {conns.map((c) => (
        <li key={c.origin} style={row} data-testid="connection-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{hostOf(c.origin)}</span>
            <span style={muted}>{c.accountIndices.length} account{c.accountIndices.length === 1 ? '' : 's'} · {c.chains.length} chain{c.chains.length === 1 ? '' : 's'}</span>
          </div>
          <Button variant="ghost" onClick={() => void revoke(c.origin)} disabled={busy === c.origin} aria-label={`Revoke ${hostOf(c.origin)}`}>
            {busy === c.origin ? '…' : 'Revoke'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

const muted: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--text-secondary, currentColor)',
};

const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 'var(--radius-md, 8px)',
  background: 'var(--bg-elevated-1, rgba(255,255,255,0.03))',
};
