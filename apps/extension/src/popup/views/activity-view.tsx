/**
 * ActivityView - transaction history with per-chain filtering.
 *
 * Lists the sends the wallet has broadcast (persisted via useTransactions),
 * newest first, with amount, recipient, relative time, and an explorer link
 * for live status. A filter row lets the user narrow to a single chain.
 */

import { useMemo, useState } from 'react';
import { Button, Card } from '@wdk-starter/wdk-ui';
import { useTransactions, type TxRecord } from '../hooks/use-transactions.js';
import { useTransactionStatuses, type LiveStatus } from '../hooks/use-transaction-statuses.js';
import { explorerTxUrl } from '../lib/explorers.js';

export interface ActivityViewProps {
  readonly onBack: () => void;
  /** Display name lookup for a chain id (falls back to the id). */
  readonly chainName?: (chain: string) => string;
}

function formatBaseUnits(value: string, decimals: number): string {
  try {
    const v = BigInt(value);
    const divisor = 10n ** BigInt(decimals);
    const whole = v / divisor;
    const frac = (v % divisor).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch {
    return value;
  }
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function truncate(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Resolves the status shown for a row: live poll result first, then stored. */
function effectiveStatus(tx: TxRecord, live: Record<string, LiveStatus>): LiveStatus {
  const polled = live[tx.hash];
  if (polled) return polled;
  if (tx.status === 'success' || tx.status === 'failed') return tx.status;
  return 'pending';
}

export function ActivityView({ onBack, chainName }: ActivityViewProps): JSX.Element {
  const { transactions } = useTransactions();
  const liveStatuses = useTransactionStatuses(transactions);
  const [filter, setFilter] = useState<string>('all');

  const chains = useMemo(() => {
    const set = new Set(transactions.map((t) => t.chain));
    return Array.from(set);
  }, [transactions]);

  const visible = filter === 'all' ? transactions : transactions.filter((t) => t.chain === filter);
  const nameOf = (c: string) => (chainName ? chainName(c) : c);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">←</Button>
        <strong style={{ fontSize: 15 }}>Activity</strong>
      </header>

      {chains.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          {chains.map((c) => (
            <FilterChip key={c} label={nameOf(c)} active={filter === c} onClick={() => setFilter(c)} />
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <div style={{ padding: 16, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
            No transactions yet. Sends you make from this wallet appear here with an explorer link for
            live status.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map((tx) => (
            <TxRow key={tx.hash + tx.ts} tx={tx} chainLabel={nameOf(tx.chain)} status={effectiveStatus(tx, liveStatuses)} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<LiveStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#E3A008' },
  success: { label: 'Confirmed', color: '#3FB950' },
  failed: { label: 'Failed', color: '#EF4444' },
};

function StatusPill({ status }: { status: LiveStatus }): JSX.Element {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, border: `1px solid ${s.color}`, borderRadius: 999, padding: '1px 7px' }}>
      {s.label}
    </span>
  );
}

function TxRow({ tx, chainLabel, status }: { tx: TxRecord; chainLabel: string; status: LiveStatus }): JSX.Element {
  const url = explorerTxUrl(tx.chain, tx.hash);
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{ fontSize: 13 }}>Sent to {truncate(tx.to)}</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{chainLabel} · {relativeTime(tx.ts)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>-{formatBaseUnits(tx.value, tx.decimals)} {tx.symbol}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <StatusPill status={status} />
            {url && <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>view ↗</a>}
          </span>
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        cursor: 'pointer',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
        backgroundColor: active ? 'var(--color-primary, #F4642F)' : 'transparent',
        color: active ? '#fff' : 'var(--text-primary)',
      }}
    >
      {label}
    </button>
  );
}
