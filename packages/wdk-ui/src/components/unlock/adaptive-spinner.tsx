/**
 * AdaptiveSpinner - F-WEBCRYPTO-01 pattern.
 *
 * Background: on modern hardware with native WebCrypto acceleration,
 * PBKDF2 at 600k iterations (ADR-002 KDF_PARAMS) completes in ~100-200ms.
 * The unlock UX should feel instant in that case. On older or throttled
 * hardware where PBKDF2 takes longer (sometimes 1-3 seconds), a spinner
 * is warranted - but appearing-then-disappearing for sub-300ms operations
 * produces UI flicker that feels jankier than no spinner at all.
 *
 * The adaptive pattern: defer rendering the spinner until `pending` has
 * been true for `delayMs` (default 300). If `pending` flips back to false
 * before the timer fires, the spinner never appears - clean instant UX.
 * If the timer fires while still pending, the spinner appears and stays
 * until `pending` becomes false.
 *
 * Source: F-WEBCRYPTO-01, documented in ADR-002 (Vault) "Adaptive spinner
 * pattern" implementation section. The 300ms threshold was chosen as the
 * standard "perceived as instant" upper bound - operations faster than
 * this don't need explicit progress UI.
 *
 * Usage:
 *   const [pending, setPending] = useState(false);
 *   <AdaptiveSpinner pending={pending} />
 *
 * The component is unstyled-by-default for theme portability; consumers
 * can pass `label` or wrap in their own styled container. The bundled
 * visual is intentionally minimal (a single rotating dot) so it works in
 * popup-tight layouts without dominating the surface.
 */

import { useEffect, useState } from 'react';

export interface AdaptiveSpinnerProps {
  readonly pending: boolean;
  /** Threshold in ms before the spinner is allowed to render. Default: 300 (F-WEBCRYPTO-01). */
  readonly delayMs?: number;
  /** Optional accessible label. Defaults to "Working...". */
  readonly label?: string;
}

export function AdaptiveSpinner(props: AdaptiveSpinnerProps): JSX.Element | null {
  const { pending, delayMs = 300, label = 'Working...' } = props;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: 'var(--text-primary)',
        opacity: 0.72,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          animation: 'wdk-spin 700ms linear infinite',
        }}
      />
      <span>{label}</span>
      <style>{`@keyframes wdk-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}