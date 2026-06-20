/**
 * WDK design tokens v2 — WDK orange brand recalibration.
 *
 * Source of truth for principles: docs/phase-1/design-system.md (v2).
 * Source of truth for values: this file.
 *
 * Architecture (unchanged from v1 intent; values shift only):
 *   raw constants (palettes, surfaces, ...) ─┐
 *                                            ├─► tailwindTheme()           ─► product tailwind.config.ts
 *                                            └─► cssVariables() / Block()  ─► product globals.css
 *
 * Brand orange #F4642F per /brand/BRAND_KIT_README.md (extracted from user
 * wordmark #3 source SVG fill). Supersedes #FF5722 (Master Agent's eyeball
 * estimate) and the prior #F4642F (logo measurement) - A3.4 sync.
 *
 * See: docs/phase-1/design-system.md Parts III/IV/V/VII/XII
 */

// ────────────────────────────────────────────────────────────────────
// Color palettes
// ────────────────────────────────────────────────────────────────────

export const wdkOrange = {
  50:  '#FFF4ED',
  100: '#FFE6D5',
  200: '#FFC9A4',
  300: '#FFA672',
  400: '#FF8240',
  500: '#F4642F', // ANCHOR — per /brand/BRAND_KIT_README.md (A3.4 sync)
  600: '#E94816',
  700: '#C03A0E',
  800: '#8F2C0A',
  900: '#621D06',
} as const;

export const darkSurfaces = {
  base:      '#0F0B08',
  elevated1: '#1A1410',
  elevated2: '#251D17',
  elevated3: '#30261F',
  glass:     'rgba(37, 29, 23, 0.65)',
} as const;

export const lightSurfaces = {
  base:      '#FFFBF7',
  elevated1: '#FFFFFF',
  elevated2: '#F7F3EE',
  elevated3: '#EFEAE3',
  glass:     'rgba(255, 251, 247, 0.75)',
} as const;

export const darkText = {
  primary:   '#FAF6F0',
  secondary: 'rgba(250, 246, 240, 0.72)',
  tertiary:  'rgba(250, 246, 240, 0.48)',
  disabled:  'rgba(250, 246, 240, 0.28)',
} as const;

export const lightText = {
  primary:   '#1A1410',
  secondary: 'rgba(26, 20, 16, 0.72)',
  tertiary:  'rgba(26, 20, 16, 0.48)',
  disabled:  'rgba(26, 20, 16, 0.28)',
} as const;

export const darkBorders = {
  subtle:   'rgba(250, 246, 240, 0.06)',
  default:  'rgba(250, 246, 240, 0.10)',
  emphasis: 'rgba(250, 246, 240, 0.18)',
  brand:    '#F4642F',
} as const;

export const lightBorders = {
  subtle:   'rgba(26, 20, 16, 0.06)',
  default:  'rgba(26, 20, 16, 0.10)',
  emphasis: 'rgba(26, 20, 16, 0.18)',
  brand:    '#F4642F',
} as const;

export const semantic = {
  success: '#10B981', // emerald-500 — distinct from brand orange and from Tether green
  warning: '#F59E0B', // amber-500 — different hue family than brand orange
  error:   '#EF4444', // red-500
  info:    '#3B82F6', // blue-500
} as const;

/**
 * Tether corporate green — reserved for credit-line usage only.
 * Constraint: appears in less than 5% pixel area of any surface.
 * NEVER used as primary accent, button color, or surface fill.
 */
export const tetherMark = {
  green: '#26A17B',
} as const;

/**
 * Canonical brand-identity colors from /brand/BRAND_KIT_README.md.
 * Extracted by the user from wordmark #3 source SVG fill attributes
 * (and bracket-interlock #7 for the brown).
 *
 * Use for brand-heavy surfaces (splash, "powered by WDK" credits,
 * brand-mark backgrounds). For everyday product UI use darkSurfaces /
 * lightSurfaces above (which are accessibility-tuned for text contrast).
 *
 * brandIdentity.orange mirrors wdkOrange[500] - exists for code that
 * prefers brand color by NAME (.orange) over ramp position ([500]).
 */
export const brandIdentity = {
  orange:   '#F4642F', // canonical brand orange (== wdkOrange[500])
  warmDark: '#161312', // wordmark #3 background fill
  cream:    '#F7EEE8', // wordmark #3 text/accent fill
  brown:    '#6B3A1E', // bracket interlock #7 source fill
} as const;

