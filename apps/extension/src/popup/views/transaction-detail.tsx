/**
 * TransactionDetail — per-transaction detail panel (Phase 2 item 4).
 *
 * Opened from a row in ActivityView. Shows the amount, live status, network,
 * recipient, time, and the tx hash with copy + block-explorer link. A pure
 * presentational component: the live status is resolved by ActivityView (the
 * same poll that drives the list) and passed in, so this never fetches.
 */

import { useState } from 'react';
import { Button, Card, StatusPill } from '@wdk-starter/wdk-ui';
import type { TxRecord } from '../hooks/use-transactions.js';
import type { LiveStatus } from '../hooks/use-transaction-statuses.js';
import { explorerTxUrl } from '../lib/explorers.js';

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

export interface TransactionDetailProps {
  readonly tx: TxRecord;
  readonly status: LiveStatus;
  readonly chainLabel: string;
  readonly onBack: () => void;
}

export function TransactionDetail({ tx, status, chainLabel, onBack }: TransactionDetailProps): JSX.Element {
  const [copied, setCopied] = useState<string>('');
  const url = explorerTxUrl(tx.chain, tx.hash);

  const copy = async (label: string, value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">←</Button>
        <strong style={{ fontSize: 15 }}>Transaction</strong>
      </header>

      <Card>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 26, fontWeight: 700 }}>-{formatBaseUnits(tx.value, tx.decimals)} {tx.symbol}</span>
          <StatusPill status={status} />
        </div>
      </Card>

      <Card>
        <div style={{ padding: '6px 14px' }}>
          <Row label="Network" value={chainLabel} />
          <Row
            label="To"
            value={tx.to}
            mono
            onCopy={() => { void copy('to', tx.to); }}
            copied={copied === 'to'}
          />
          <Row label="Time" value={new Date(tx.ts).toLocaleString()} />
          <Row
            label="Tx hash"
            value={`${tx.hash.slice(0, 10)}…${tx.hash.slice(-8)}`}
            mono
            onCopy={() => { void copy('hash', tx.hash); }}
            copied={copied === 'hash'}
          />
        </div>
      </Card>

      {url && (
        <a href={url} target="_blank" rel="noreferrer" style={{ textAlign: 'center', fontSize: 13, fontWeight: 600 }}>
          View on block explorer ↗
        </a>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
      <span style={{ fontSize: 12, opacity: 0.6 }}>{label}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '66%' }}>
        <span style={{ fontSize: 12, textAlign: 'right', wordBreak: 'break-all', fontFamily: mono ? 'ui-monospace, monospace' : 'inherit' }}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} aria-label={`Copy ${label}`} title={`Copy ${label}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: 0 }}>
            {copied ? '✓' : '⧉'}
          </button>
        )}
      </span>
    </div>
  );
}
