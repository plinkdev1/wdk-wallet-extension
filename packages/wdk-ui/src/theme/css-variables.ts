/**
 * @wdk-starter/wdk-ui - CSS variable generator
 *
 * Translates a WdkTheme object into a Record<string, string> of CSS custom
 * properties. Output naming mirrors packages/wdk-web-core/src/design/tailwind-tokens.ts
 * cssVariables() convention so downstream component CSS can reference the same
 * variable names whether the vars came from build-time emission (tailwind-tokens)
 * or runtime injection (WdkThemeProvider's useEffect).
 *
 * Optional theme fields (textSecondary, textTertiary, border*) are derived from
 * textPrimary using rgba alpha overlays per tailwind-tokens.ts pattern.
 * primaryHover/primaryActive are NOT derived - if undefined the var is omitted
 * and downstream CSS can fall back to --color-primary.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part III
 *         packages/wdk-web-core/src/design/tailwind-tokens.ts (canonical token reference)
 */

import type { WdkTheme, WdkMotion, WdkGlass } from './types.js';

/**
 * Convert a hex (#RGB or #RRGGBB) or rgb()/rgba() color to rgba with the
 * specified alpha. Falls back to returning the input unchanged for color
 * formats not understood (named colors, hsl(), color() etc.) - callers
 * relying on derivation should provide hex or rgb input.
 *
 * Exported for testability and downstream reuse.
 */
export function toRgba(color: string, alpha: number): string {
  // Hex #RRGGBB
  const hexLong = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (hexLong) {
    const h = hexLong[1];
    const r = parseInt(h!.slice(0, 2), 16);
    const g = parseInt(h!.slice(2, 4), 16);
    const b = parseInt(h!.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // Hex #RGB
  const hexShort = /^#([0-9a-fA-F]{3})$/.exec(color);
  if (hexShort) {
    const h = hexShort[1];
    const r = parseInt(h![0]! + h![0]!, 16);
    const g = parseInt(h![1]! + h![1]!, 16);
    const b = parseInt(h![2]! + h![2]!, 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // rgb() / rgba() - replace alpha
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/.exec(color);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  // Unrecognized format - return unchanged
  return color;
}

/**
 * Map motion preset to CSS transition duration. Matches tailwind-tokens.ts
 * duration scale: fast=120ms (subtle), base=200ms (standard), slow=360ms (playful).
 */
function motionDuration(motion: WdkMotion): string {
  switch (motion) {
    case 'none':     return '0ms';
    case 'subtle':   return '120ms';
    case 'standard': return '200ms';
    case 'playful':  return '360ms';
  }
}

/**
 * Map glass preset to CSS backdrop-filter blur radius. Standard=20px matches
 * tailwind-tokens.ts glass.backdropFilter blur(20px).
 */
function glassBlur(glass: WdkGlass): string {
  switch (glass) {
    case 'off':      return '0px';
    case 'subtle':   return '8px';
    case 'standard': return '20px';
    case 'heavy':    return '32px';
  }
}

/**
 * Produce a Record<string, string> of CSS custom properties for the given
 * theme. Inject onto document.documentElement via WdkThemeProvider's
 * useEffect (or stringify via cssVariablesAsBlock for SSR).
 *
 * Variable naming matches tailwind-tokens.ts cssVariables(): components
 * reference var(--bg-base), var(--text-primary), etc. regardless of whether
 * those came from build-time emission or runtime provider injection.
 *
 * Variables emitted:
 *   --color-primary             from theme.colors.primary (the brand anchor)
 *   --color-primary-hover       from theme.colors.primaryHover (if defined)
 *   --color-primary-active      from theme.colors.primaryActive (if defined)
 *   --bg-base, --bg-elevated-1..3
 *   --text-primary, --text-secondary, --text-tertiary (latter two derived if omitted)
 *   --border-subtle, --border-default, --border-emphasis (derived if omitted)
 *   --color-success, --color-warning, --color-error, --color-info
 *   --font-display, --font-body, --font-mono
 *   --radius-sm, --radius-md, --radius-lg, --radius-xl
 *   --motion-duration           derived from theme.motion preset
 *   --glass-blur                derived from theme.glass preset
 */
export function cssVariables(theme: WdkTheme): Record<string, string> {
  const c = theme.colors;
  const vars: Record<string, string> = {
    // Brand primary
    '--color-primary': c.primary,

    // Surfaces
    '--bg-base':       c.bgBase,
    '--bg-elevated-1': c.bgElevated1,
    '--bg-elevated-2': c.bgElevated2,
    '--bg-elevated-3': c.bgElevated3,

    // Text - secondary/tertiary derived from primary at 72/48% alpha if omitted
    '--text-primary':   c.textPrimary,
    '--text-secondary': c.textSecondary ?? toRgba(c.textPrimary, 0.72),
    '--text-tertiary':  c.textTertiary  ?? toRgba(c.textPrimary, 0.48),

    // Borders - derived from textPrimary via rgba alpha. Light mode needs a
    // HIGHER alpha than dark: a dark border at 10% is nearly invisible on a
    // light surface, which left outline/secondary buttons completely edgeless
    // in light mode. Bumping the alpha when mode === 'light' restores visible
    // edges on light backgrounds while keeping dark mode unchanged.
    '--border-subtle':   c.borderSubtle   ?? toRgba(c.textPrimary, theme.mode === 'light' ? 0.12 : 0.06),
    '--border-default':  c.borderDefault  ?? toRgba(c.textPrimary, theme.mode === 'light' ? 0.22 : 0.10),
    '--border-emphasis': c.borderEmphasis ?? toRgba(c.textPrimary, theme.mode === 'light' ? 0.34 : 0.18),

    // Semantic
    '--color-success': c.success,
    '--color-warning': c.warning,
    '--color-error':   c.error,
    '--color-info':    c.info,

    // Fonts
    '--font-display': theme.fonts.display,
    '--font-body':    theme.fonts.body,
    '--font-mono':    theme.fonts.mono,

    // Radius
    '--radius-sm': theme.radius.sm,
    '--radius-md': theme.radius.md,
    '--radius-lg': theme.radius.lg,
    '--radius-xl': theme.radius.xl,

    // Motion + glass (derived from preset)
    '--motion-duration': motionDuration(theme.motion),
    '--glass-blur':      glassBlur(theme.glass),
  };

  // Optional primary states - only emit if defined (downstream CSS falls back to --color-primary)
  if (c.primaryHover  !== undefined) vars['--color-primary-hover']  = c.primaryHover;
  if (c.primaryActive !== undefined) vars['--color-primary-active'] = c.primaryActive;

  return vars;
}

/**
 * Render the CSS variables as a stringified CSS block for SSR injection
 * or static .css file generation. Mirrors tailwind-tokens.ts cssVariablesAsBlock().
 *
 * Use when WdkThemeProvider's runtime useEffect injection is not viable
 * (e.g. SSR'd HTML needs theme on first paint - pair with skipCssInjection
 * prop on the provider).
 */
export function cssVariablesAsBlock(theme: WdkTheme, selector: string = ':root'): string {
  const vars = cssVariables(theme);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}