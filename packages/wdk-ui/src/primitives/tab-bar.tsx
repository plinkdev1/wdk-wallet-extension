/**
 * TabBar — the primary navigation rail for a pro-wallet IA (Home · Swap ·
 * Activity · …). Bottom bar on narrow widths, equally usable as a popup tab
 * strip in the extension. Pure, controlled, theme-token-driven — the shell
 * primitive the PRD's Phase 1 builds on.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';

export interface TabItem {
  /** Stable id (also the value passed to onChange). */
  readonly id: string;
  /** Visible label. */
  readonly label: string;
  /** Optional icon (rendered above the label). */
  readonly icon?: ReactNode;
}

export interface TabBarProps {
  readonly tabs: readonly TabItem[];
  readonly active: string;
  readonly onChange: (id: string) => void;
  /** Sticky to the bottom of the viewport (default true). */
  readonly sticky?: boolean;
  readonly 'aria-label'?: string;
}

export function TabBar({ tabs, active, onChange, sticky = true, ...rest }: TabBarProps): JSX.Element {
  const bar: CSSProperties = {
    display: 'flex',
    alignItems: 'stretch',
    gap: 2,
    width: '100%',
    background: 'var(--surface, var(--bg-elevated, #1a1614))',
    borderTop: '1px solid var(--border, #332c28)',
    ...(sticky ? { position: 'sticky', bottom: 0, zIndex: 10 } : {}),
  };
  return (
    <nav role="tablist" aria-label={rest['aria-label'] ?? 'Primary'} style={bar}>
      {tabs.map((t) => {
        const selected = t.id === active;
        const btn: CSSProperties = {
          flex: 1,
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '8px 4px',
          minHeight: 52,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: selected ? 600 : 500,
          lineHeight: 1,
          color: selected ? 'var(--accent, var(--wdk-orange, #F4642F))' : 'var(--text-secondary, #b3a79f)',
        };
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={t.label}
            onClick={() => onChange(t.id)}
            style={btn}
          >
            {t.icon !== undefined && <span aria-hidden="true" style={{ display: 'inline-flex', fontSize: 18 }}>{t.icon}</span>}
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
