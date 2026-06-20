/**
 * @wdk-starter/wdk-ui - Separator primitive
 *
 * Horizontal or vertical 1px divider line. Uses --border-default color.
 *
 * Implements WAI-ARIA separator role. Decorative usage should set
 * decorative={true} which omits the role + sets aria-hidden.
 *
 * Variables: --border-default.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  readonly orientation?: SeparatorOrientation;
  /** If true, omits role="separator" and adds aria-hidden (decorative-only). */
  readonly decorative?: boolean;
}

/**
 * Theme-aware divider primitive. Horizontal by default.
 *
 * @example
 *   <Separator />
 *   <Separator orientation="vertical" />
 *   <Separator decorative />
 */
export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', decorative = false, style, ...rest }, ref) => {
    const isHorizontal = orientation === 'horizontal';
    const composedStyle: CSSProperties = {
      backgroundColor: 'var(--border-default)',
      width:           isHorizontal ? '100%' : '1px',
      height:          isHorizontal ? '1px'  : '100%',
      ...style,
    };
    const ariaProps = decorative
      ? { 'aria-hidden': true as const }
      : { role: 'separator' as const, 'aria-orientation': orientation };
    return <div ref={ref} style={composedStyle} {...ariaProps} {...rest} />;
  }
);
Separator.displayName = 'Separator';