/**
 * TokenIcon - token logo rendered from @web3icons/react/dynamic.
 *
 * Same pattern as NetworkIcon: dynamic entry point with a colored-chip
 * fallback for unknown tokens. The library matches by lowercased symbol.
 */

import type { CSSProperties, ReactNode } from 'react';
import { TokenIcon as DynamicTokenIcon } from '@web3icons/react/dynamic';

export interface TokenIconProps {
  /** Token symbol; case-insensitive. */
  readonly symbol: string;
  readonly size?: number;
  readonly variant?: 'mono' | 'branded' | 'background';
  readonly color?: string;
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
  const lowered = symbol.toLowerCase();
  const fallback: ReactNode = <ChipFallback symbol={symbol} size={size} />;
  return color !== undefined
    ? <DynamicTokenIcon symbol={lowered} size={size} variant={variant} color={color} fallback={fallback} />
    : <DynamicTokenIcon symbol={lowered} size={size} variant={variant} fallback={fallback} />;
}