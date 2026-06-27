/**
 * TokenIcon - token logo rendered from @web3icons/react/dynamic.
 *
 * Same pattern as NetworkIcon: dynamic entry point with a colored-chip
 * fallback for unknown tokens. The library matches by lowercased symbol.
 *
 * The headline Tether assets (USD₮ / Tether Gold) render an EMBEDDED brand mark
 * instead — so the real ₮ logo always shows, with no dependency on the dynamic
 * icon loading (which can fall back to a generic letter chip when it's slow or
 * a symbol isn't matched). USDt is the whole point of the stack; it must be right.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';
import { TokenIcon as DynamicTokenIcon } from '@web3icons/react/dynamic';

export interface TokenIconProps {
  /** Token symbol; case-insensitive. */
  readonly symbol: string;
  readonly size?: number;
  readonly variant?: 'mono' | 'branded' | 'background';
  readonly color?: string;
}

// The canonical Tether "₮" glyph (white), shared by USD₮ and Tether Gold.
const TETHER_GLYPH =
  'M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117';

/** Disc color per Tether asset (USD₮ green, Tether Gold gold). USDT0 is USD₮ on an L2. */
const TETHER_DISCS: Record<string, string> = {
  USDT: '#26A17B',
  USDT0: '#26A17B',
  XAUT: '#C7A647',
};

/** The Tether brand mark (glyph on a colored disc) as an inline SVG. */
function TetherMark({ disc, size }: { disc: string; size: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '50%', flex: '0 0 auto' }}
    >
      <circle cx="16" cy="16" r="16" fill={disc} />
      <path fill="#fff" d={TETHER_GLYPH} />
    </svg>
  );
}

function ChipFallback({ symbol, size }: { symbol: string; size: number }): JSX.Element {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h + symbol.charCodeAt(i) * 31) % 360;
  const text = symbol.slice(0, 1).toUpperCase();
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `hsl(${h}, 55%, 42%)`,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.max(7, Math.floor(size * 0.4)),
    fontWeight: 600,
    lineHeight: 1,
    verticalAlign: 'middle',
    fontFamily: 'var(--font-mono, monospace)',
  };
  return (
    <span aria-hidden="true" style={style}>
      {text}
    </span>
  );
}

export function TokenIcon({
  symbol,
  size = 16,
  variant = 'branded',
  color,
}: TokenIconProps): JSX.Element {
  // Always render the real Tether mark for USD₮ / Tether Gold (never a generic chip).
  const disc = TETHER_DISCS[symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')];
  if (disc !== undefined) return <TetherMark disc={disc} size={size} />;

  const lowered = symbol.toLowerCase();
  const fallback: ReactNode = <ChipFallback symbol={symbol} size={size} />;
  return color !== undefined
    ? <DynamicTokenIcon symbol={lowered} size={size} variant={variant} color={color} fallback={fallback} />
    : <DynamicTokenIcon symbol={lowered} size={size} variant={variant} fallback={fallback} />;
}