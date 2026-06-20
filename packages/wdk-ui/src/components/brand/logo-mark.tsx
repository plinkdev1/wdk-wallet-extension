/**
 * LogoMark - brand-agnostic logo container for WDK products.
 *
 * Renders a brand image (URL via `src`) or arbitrary ReactNode children
 * inside a sized container with `objectFit: contain` so the source's
 * aspect ratio is preserved. Two layout modes:
 *
 *   - default (square): width === height === size preset. Use for master
 *     marks (Bold W) where the source is square.
 *   - fluid (height-driven): height === size preset, width === 'auto'.
 *     Use for wordmarks where the source has its own aspect ratio (~3:1
 *     for the WDK wordmark) and you want it to display at natural width.
 *
 * Size presets: sm=32px, md=48px, lg=64px, xl=96px.
 *
 * Consumer-facing surface (Privy/Dynamic-style brand customization). The
 * extension Welcome screen, Template Wallet header (Bounty 2), and
 * "Powered by WDK" credit in the eCommerce checkout (Bounty 3) all use
 * this same component with different `src` + `size` choices.
 */

import { forwardRef, type ReactNode, type CSSProperties } from 'react';

export type LogoMarkSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<LogoMarkSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export interface LogoMarkProps {
  /** Image source URL. Use this OR children, not both. */
  readonly src?: string;
  /** Inline SVG / other ReactNode for the mark. Alternative to src. */
  readonly children?: ReactNode;
  /** Alt text. Required when using src for accessibility (screen readers). */
  readonly alt?: string;
  /** Size preset. Defaults to 'md' (48px). */
  readonly size?: LogoMarkSize;
  /**
   * When true, container width auto-scales (width: auto). Use for wordmarks
   * with non-square aspect ratios. When false (default), container is square
   * (width === height === size). Use for master marks.
   */
  readonly fluid?: boolean;
  /** Override style for custom positioning / margin / etc. Merged last. */
  readonly style?: CSSProperties;
  /** className override. */
  readonly className?: string;
}

/**
 * LogoMark - sized container for a brand mark image.
 *
 * @example Square master mark
 *   <LogoMark src="/wdk-mark.png" alt="WDK Wallet" size="md" />
 *
 * @example Wordmark (height-driven, natural width)
 *   <LogoMark src="/wdk-wordmark.svg" alt="WDK" size="xl" fluid />
 *
 * @example Inline SVG content
 *   <LogoMark size="lg" alt="WDK"><MyInlineSvg /></LogoMark>
 */
export const LogoMark = forwardRef<HTMLSpanElement, LogoMarkProps>(
  ({ src, children, alt, size = 'md', fluid = false, style, className }, ref) => {
    const px = SIZE_PX[size];
    const containerStyle: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: px,
      width: fluid ? 'auto' : px,
      flexShrink: 0,
      ...style,
    };
    return (
      <span ref={ref} className={className} style={containerStyle}>
        {src ? (
          <img
            src={src}
            alt={alt ?? ''}
            style={{
              height: '100%',
              width: fluid ? 'auto' : '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          children
        )}
      </span>
    );
  },
);
LogoMark.displayName = 'LogoMark';