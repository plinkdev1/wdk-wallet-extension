/**
 * StatusPill — a compact transaction-state badge (PRD §3.1).
 *
 * A colored dot + label for the lifecycle states a wallet surfaces: pending /
 * success / failed (plus a neutral default). Drives the Activity list, the
 * transaction detail, and review confirmations off the same vocabulary.
 *
 * Pure presentational, theme-token-driven.
 */

import type { CSSProperties, JSX } from 'react';

export type Status = 'pending' | 'success' | 'failed' | 'neutral';

export interface StatusPillProps {
  readonly status: Status;
  /** Override the visible text (defaults to a capitalized status word). */
  readonly label?: string;
  readonly size?: 'sm' | 'md';
}

const DOT: Record<Status, string> = {
  pending: 'var(--color-warning, #f59e0b)',
  success: 'var(--color-success, #22c55e)',
  failed: 'var(--color-error, #ef4444)',
  neutral: 'var(--text-secondary, #b3a79f)',
};
const DEFAULT_LABEL: Record<Status, string> = {
  pending: 'Pending', success: 'Confirmed', failed: 'Failed', neutral: 'Unknown',
};

export function StatusPill ({ status, label, size = 'md' }: StatusPillProps): JSX.Element {
  const dot = DOT[status] ?? DOT.neutral;
  const pad = size === 'sm' ? '2px 8px' : '3px 10px';
  const font = size === 'sm' ? 11 : 12;
  return (
    <span role="status" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: pad,
      borderRadius: 999, fontSize: font, fontWeight: 600, lineHeight: 1,
      background: 'var(--bg-elevated-2, #241f1c)', color: 'var(--text-primary, #f5efe9)',
    }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: dot, ...(status === 'pending' ? { boxShadow: `0 0 0 0 ${dot}` } : {}) }} />
      {label ?? DEFAULT_LABEL[status] ?? DEFAULT_LABEL.neutral}
    </span>
  );
}
