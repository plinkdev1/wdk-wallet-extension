/**
 * TokenIcon - token logo rendered from @web3icons/react/dynamic.
 *
 * Same pattern as NetworkIcon: dynamic entry point with a colored-chip
 * fallback for unknown tokens. The library matches by lowercased symbol.
 *
 * The headline assets (USD₮ / Tether Gold / BTC / ETH) render an EMBEDDED brand
 * mark instead — so the real, recognizable logo always shows, with no dependency
 * on the dynamic icon loading (which can fall back to a generic letter chip when
 * it's slow or a symbol isn't matched). USDt is the whole point of the stack; it
 * must be right, and the core coins shouldn't degrade to letter chips either.
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

const MARK_STYLE: CSSProperties = {
  display: 'inline-block',
  verticalAlign: 'middle',
  borderRadius: '50%',
  flex: '0 0 auto',
};

/** The official Bitcoin mark (white ₿ on #F7931A) as an inline SVG — BTC/WBTC. */
function BitcoinMark({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={MARK_STYLE}>
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        fillRule="nonzero"
        d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"
      />
    </svg>
  );
}

/** The official Ethereum diamond (white facets on #627EEA) as an inline SVG — ETH/WETH. */
function EthereumMark({ size }: { size: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={MARK_STYLE}>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff" fillRule="nonzero">
        <path fillOpacity={0.602} d="M16.498 4v8.87l7.497 3.35z" />
        <path d="M16.498 4L9 16.22l7.498-3.35z" />
        <path fillOpacity={0.602} d="M16.498 21.968v6.027L24 17.616z" />
        <path d="M16.498 27.995v-6.028L9 17.616z" />
        <path fillOpacity={0.2} d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
        <path fillOpacity={0.602} d="M9 16.22l7.498 4.353v-7.701z" />
      </g>
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
  // Always render the real brand mark for the headline assets (never a generic chip).
  const norm = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const disc = TETHER_DISCS[norm];
  if (disc !== undefined) return <TetherMark disc={disc} size={size} />;
  if (norm === 'BTC' || norm === 'WBTC') return <BitcoinMark size={size} />;
  if (norm === 'ETH' || norm === 'WETH') return <EthereumMark size={size} />;

  const lowered = symbol.toLowerCase();
  const fallback: ReactNode = <ChipFallback symbol={symbol} size={size} />;
  return color !== undefined
    ? <DynamicTokenIcon symbol={lowered} size={size} variant={variant} color={color} fallback={fallback} />
    : <DynamicTokenIcon symbol={lowered} size={size} variant={variant} fallback={fallback} />;
}