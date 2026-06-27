/**
 * ReviewSheet — the "confirm before you sign" step (PRD §3.1).
 *
 * A presentational summary: a titled list of label/value rows (To, Amount,
 * Network, Fee…) plus a primary Confirm and an optional Back, with room for an
 * inline error and a footnote/warning. The shell that owns the transaction
 * passes the rows and the handlers; this primitive owns none of the wallet
 * logic, so it drops into Send / Swap / Bridge / Earn unchanged.
 *
 * Pure, framework-free, theme-token-driven.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';
import { Button } from './button.js';

export interface ReviewRow {
  readonly label: string;
  readonly value: ReactNode;
  /** Render the value in a monospace face (addresses, hashes). */
  readonly mono?: boolean;
}

export interface ReviewSheetProps {
  readonly title?: string;
  readonly rows: readonly ReviewRow[];
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
  /** Disables the buttons and switches Confirm to a busy label. */
  readonly busy?: boolean;
  readonly busyLabel?: string;
  readonly error?: string | null;
  /** Optional footnote / warning beneath the rows. */
  readonly note?: ReactNode;
}

export function ReviewSheet ({
  title = 'Review', rows, confirmLabel = 'Confirm', cancelLabel = 'Back',
  onConfirm, onCancel, busy = false, busyLabel = 'Submitting…', error, note,
}: ReviewSheetProps): JSX.Element {
  return (
    <div style={wrap}>
      <h2 style={heading}>{title}</h2>
      <div style={card}>
        {rows.map((r, i) => (
          <div key={r.label + i} style={{ ...rowStyle, borderTop: i === 0 ? 'none' : '1px solid var(--border-default, #332c28)' }}>
            <span style={labelStyle}>{r.label}</span>
            <span style={{ ...valueStyle, ...(r.mono ? { fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' } : {}) }}>{r.value}</span>
          </div>
        ))}
      </div>
      {note && <div style={noteStyle}>{note}</div>}
      {error && <p style={errStyle}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>{cancelLabel}</Button>}
        <Button onClick={onConfirm} disabled={busy} style={{ flex: 2 }}>{busy ? busyLabel : confirmLabel}</Button>
      </div>
    </div>
  );
}

const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };
const heading: CSSProperties = { fontSize: 17, fontWeight: 600, margin: 0 };
const card: CSSProperties = {
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg-elevated-1, #1a1614)',
  border: '1px solid var(--border-default, #332c28)', borderRadius: 'var(--radius-md, 10px)',
};
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, padding: '11px 14px', fontSize: 14, alignItems: 'baseline' };
const labelStyle: CSSProperties = { color: 'var(--text-secondary, #b3a79f)', flexShrink: 0 };
const valueStyle: CSSProperties = { textAlign: 'right', fontWeight: 500 };
const noteStyle: CSSProperties = { margin: 0, padding: '10px 12px', background: 'var(--bg-elevated-2, #241f1c)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary, #b3a79f)' };
const errStyle: CSSProperties = { margin: 0, color: 'var(--color-error, #ef4444)', fontSize: 13 };