export const gradients = {
  brand:   'linear-gradient(135deg, #F4642F 0%, #E94816 50%, #C03A0E 100%)',
  warmth:  'linear-gradient(180deg, #0F0B08 0%, #1A1410 50%, #251D17 100%)',
  surface: 'linear-gradient(135deg, rgba(244, 100, 47, 0.08) 0%, rgba(244, 100, 47, 0.02) 100%)',
} as const;

export const darkShadows = {
  sm:           '0 1px 2px rgba(0, 0, 0, 0.5)',
  md:           '0 4px 12px rgba(0, 0, 0, 0.6)',
  lg:           '0 12px 32px rgba(0, 0, 0, 0.7)',
  xl:           '0 24px 64px rgba(0, 0, 0, 0.8)',
  'glow-brand': '0 0 40px rgba(244, 100, 47, 0.35)',
  'glow-warm':  '0 0 60px rgba(244, 100, 47, 0.15)',
} as const;

export const lightShadows = {
  sm:           '0 1px 2px rgba(26, 20, 16, 0.06)',
  md:           '0 4px 12px rgba(26, 20, 16, 0.10)',
  lg:           '0 12px 32px rgba(26, 20, 16, 0.14)',
  xl:           '0 24px 64px rgba(26, 20, 16, 0.18)',
  'glow-brand': '0 0 40px rgba(244, 100, 47, 0.30)',
  'glow-warm':  '0 0 60px rgba(244, 100, 47, 0.12)',
} as const;

export const glass = {
  dark: {
    background:           'rgba(37, 29, 23, 0.65)',
    backdropFilter:       'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border:               '1px solid rgba(250, 246, 240, 0.10)',
    boxShadow:            '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  light: {
    background:           'rgba(255, 251, 247, 0.75)',
    backdropFilter:       'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border:               '1px solid rgba(26, 20, 16, 0.06)',
    boxShadow:            '0 8px 32px rgba(26, 20, 16, 0.14)',
  },
} as const;

// ────────────────────────────────────────────────────────────────────
// Typography
// ────────────────────────────────────────────────────────────────────

