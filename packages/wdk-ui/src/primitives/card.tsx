/**
 * @wdk-starter/wdk-ui - Card primitive
 *
 * Theme-aware surface container using inline styles that reference CSS variables
 * emitted by WdkThemeProvider. Variants:
 *   flat     - bg-elevated-1 + subtle border, no shadow
 *   elevated - bg-elevated-1 + default border + medium shadow (overlap stack)
 *   glass    - bg-elevated-1 + backdrop-filter blur (per theme.glass preset)
 *
 * Variables: --bg-elevated-1, --border-subtle, --border-default, --radius-lg,
 * --text-primary, --glass-blur (only used by glass variant).
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 *         + Doc 33 Pattern G "Glass-card surface" (theme.glass driven)
 */

import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';

export type CardVariant = 'flat' | 'elevated' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: CardVariant;
  readonly padding?: CardPadding;
}

const paddingStyle: Record<CardPadding, CSSProperties> = {
  none: { padding: '0px'  },
  sm:   { padding: '12px' },
  md:   { padding: '20px' },
  lg:   { padding: '32px' },
};

const variantStyle: Record<CardVariant, CSSProperties> = {
  flat: {
    backgroundColor: 'var(--bg-elevated-1)',
    border:          '1px solid var(--border-subtle)',
  },
  elevated: {
    backgroundColor: 'var(--bg-elevated-1)',
    border:          '1px solid var(--border-default)',
    boxShadow:       'var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.2))',
  },
  glass: {
    backgroundColor: 'var(--bg-elevated-1)',
    backdropFilter:  'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border:          '1px solid var(--border-subtle)',
  },
};

const baseStyle: CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  color:        'var(--text-primary)',
  fontFamily:   'var(--font-body)',
};

/**
 * Surface container primitive. Use for grouping content into visually distinct
 * regions on a page.
 *
 * @example
 *   <Card variant="elevated" padding="md">
 *     <h2>Wallet</h2>
 *     <p>Balance: 1.234 ETH</p>
 *   </Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'flat', padding = 'md', style, ...rest }, ref) => {
    const composedStyle: CSSProperties = {
      ...baseStyle,
      ...paddingStyle[padding],
      ...variantStyle[variant],
      ...style,
    };
    return <div ref={ref} style={composedStyle} {...rest} />;
  }
);
Card.displayName = 'Card';