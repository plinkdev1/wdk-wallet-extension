/**
 * @wdk-starter/wdk-ui - ChainSelector
 *
 * Compact dropdown picker for the active chain. Designed to fit in a wallet
 * header next to action buttons. Trigger button shows the current chain
 * name (with a "(testnet)" hint when applicable). Click to toggle the
 * dropdown panel listing all options.
 *
 * Controlled component: parent owns the active state (typically via
 * useActiveChain). onChange fires with the picked id; the parent's setter
 * updates state, the trigger re-renders.
 *
 * Pairs with useActiveChain hook in the same module. Both are exported via
 * the chain/index.ts barrel and re-exported from wdk-ui/src/index.ts.
 *
 * Source: B1b chain UI surface.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export interface ChainOption<T extends string> {
  readonly id: T;
  readonly name: string;
  readonly testnet?: boolean;
  /** Optional icon node rendered in trigger + dropdown rows (e.g. <NetworkIcon ... />). */
  readonly icon?: ReactNode;
}

export interface ChainSelectorProps<T extends string> {
  readonly active: T;
  readonly options: ReadonlyArray<ChainOption<T>>;
  readonly onChange: (next: T) => void;
}

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-body, inherit)',
  color: 'var(--text-primary, currentColor)',
  backgroundColor: 'var(--bg-elevated-2, rgba(255,255,255,0.06))',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
};

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  zIndex: 50,
  minWidth: '100%',
  padding: 4,
  backgroundColor: 'var(--bg-elevated-1, #1a1a1a)',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  borderRadius: 'var(--radius-md, 6px)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  listStyle: 'none',
  margin: 0,
  fontFamily: 'var(--font-body, inherit)',
  // B1-2: support long chain lists - 48+ entries don't fit a popup viewport.
  maxHeight: 280,
  overflowY: 'auto',
};

const optionBaseStyle: CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-primary, currentColor)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const testnetHintStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 500,
  marginLeft: 4,
};

const checkStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.7,
};

const chevronStyle: CSSProperties = {
  fontSize: 9,
  opacity: 0.6,
  marginLeft: 4,
};
const iconSlotStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0,
  whiteSpace: 'nowrap',
};

const optionLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
};

export function ChainSelector<T extends string>({
  active,
  options,
  onChange,
}: ChainSelectorProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.id === active);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent): void => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handlePick = useCallback((id: T) => {
    onChange(id);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        data-testid="chain-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
      >
        {current?.icon && <span style={iconSlotStyle} aria-hidden="true">{current.icon}</span>}
        <span style={labelStyle}>
          {current?.name ?? 'Select chain'}
          {current?.testnet && <span style={testnetHintStyle}> testnet</span>}
        </span>
        <span style={chevronStyle} aria-hidden="true">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Active chain"
          data-testid="chain-selector-list"
          style={panelStyle}
        >
          {options.map((o) => {
            const isActive = o.id === active;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={isActive}
                data-testid={`chain-option-${o.id}`}
                onClick={() => handlePick(o.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated-2, rgba(255,255,255,0.08))'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                style={{ ...optionBaseStyle, backgroundColor: 'transparent' }}
              >
                <span style={optionLabelStyle}>
                  {o.icon && <span style={iconSlotStyle} aria-hidden="true">{o.icon}</span>}
                  <span>{o.name}</span>
                  {o.testnet && <span style={testnetHintStyle}> testnet</span>}
                </span>
                {isActive && <span style={checkStyle} aria-hidden="true">{'\u2713'}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}