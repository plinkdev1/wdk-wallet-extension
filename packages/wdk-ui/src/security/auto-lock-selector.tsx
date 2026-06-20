/**
 * @wdk-starter/wdk-ui - AutoLockSelector
 *
 * Native <select>-based picker for the auto-lock idle timeout in minutes.
 * Controlled component: parent owns the value + onChange handler. Native
 * select gives free a11y, keyboard navigation, and browser-rendered
 * dropdown UX that fits any popup viewport.
 *
 * Value semantics: positive integer = idle minutes before lock fires.
 * Special sentinel: 0 = Never (auto-lock disabled).
 *
 * Layout: full-width select styled to match the wallet header buttons.
 * No icon slot for this component - the picker is textual.
 *
 * Source: B1c configurable auto-lock delay.
 */

import { type CSSProperties, type ChangeEvent } from 'react';

export interface AutoLockOption {
  readonly value: number;
  readonly label: string;
}

export interface AutoLockSelectorProps {
  readonly value: number;
  readonly options: ReadonlyArray<AutoLockOption>;
  readonly onChange: (next: number) => void;
  readonly disabled?: boolean;
}

const selectStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-body, inherit)',
  color: 'var(--text-primary, currentColor)',
  backgroundColor: 'var(--bg-elevated-2, rgba(255,255,255,0.06))',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
  borderRadius: 'var(--radius-md, 6px)',
  cursor: 'pointer',
  appearance: 'auto',
};

const disabledStyle: CSSProperties = {
  ...selectStyle,
  cursor: 'not-allowed',
  opacity: 0.55,
};

export function AutoLockSelector({
  value,
  options,
  onChange,
  disabled,
}: AutoLockSelectorProps): JSX.Element {
  function handleChange(ev: ChangeEvent<HTMLSelectElement>): void {
    const next = Number(ev.target.value);
    if (Number.isFinite(next)) onChange(next);
  }
  return (
    <select
      data-testid="auto-lock-selector"
      value={String(value)}
      onChange={handleChange}
      disabled={disabled}
      style={disabled ? disabledStyle : selectStyle}
    >
      {options.map((o) => (
        <option key={o.value} value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  );
}