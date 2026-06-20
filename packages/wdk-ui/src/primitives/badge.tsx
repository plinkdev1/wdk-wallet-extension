/**
 * @wdk-starter/wdk-ui - Badge primitive
 *
 * Small pill-shaped status indicator. Variants map to semantic colors
 * from the theme.
 *
 * Variables: --color-primary, --color-success, --color-warning, --color-error,
 * --color-info, --bg-elevated-2, --text-primary, --bg-base, --font-body.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly variant?: BadgeVariant;
}

const variantStyle: Record<BadgeVariant, CSSProperties> = {
  default: { backgroundColor: 'var(--bg-elevated-2)', color: 'var(--text-primary)' },
  primary: { backgroundColor: 'var(--color-primary)', color: 'var(--bg-base)' },
  success: { backgroundColor: 'var(--color-success)', color: '#ffffff' },
  warning: { backgroundColor: 'var(--color-warning)', color: '#000000' },
  error:   { backgroundColor: 'var(--color-error)',   color: '#ffffff' },
  info:    { backgroundColor: 'var(--color-info)',    color: '#ffffff' },
};

const baseStyle: CSSProperties = {
  display:        'inline-flex',
  alignItems:     'center',
  justifyContent: 'center',
  padding:        '2px 8px',
  fontFamily:     'var(--font-body)',
  fontSize:       '12px',
  fontWeight:     500,
  lineHeight:     1.4,
  borderRadius:   '9999px',
  whiteSpace:     'nowrap',
  borderStyle:    'none',
};

/**
 * Pill-shaped status indicator.
 *
 * @example
 *   <Badge>v1.0</Badge>
 *   <Badge variant="success">Connected</Badge>
 *   <Badge variant="error">Failed</Badge>
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', style, ...rest }, ref) => {
    const composedStyle: CSSProperties = { ...baseStyle, ...variantStyle[variant], ...style };
    return <span ref={ref} style={composedStyle} {...rest} />;
  }
);
Badge.displayName = 'Badge';