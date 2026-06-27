/**
 * TokenChip — a token's logo + symbol as one inline element.
 *
 * Drops into selector buttons and token rows so every token reads with its
 * brand: the icon container is ALWAYS rendered (a real mark for the headline
 * assets via <TokenIcon>, a deterministic colored chip for anything else), so
 * the UI is ready for any token symbol. Pure presentational; pairs with
 * <TokenIcon>.
 */

import type { CSSProperties, JSX } from 'react';
import { TokenIcon } from './token-icon.js';

export interface TokenChipProps {
  /** Token symbol; case-insensitive. */
  readonly symbol: string;
  /** Icon size in px (default 16). */
  readonly size?: number;
  /** Optional visible label (defaults to the symbol). */
  readonly label?: string;
  /** Gap between the icon and the label (default 6). */
  readonly gap?: number;
  /** Hide the text label and render the icon only. */
  readonly iconOnly?: boolean;
}

export function TokenChip({ symbol, size = 16, label, gap = 6, iconOnly = false }: TokenChipProps): JSX.Element {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap,
    lineHeight: 1,
    minWidth: 0,
  };
  return (
    <span style={style}>
      <TokenIcon symbol={symbol} size={size} />
      {!iconOnly && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label ?? symbol}</span>}
    </span>
  );
}
