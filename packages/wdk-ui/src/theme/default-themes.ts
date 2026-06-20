/**
 * @wdk-starter/wdk-ui - three preset themes shipped with v1.0.
 *
 * All values mirror packages/wdk-web-core/src/design/tailwind-tokens.ts (the
 * brand-token source of truth) for the WDK Warm theme. Cool Dark and
 * Institutional Light are derived alternative starting points for developers
 * who fork the template per Doc 33 Part II.
 *
 * Decision 8 lock (Doc 33 Part I): WDK Warm is THE DEFAULT theme. The other
 * presets exist as opt-in customization paths, NOT equal-ranked aesthetic
 * choices. Brand orange #F4642F (per /brand/BRAND_KIT_README.md, extracted from user wordmark #3 SVG fill) is canonical.
 *
 * Source: docs/phase-1/doc32-addendum-theme-expansion-phantom-patterns.md (Doc 33)
 *
 * Self-contained per Master Agent direction: no cross-package import from
 * @wdk-starter/wdk-web-core. Token values are inlined here.
 */

import type { WdkTheme } from './types.js';

/**
 * WDK Warm - THE DEFAULT theme.
 *
 * Orange-anchored warm dark surfaces. Used by:
 *   - Browser Extension popup (Bounty 1)
 *   - Next.js Template wallet default-state demo (Bounty 2)
 *   - eCommerce checkout component (Bounty 3) with reduced brand presence
 *   - Showcase site, marketing site, all public-facing artifacts
 *
 * Values mirror packages/wdk-web-core/src/design/tailwind-tokens.ts verbatim:
 *   - wdkOrange[500] = #F4642F (ANCHOR - per /brand/BRAND_KIT_README.md A3.4 sync)
 *   - darkSurfaces.* for backgrounds
 *   - darkText.* for text
 *   - darkBorders.* for borders
 *   - semantic.* for success/warning/error/info
 *   - fontFamily.* for fonts (joined to CSS-string form)
 *   - radius.* for radius
 */
export const wdkWarmTheme: WdkTheme = {
  colors: {
    primary:       '#F4642F',
    primaryHover:  '#E94816',
    primaryActive: '#C03A0E',

    bgBase:      '#0F0B08',
    bgElevated1: '#1A1410',
    bgElevated2: '#251D17',
    bgElevated3: '#30261F',

    textPrimary:   '#FAF6F0',
    textSecondary: 'rgba(250, 246, 240, 0.72)',
    textTertiary:  'rgba(250, 246, 240, 0.48)',

    borderSubtle:   'rgba(250, 246, 240, 0.06)',
    borderDefault:  'rgba(250, 246, 240, 0.10)',
    borderEmphasis: 'rgba(250, 246, 240, 0.18)',

    success: '#10B981',
    warning: '#F59E0B',
    error:   '#EF4444',
    info:    '#3B82F6',
  },
  fonts: {
    display: '"Bricolage Grotesque Variable", "Bricolage Grotesque", Recoleta, "Cooper BT", Georgia, serif',
    body:    '"Geist Variable", Geist, Inter, system-ui, sans-serif',
    mono:    '"Geist Mono Variable", "Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
  motion: 'standard',
  glass:  'standard',
  mode:   'dark',
};

/**
 * Cool Dark - Phantom-aesthetic alternative.
 *
 * Cooler dark surfaces (blue-gray undertones), purple brand. For developers
 * who fork the template and want a Phantom-like visual identity.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part III
 */
export const coolDarkTheme: WdkTheme = {
  colors: {
    primary:       '#9333EA',
    primaryHover:  '#A855F7',
    primaryActive: '#7E22CE',

    bgBase:      '#111827',
    bgElevated1: '#1F2937',
    bgElevated2: '#374151',
    bgElevated3: '#4B5563',

    textPrimary:   '#F9FAFB',
    textSecondary: 'rgba(249, 250, 251, 0.72)',
    textTertiary:  'rgba(249, 250, 251, 0.48)',

    borderSubtle:   'rgba(249, 250, 251, 0.06)',
    borderDefault:  'rgba(249, 250, 251, 0.10)',
    borderEmphasis: 'rgba(249, 250, 251, 0.18)',

    success: '#10B981',
    warning: '#F59E0B',
    error:   '#EF4444',
    info:    '#3B82F6',
  },
  fonts: {
    display: 'Inter, system-ui, sans-serif',
    body:    'Inter, system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, monospace',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  motion: 'playful',
  glass:  'subtle',
  mode:   'dark',
};

/**
 * Institutional Light - conservative light-mode preset.
 *
 * Warm-tinted white surfaces (per tailwind-tokens.ts lightSurfaces), neutral
 * gray brand. For developers building B2B or institutional-targeted forks.
 *
 * Glass: 'off' because backdrop blur looks bad on white backgrounds per
 * Doc 33 Pattern G observation.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part III
 *         + packages/wdk-web-core/src/design/tailwind-tokens.ts lightSurfaces
 */
export const institutionalLightTheme: WdkTheme = {
  colors: {
    primary:       '#1F2937',
    primaryHover:  '#374151',
    primaryActive: '#111827',

    bgBase:      '#FFFBF7',
    bgElevated1: '#FFFFFF',
    bgElevated2: '#F7F3EE',
    bgElevated3: '#EFEAE3',

    textPrimary:   '#1A1410',
    textSecondary: 'rgba(26, 20, 16, 0.72)',
    textTertiary:  'rgba(26, 20, 16, 0.48)',

    borderSubtle:   'rgba(26, 20, 16, 0.06)',
    borderDefault:  'rgba(26, 20, 16, 0.10)',
    borderEmphasis: 'rgba(26, 20, 16, 0.18)',

    success: '#10B981',
    warning: '#F59E0B',
    error:   '#EF4444',
    info:    '#3B82F6',
  },
  fonts: {
    display: '"Geist Variable", Geist, Inter, system-ui, sans-serif',
    body:    '"Geist Variable", Geist, Inter, system-ui, sans-serif',
    mono:    '"Geist Mono Variable", "Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
  },
  motion: 'subtle',
  glass:  'off',
  mode:   'light',
};

/**
 * Convenience map - all three presets keyed by short name.
 *
 * Usage:
 *   <WdkThemeProvider theme={defaultThemes.coolDark}>...</WdkThemeProvider>
 *
 * The picker UI (w-5) renders these three as the background-mode options
 * per Doc 33 Part III.1 Dimension C (Background mode).
 */
export const defaultThemes = {
  wdkWarm:            wdkWarmTheme,
  coolDark:           coolDarkTheme,
  institutionalLight: institutionalLightTheme,
} as const;

/** Alias for the canonical default - what WdkThemeProvider falls back to. */
export const defaultTheme = wdkWarmTheme;