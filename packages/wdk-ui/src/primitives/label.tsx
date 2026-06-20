/**
 * @wdk-starter/wdk-ui - Label primitive
 *
 * Theme-aware <label> wrapper. Optional required indicator (asterisk).
 *
 * Variables: --text-primary, --color-error, --font-body.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, type LabelHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** If true, appends a red asterisk after children. */
  readonly required?: boolean;
  readonly children?: ReactNode;
}

const baseStyle: CSSProperties = {
  display:    'inline-block',
  color:      'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize:   '14px',
  lineHeight: 1.4,
};

const asteriskStyle: CSSProperties = {
  color:       'var(--color-error)',
  marginLeft:  '4px',
};

/**
 * Form label primitive. Theme-aware. Optional required asterisk.
 *
 * @example
 *   <Label htmlFor="email">Email address</Label>
 *   <Label htmlFor="amount" required>Amount</Label>
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, children, style, ...rest }, ref) => {
    const composedStyle: CSSProperties = { ...baseStyle, ...style };
    return (
      <label ref={ref} style={composedStyle} {...rest}>
        {children}
        {required ? <span aria-hidden="true" style={asteriskStyle}>*</span> : null}
      </label>
    );
  }
);
Label.displayName = 'Label';