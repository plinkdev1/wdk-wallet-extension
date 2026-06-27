/**
 * AmountInput — the headline amount entry for Send / Swap / on-ramp (PRD §3.1).
 *
 * A large, controlled numeric field whose canonical value is ALWAYS the crypto
 * amount (so a consumer's submit logic stays trivial — it reads one decimal
 * string). When a unit price is supplied it gains the two pro-wallet affordances
 * users expect:
 *   • a fiat⇄crypto flip (⇅) — type in dollars, the crypto amount tracks (and
 *     vice-versa), with the converse shown beneath;
 *   • a "Max" chip that fills the supplied spendable balance.
 *
 * Pure, framework-free, theme-token-driven. No app/engine imports.
 */

import { useState, type CSSProperties, type JSX } from 'react';

export interface AmountInputProps {
  /** Canonical crypto amount as a decimal string (the value you submit). */
  readonly value: string;
  /** Called with the new crypto amount string on every edit / Max / flip. */
  readonly onChange: (value: string) => void;
  /** Crypto asset symbol, e.g. "ETH". */
  readonly symbol: string;
  /** Price of one whole unit in `fiatCurrency`. Enables the fiat flip + preview. */
  readonly usdPrice?: number;
  /** Spendable max as a crypto decimal string; renders a "Max" chip when set. */
  readonly max?: string;
  /** ISO currency for the fiat side (default "USD"). */
  readonly fiatCurrency?: string;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  readonly 'aria-label'?: string;
}

const NUM = /^[0-9]*\.?[0-9]*$/;

function toNum (s: string): number {
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Trim a float to <=8 dp without exponent / trailing-zero noise. */
function trimCrypto (n: number): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function formatFiat (n: number, currency: string): string {
  if (!Number.isFinite(n)) return '—';
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency });
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function AmountInput ({
  value, onChange, symbol, usdPrice, max,
  fiatCurrency = 'USD', placeholder = '0.0', autoFocus, disabled, ...rest
}: AmountInputProps): JSX.Element {
  const priced = typeof usdPrice === 'number' && Number.isFinite(usdPrice) && usdPrice > 0;
  const [mode, setMode] = useState<'crypto' | 'fiat'>('crypto');
  // In fiat mode the box owns what the user typed; the crypto `value` is derived.
  const [fiatEntry, setFiatEntry] = useState('');
  const fiat = mode === 'fiat';

  function handleType (raw: string) {
    if (raw !== '' && !NUM.test(raw)) return; // reject non-numeric keystrokes
    if (!fiat) { onChange(raw); return; }
    setFiatEntry(raw);
    const f = toNum(raw);
    onChange(raw === '' || !Number.isFinite(f) ? '' : trimCrypto(f / (usdPrice as number)));
  }

  function flip () {
    if (!priced) return;
    if (fiat) {
      setMode('crypto');
    } else {
      const f = toNum(value);
      setFiatEntry(Number.isFinite(f) ? String(+(f * (usdPrice as number)).toFixed(2)) : '');
      setMode('fiat');
    }
  }

  function applyMax () {
    if (max === undefined) return;
    onChange(max);
    if (fiat) {
      const f = toNum(max);
      setFiatEntry(Number.isFinite(f) ? String(+(f * (usdPrice as number)).toFixed(2)) : '');
    }
  }

  const shown = fiat ? fiatEntry : value;
  const primaryUnit = fiat ? fiatCurrency : symbol;
  const converse = priced
    ? (fiat
        ? `≈ ${value || '0'} ${symbol}`
        : `≈ ${formatFiat(toNum(value || '0') * (usdPrice as number), fiatCurrency)}`)
    : null;

  return (
    <div style={wrap}>
      <div style={row}>
        <input
          value={shown}
          onChange={(e) => handleType(e.target.value)}
          placeholder={placeholder}
          inputMode="decimal"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={rest['aria-label'] ?? `Amount in ${primaryUnit}`}
          style={input}
        />
        <span style={unit}>{primaryUnit}</span>
        {max !== undefined && (
          <button type="button" onClick={applyMax} disabled={disabled} style={maxBtn}>Max</button>
        )}
        {priced && (
          <button type="button" onClick={flip} disabled={disabled} aria-label="Switch amount currency" style={flipBtn}>⇅</button>
        )}
      </div>
      {converse && <div style={sub}>{converse}</div>}
    </div>
  );
}

const wrap: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  background: 'var(--bg-elevated-1, #1a1614)',
  border: '1px solid var(--border-default, #332c28)',
  borderRadius: 'var(--radius-md, 10px)', padding: '12px 14px',
};
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const input: CSSProperties = {
  flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
  color: 'var(--text-primary, #f5efe9)', fontSize: 28, fontWeight: 600, fontFamily: 'inherit',
};
const unit: CSSProperties = { fontSize: 15, fontWeight: 600, color: 'var(--text-secondary, #b3a79f)' };
const maxBtn: CSSProperties = {
  border: '1px solid var(--border-default, #332c28)', background: 'transparent',
  color: 'var(--accent, var(--wdk-orange, #F4642F))', borderRadius: 999,
  padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const flipBtn: CSSProperties = {
  border: 'none', background: 'var(--bg-elevated-2, #241f1c)', color: 'var(--text-secondary, #b3a79f)',
  borderRadius: 8, width: 30, height: 30, fontSize: 16, cursor: 'pointer', lineHeight: 1,
};
const sub: CSSProperties = { fontSize: 13, color: 'var(--text-secondary, #b3a79f)' };