export const fontFamily = {
  display: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Recoleta', 'Cooper BT', 'Georgia', 'serif'],
  sans:    ['Geist Variable', 'Geist', 'Inter', 'system-ui', 'sans-serif'],
  mono:    ['Geist Mono Variable', 'Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
} as const;

export const fontSize = {
  'display-2xl': ['4.5rem',    { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-0.02em' }],
  'display-xl':  ['3.5rem',    { lineHeight: '1.05', fontWeight: '700', letterSpacing: '-0.02em' }],
  'display-lg':  ['2.75rem',   { lineHeight: '1.1',  fontWeight: '700', letterSpacing: '-0.02em' }],
  'display-md':  ['2.25rem',   { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.01em' }],
  'display-sm':  ['1.75rem',   { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.01em' }],
  'heading-lg':  ['1.375rem',  { lineHeight: '1.3',  fontWeight: '600' }],
  'heading-md':  ['1.125rem',  { lineHeight: '1.4',  fontWeight: '600' }],
  'heading-sm':  ['1rem',      { lineHeight: '1.4',  fontWeight: '600' }],
  'body-lg':     ['1.125rem',  { lineHeight: '1.5',  fontWeight: '400' }],
  'body':        ['1rem',      { lineHeight: '1.5',  fontWeight: '400' }],
  'body-sm':     ['0.875rem',  { lineHeight: '1.5',  fontWeight: '400' }],
  'caption':     ['0.75rem',   { lineHeight: '1.4',  fontWeight: '400' }],
  'micro':       ['0.6875rem', { lineHeight: '1.3',  fontWeight: '500' }],
  'mono-lg':     ['1rem',      { lineHeight: '1.5',  fontWeight: '400' }],
  'mono':        ['0.875rem',  { lineHeight: '1.5',  fontWeight: '400' }],
  'mono-sm':     ['0.75rem',   { lineHeight: '1.5',  fontWeight: '400' }],
} as const;

// ────────────────────────────────────────────────────────────────────
// Motion + geometry
// ────────────────────────────────────────────────────────────────────

export const duration = {
  fast:   '120ms',
  base:   '200ms',
  slow:   '360ms',
  slower: '600ms',
} as const;

export const easing = {
  out:      'cubic-bezier(0.16, 1, 0.3, 1)',
  'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export const radius = {
  sm:    '6px',
  md:    '10px',
  lg:    '14px',
  xl:    '20px',
  '2xl': '28px',
  full:  '9999px',
} as const;

export const spacing = {
  '0':   '0',
  '0.5': '0.125rem',
  '1':   '0.25rem',
  '1.5': '0.375rem',
  '2':   '0.5rem',
  '3':   '0.75rem',
  '4':   '1rem',
  '5':   '1.25rem',
  '6':   '1.5rem',
  '8':   '2rem',
  '10':  '2.5rem',
  '12':  '3rem',
  '16':  '4rem',
  '20':  '5rem',
  '24':  '6rem',
} as const;

// ────────────────────────────────────────────────────────────────────
// Surface presets (per-product variants)
// ────────────────────────────────────────────────────────────────────

/**
 * eCommerce checkout component preset (Bounty 3 — PRD 03).
 * Lighter brand presence than our own surfaces — we are a guest
 * in the merchant's UX. Adapts to merchant's light/dark mode.
 */
export const ecommerceCheckoutPreset = {
  dark: {
    background:  'var(--bg-elevated-1)',
    border:      '1px solid var(--border-default)',
    accentColor: '#F4642F',
    footerNote:  'rgba(250, 246, 240, 0.48)',
  },
  light: {
    background:  'var(--bg-elevated-1)',
    border:      '1px solid var(--border-default)',
    accentColor: '#F4642F',
    footerNote:  'rgba(26, 20, 16, 0.48)',
  },
} as const;

// ────────────────────────────────────────────────────────────────────
// Helpers — Tailwind theme + CSS variable producers
// ────────────────────────────────────────────────────────────────────

/**
 * Produce the Tailwind theme extension for product `tailwind.config.ts`.
 * Spread the result into `theme.extend`.
 */
export function tailwindTheme() {
  return {
    colors: {
      'wdk-orange':  wdkOrange,
      semantic:      semantic,
      'tether-mark': tetherMark,
    },
    fontFamily,
    fontSize,
    borderRadius:             radius,
    spacing,
    transitionDuration:       duration,
    transitionTimingFunction: easing,
    backgroundImage: {
      'gradient-brand':   gradients.brand,
      'gradient-warmth':  gradients.warmth,
      'gradient-surface': gradients.surface,
    },
  } as const;
}

/**
 * Produce CSS variables for the given mode. Returns a plain object
 * suitable for inline style injection or stringification.
 */
export function cssVariables(mode: 'dark' | 'light'): Record<string, string> {
  const surfaces = mode === 'dark' ? darkSurfaces : lightSurfaces;
  const text     = mode === 'dark' ? darkText     : lightText;
  const borders  = mode === 'dark' ? darkBorders  : lightBorders;
  const shadows  = mode === 'dark' ? darkShadows  : lightShadows;

  return {
    '--bg-base':         surfaces.base,
    '--bg-elevated-1':   surfaces.elevated1,
    '--bg-elevated-2':   surfaces.elevated2,
    '--bg-elevated-3':   surfaces.elevated3,
    '--bg-glass':        surfaces.glass,

    '--text-primary':    text.primary,
    '--text-secondary':  text.secondary,
    '--text-tertiary':   text.tertiary,
    '--text-disabled':   text.disabled,

    '--border-subtle':   borders.subtle,
    '--border-default':  borders.default,
    '--border-emphasis': borders.emphasis,
    '--border-brand':    borders.brand,

    '--shadow-sm':         shadows.sm,
    '--shadow-md':         shadows.md,
    '--shadow-lg':         shadows.lg,
    '--shadow-xl':         shadows.xl,
    '--shadow-glow-brand': shadows['glow-brand'],
    '--shadow-glow-warm':  shadows['glow-warm'],

    '--wdk-orange-500':  wdkOrange[500],
    '--wdk-orange-600':  wdkOrange[600],
    '--wdk-orange-700':  wdkOrange[700],

    '--font-display':    fontFamily.display.join(', '),
    '--font-sans':       fontFamily.sans.join(', '),
    '--font-mono':       fontFamily.mono.join(', '),
  };
}

/**
 * Render CSS variables for a mode as a selector block.
 * Drop into product globals.css (Next.js) or popup.css (extension).
 */
export function cssVariablesAsBlock(mode: 'dark' | 'light'): string {
  const selector = mode === 'dark' ? ':root' : ':root[data-theme="light"]';
  const vars = cssVariables(mode);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}