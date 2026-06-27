/**
 * SuccessScreen — the terminal "it's done" state for a flow (PRD §3.1).
 *
 * Centered confirmation: a glyph, a title, an optional message, an optional
 * (truncated) hash, an optional outbound link (block explorer), and a single
 * Done action. Pure presentational — the shell decides what "done" means.
 *
 * Framework-free, theme-token-driven.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';
import { Button } from './button.js';

export interface SuccessScreenProps {
  readonly title?: string;
  readonly message?: ReactNode;
  /** Transaction hash / id, shown monospace and middle-truncated. */
  readonly hash?: string;
  /** Outbound link, e.g. a block explorer. */
  readonly link?: { readonly href: string, readonly label: string };
  readonly onDone: () => void;
  readonly doneLabel?: string;
  /** Override the glyph (default ✅). */
  readonly icon?: ReactNode;
}

function truncate (h: string): string {
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h;
}

export function SuccessScreen ({
  title = 'Success', message, hash, link, onDone, doneLabel = 'Done', icon = '✅',
}: SuccessScreenProps): JSX.Element {
  return (
    <div style={wrap}>
      <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">{icon}</div>
      <h2 style={heading}>{title}</h2>
      {message && <p style={msg}>{message}</p>}
      {hash && <code style={hashStyle} title={hash}>{truncate(hash)}</code>}
      {link && <a href={link.href} target="_blank" rel="noreferrer" style={linkStyle}>{link.label} ↗</a>}
      <Button onClick={onDone} style={{ width: '100%', marginTop: 4 }}>{doneLabel}</Button>
    </div>
  );
}

const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' };
const heading: CSSProperties = { fontSize: 18, fontWeight: 600, margin: 0 };
const msg: CSSProperties = { margin: 0, fontSize: 14, color: 'var(--text-secondary, #b3a79f)' };
const hashStyle: CSSProperties = { fontSize: 12, padding: '6px 10px', background: 'var(--bg-elevated-2, #241f1c)', borderRadius: 8, color: 'var(--text-secondary, #b3a79f)' };
const linkStyle: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--accent, var(--wdk-orange, #F4642F))' };
