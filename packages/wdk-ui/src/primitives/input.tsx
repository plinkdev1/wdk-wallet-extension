/**
 * @wdk-starter/wdk-ui - Input primitive
 *
 * Theme-aware text input using inline styles + CSS variables emitted by
 * WdkThemeProvider. Wraps native HTMLInputElement; all native input
 * attributes pass through.
 *
 * Variables: --bg-elevated-1, --text-primary, --border-default, --color-error,
 * --color-primary, --radius-md, --font-body, --motion-duration.
 *
 * Native `size` attribute is shadowed by our variant-style size prop -
 * use Omit to drop the native one. Consumers needing native size (character
 * width hint) can use HTML attribute via spread: `<Input {...{ size: 20 }} />`.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, type InputHTMLAttributes, type CSSProperties } from 'react';

export type InputVariant = 'default' | 'error';
export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly variant?: InputVariant;
  readonly size?: InputSize;
}

const sizeStyle: Record<InputSize, CSSProperties> = {
  sm: { height: '32px', padding: '0 10px', fontSize: '14px' },
  md: { height: '40px', padding: '0 14px', fontSize: '15px' },
  lg: { height: '48px', padding: '0 18px', fontSize: '16px' },
};

const variantBorder: Record<InputVariant, string> = {
  default: 'var(--border-default)',
  error:   'var(--color-error)',
};

const baseStyle: CSSProperties = {
  display:          'block',
  width:            '100%',
  boxSizing:        'border-box',
  minWidth:         0,
  overflow:         'hidden',
  whiteSpace:       'nowrap',
  textOverflow:     'ellipsis',
  backgroundColor:  'var(--bg-elevated-1)',
  color:            'var(--text-primary)',
  fontFamily:       'var(--font-body)',
  borderRadius:     'var(--radius-md)',
  borderWidth:      '1px',
  borderStyle:      'solid',
  outline:          'none',
  transitionProperty: 'border-color, box-shadow',
  transitionDuration: 'var(--motion-duration)',
};

/**
 * Native text input primitive. Theme-aware styling via CSS variables.
 *
 * @example
 *   <Input placeholder="0x..." />
 *   <Input variant="error" value={invalid} onChange={...} />
 *   <Input size="lg" type="password" />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = 'default', size = 'md', style, ...rest }, ref) => {
    const composedStyle: CSSProperties = {
      ...baseStyle,
      ...sizeStyle[size],
      borderColor: variantBorder[variant],
      ...style,
    };
    return <input ref={ref} style={composedStyle} {...rest} />;
  }
);
Input.displayName = 'Input';