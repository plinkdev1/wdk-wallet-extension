/**
 * @wdk-starter/wdk-ui - Skeleton primitive
 *
 * Loading-state placeholder. Pulses opacity via CSS keyframes.
 *
 * Keyframes are injected into document.head via useEffect on first mount,
 * idempotent via id check. This is the canonical pattern for component-scoped
 * @keyframes without bringing in a CSS-in-JS runtime.
 *
 * Variables: --bg-elevated-2, --radius-sm.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part II
 */

import { forwardRef, useEffect, type HTMLAttributes, type CSSProperties } from 'react';

const KEYFRAMES_ID = 'wdk-skeleton-keyframes';
const KEYFRAMES_CSS = `
@keyframes wdk-skeleton-pulse {
  0%   { opacity: 1; }
  50%  { opacity: 0.5; }
  100% { opacity: 1; }
}
`;

function injectKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = KEYFRAMES_CSS;
  document.head.appendChild(style);
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width as CSS length string. Defaults to '100%'. */
  readonly width?: string;
  /** Height as CSS length string. Defaults to '1em'. */
  readonly height?: string;
  /** Disable the pulse animation (static placeholder). */
  readonly static?: boolean;
}

const baseStyle: CSSProperties = {
  display:         'block',
  backgroundColor: 'var(--bg-elevated-2)',
  borderRadius:    'var(--radius-sm)',
};

/**
 * Loading placeholder primitive. Animated opacity pulse by default.
 *
 * @example
 *   <Skeleton width="200px" height="20px" />
 *   <Skeleton height="120px" />
 *   <Skeleton static height="40px" />   // no animation
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ width = '100%', height = '1em', static: isStatic = false, style, ...rest }, ref) => {
    useEffect(() => {
      if (!isStatic) injectKeyframes();
    }, [isStatic]);

    const composedStyle: CSSProperties = {
      ...baseStyle,
      width,
      height,
      ...(isStatic ? {} : {
        animationName:           'wdk-skeleton-pulse',
        animationDuration:       '1.6s',
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
      }),
      ...style,
    };
    return <div ref={ref} style={composedStyle} aria-busy="true" aria-live="polite" {...rest} />;
  }
);
Skeleton.displayName = 'Skeleton';