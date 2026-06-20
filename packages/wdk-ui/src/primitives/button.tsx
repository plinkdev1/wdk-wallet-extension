/**
 * @wdk-starter/wdk-ui - Button primitive
 *
 * Theme-aware button using inline styles that reference CSS variables emitted
 * by WdkThemeProvider (or by wdk-web-core's tailwind-tokens.ts cssVariablesAsBlock).
 * Variables: --color-primary, --bg-base, --bg-elevated-*, --text-primary,
 * --color-error, --radius-md, --font-body, --motion-duration, --border-default.
 *
 * Pure inline-style approach for v0.x: no Tailwind dep, no cva, no clsx,
 * no @radix-ui/react-slot. Adds these later only if a specific feature
 * genuinely needs them (e.g. asChild pattern, complex variant matrices).
 *
 * NOTE: borderless variants (primary, ghost, destructive) use the longhand
 * `borderStyle: 'none'` rather than the shorthand `border: 'none'`. jsdom
 * silently drops the shorthand from element.style during inline-style
 * parsing because 'none' alone isn't a complete border shorthand value
 * (it's only the border-style component). Longhand is unambiguous and works
 * the same in jsdom and real browsers.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

const sizeStyle: Record<ButtonSize, CSSProperties> = {
  sm:   { height: '32px', padding: '0 12px',   fontSize: '14px' },
  md:   { height: '40px', padding: '0 16px',   fontSize: '15px' },
  lg:   { height: '48px', padding: '0 24px',   fontSize: '16px' },
  icon: { height: '40px', width:   '40px',     padding:  '0',     fontSize: '15px' },
};

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: 'var(--color-primary)',
    color:           'var(--bg-base)',
    borderStyle:     'none',
  },
  secondary: {
    backgroundColor: 'var(--bg-elevated-2)',
    color:           'var(--text-primary)',
    border:          '1px solid var(--border-default)',
  },
  outline: {
    backgroundColor: 'transparent',
    color:           'var(--text-primary)',
    border:          '1px solid var(--border-default)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color:           'var(--text-primary)',
    borderStyle:     'none',
  },
  destructive: {
    backgroundColor: 'var(--color-error)',
    color:           '#ffffff',
    borderStyle:     'none',
  },
};

const baseStyle: CSSProperties = {
  display:           'inline-flex',
  alignItems:        'center',
  justifyContent:    'center',
  gap:               '8px',
  fontFamily:        'var(--font-body)',
  fontWeight:        500,
  borderRadius:      'var(--radius-md)',
  cursor:            'pointer',
  whiteSpace:        'nowrap',
  userSelect:        'none',
  transitionProperty: 'background-color, color, border-color, opacity, transform',
  transitionDuration: 'var(--motion-duration)',
  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

/**
 * Primary button primitive. Renders a native <button> with theme-driven styling.
 *
 * @example
 *   <Button variant="primary" size="md" onClick={handleClick}>Save</Button>
 *   <Button variant="destructive">Delete</Button>
 *   <Button variant="ghost" size="sm">Cancel</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', style, disabled, ...rest }, ref) => {
    const composedStyle: CSSProperties = {
      ...baseStyle,
      ...sizeStyle[size],
      ...variantStyle[variant],
      ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
      ...style,
    };
    return <button ref={ref} style={composedStyle} disabled={disabled} {...rest} />;
  }
);
Button.displayName = 'Button';