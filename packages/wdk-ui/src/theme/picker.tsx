/**
 * @wdk-starter/wdk-ui - ThemePicker component
 *
 * In-app theme customization picker per Doc 33 Part III.2 (Phantom pattern).
 *
 * Three independent dimensions:
 *   - 7 primary color swatches (anchor: WDK Warm #F4642F; plus 6 more)
 *   - 4 edge styles (sharp / soft / rounded / pill - maps to radius scale)
 *   - 2 modes (light / dark)
 *
 * Controlled component: takes `value: WdkTheme` + `onChange: (theme) => void`.
 * Derives selection state by comparing value against the option constants.
 * Composes the new theme on selection by shallow-merging the chosen dimension
 * over the base theme.
 *
 * Persistence is opt-in via the companion useThemePicker hook (see
 * ./use-theme-picker.ts).
 *
 * Source: docs/phase-1/doc32-addendum-theme-expansion-phantom-patterns.md (Doc 33)
 */

import { type CSSProperties, type JSX } from 'react';
import { type WdkTheme, type WdkThemeRadius, type WdkMode } from './types.js';
import { Button } from '../primitives/button.js';

// --- Option constants ---

export interface PrimarySwatch {
  readonly id: string;
  readonly color: string;
  readonly label: string;
}

/** 7 primary color swatches. WDK Warm is the anchor (id=warm-orange). */
export const PRIMARY_SWATCHES: ReadonlyArray<PrimarySwatch> = [
  { id: 'warm-orange',   color: '#F4642F', label: 'Warm Orange' },
  { id: 'cool-purple',   color: '#9333EA', label: 'Cool Purple' },
  { id: 'crimson',       color: '#DC2626', label: 'Crimson' },
  { id: 'forest',        color: '#16A34A', label: 'Forest' },
  { id: 'azure',         color: '#0EA5E9', label: 'Azure' },
  { id: 'sunshine',      color: '#EAB308', label: 'Sunshine' },
  { id: 'institutional', color: '#1F2937', label: 'Institutional' },
];

export interface EdgeStyle {
  readonly id: string;
  readonly label: string;
  readonly radius: WdkThemeRadius;
}

/** 4 edge styles. Each maps to a complete radius scale. */
export const EDGE_STYLES: ReadonlyArray<EdgeStyle> = [
  { id: 'sharp',   label: 'Sharp',   radius: { sm: '0px',  md: '0px',  lg: '0px',  xl: '0px' } },
  { id: 'soft',    label: 'Soft',    radius: { sm: '4px',  md: '6px',  lg: '8px',  xl: '12px' } },
  { id: 'rounded', label: 'Rounded', radius: { sm: '8px',  md: '12px', lg: '16px', xl: '24px' } },
  { id: 'pill',    label: 'Pill',    radius: { sm: '12px', md: '24px', lg: '36px', xl: '48px' } },
];

export interface ModeOption {
  readonly id: WdkMode;
  readonly label: string;
}

/** 2 modes. System mode (auto-resolve via prefers-color-scheme) deferred to v0.8. */
export const MODES: ReadonlyArray<ModeOption> = [
  { id: 'light', label: 'Light' },
  { id: 'dark',  label: 'Dark' },
];

// --- Selection derivation ---

/** Find the swatch matching a primary color, or null if no match. */
export function findSwatchByColor(color: string): PrimarySwatch | null {
  const normalized = color.toLowerCase();
  return PRIMARY_SWATCHES.find((s) => s.color.toLowerCase() === normalized) ?? null;
}

/** Find the edge style matching a radius scale (deep equality), or null. */
export function findEdgeByRadius(radius: WdkThemeRadius): EdgeStyle | null {
  return EDGE_STYLES.find((e) =>
    e.radius.sm === radius.sm &&
    e.radius.md === radius.md &&
    e.radius.lg === radius.lg &&
    e.radius.xl === radius.xl
  ) ?? null;
}

// --- Theme composition ---

/**
 * Mode-aware bg + text palette overlays. Applied by composeTheme depending
 * on `mode`. Borders and secondary/tertiary text are NOT specified here
 * because css-variables.ts derives them from textPrimary at runtime via
 * rgba alpha overlays - changing textPrimary cascades automatically.
 *
 * These palettes intentionally use Tailwind neutral / zinc scales so they
 * read as "obviously light" and "obviously dark" regardless of the user's
 * chosen primary swatch or any custom-hex override.
 *
 * B0c.future: a per-color custom-hex picker (background, button surface,
 * placeholder) will layer over these in a separate code path so devs can
 * fully tune each surface beyond the two presets.
 */
const LIGHT_PALETTE = {
  bgBase:      '#F8F8F7',  // warm soft off-white - eases the harsh-white edge
  bgElevated1: '#FFFFFF',  // raised card tier - pops visibly against off-white base
  bgElevated2: '#EAEAE8',  // mid surface - inputs + buttons clearly visible here
  bgElevated3: '#D6D5D2',  // emphasis tier - hover + focus states
  textPrimary: '#1C1B17',  // warm near-black - less clinical than zinc-900
} as const;

const DARK_PALETTE = {
  bgBase:      '#0A0A0A',
  bgElevated1: '#171717',
  bgElevated2: '#262626',
  bgElevated3: '#404040',
  textPrimary: '#FAFAFA',
} as const;

/**
 * Compose a new theme by overriding the 3 picker dimensions.
 *
 * Mode behavior (B0c fix): when `mode` is 'light' or 'dark' the bg + text
 * palette is replaced with the mode-appropriate constants above. The user's
 * chosen primary color is preserved (always wins over palette defaults).
 *
 * Prior to this commit composeTheme only set the `mode` field on the result
 * without swapping any colors, so the mode toggle in ThemePicker was a
 * silent no-op for end users. The css-variables.ts emitter reads only from
 * theme.colors and does not consult theme.mode, so the colors had to change
 * for the toggle to be visible. Fixed here at the source.
 *
 * 'auto' mode (system-follow via prefers-color-scheme) is deferred to v0.8
 * per types.ts; treated as 'dark' here for now.
 */
export function composeTheme(
  base: WdkTheme,
  primaryColor: string,
  radius: WdkThemeRadius,
  mode: WdkMode
): WdkTheme {
  const palette = mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  // Drop any carried-over border colors. The base theme's borders are tuned for
  // ITS mode (e.g. a dark base ships cream borders); reusing them in the other
  // mode makes them invisible (cream-on-white → edgeless buttons). Omitting them
  // lets css-variables.ts re-derive mode-appropriate borders from the new
  // textPrimary. Fixes the edgeless light-mode buttons.
  const baseColors = { ...base.colors };
  delete baseColors.borderSubtle;
  delete baseColors.borderDefault;
  delete baseColors.borderEmphasis;
  return {
    ...base,
    colors: {
      ...baseColors,
      ...palette,
      primary: primaryColor,
    },
    radius,
    mode,
  };
}

// --- Picker component ---

export interface ThemePickerProps {
  /** Current theme. Selection state is derived by matching against option constants. */
  readonly value: WdkTheme;
  /** Called with the composed new theme when any dimension changes. */
  readonly onChange: (next: WdkTheme) => void;
  /** Optional className for the root container. */
  readonly className?: string;
}

const containerStyle: CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  gap:            '20px',
  padding:        '16px',
  fontFamily:     'var(--font-body)',
  color:          'var(--text-primary)',
};

const sectionStyle: CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           '8px',
};

const sectionLabelStyle: CSSProperties = {
  fontSize:      '12px',
  fontWeight:    600,
  color:         'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const swatchRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  justifyItems: 'center',
};

const swatchStyle = (color: string, selected: boolean): CSSProperties => ({
  width:           '32px',
  height:          '32px',
  borderRadius:    '50%',
  backgroundColor: color,
  cursor:          'pointer',
  borderWidth:     selected ? '3px' : '1px',
  borderStyle:     'solid',
  borderColor:     selected ? 'var(--text-primary)' : 'var(--border-default)',
  transitionProperty: 'border-width, border-color',
  transitionDuration: 'var(--motion-duration)',
});

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap:     '8px',
};

/**
 * Theme picker. Renders 3 sections: Color (7 swatches), Edges (4 buttons),
 * Mode (2 buttons). Each selection composes a new theme and fires onChange.
 *
 * @example
 *   const [theme, setTheme] = useState(defaultTheme);
 *   <ThemePicker value={theme} onChange={setTheme} />
 */
export function ThemePicker({ value, onChange, className }: ThemePickerProps): JSX.Element {
  const selectedSwatch = findSwatchByColor(value.colors.primary);
  const selectedEdge = findEdgeByRadius(value.radius);
  const selectedMode = value.mode;

  function handleSwatchClick(swatch: PrimarySwatch): void {
    onChange(composeTheme(value, swatch.color, value.radius, value.mode));
  }
  function handleEdgeClick(edge: EdgeStyle): void {
    onChange(composeTheme(value, value.colors.primary, edge.radius, value.mode));
  }
  function handleModeClick(mode: WdkMode): void {
    onChange(composeTheme(value, value.colors.primary, value.radius, mode));
  }

  return (
    <div className={className} style={containerStyle} data-testid="wdk-theme-picker">
      <div style={sectionStyle}>
        <span style={sectionLabelStyle}>Color</span>
        <div role="radiogroup" aria-label="Primary color" style={swatchRowStyle}>
          {PRIMARY_SWATCHES.map((s) => (
            <div
              key={s.id}
              role="radio"
              aria-checked={selectedSwatch?.id === s.id}
              aria-label={s.label}
              tabIndex={0}
              data-testid={`swatch-${s.id}`}
              style={swatchStyle(s.color, selectedSwatch?.id === s.id)}
              onClick={() => handleSwatchClick(s)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSwatchClick(s); }}
            />
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <span style={sectionLabelStyle}>Edges</span>
        <div role="radiogroup" aria-label="Edge style" style={buttonRowStyle}>
          {EDGE_STYLES.map((e) => (
            <Button
              key={e.id}
              size="sm"
              variant={selectedEdge?.id === e.id ? 'primary' : 'outline'}
              data-testid={`edge-${e.id}`}
              aria-checked={selectedEdge?.id === e.id}
              role="radio"
              onClick={() => handleEdgeClick(e)}
            >
              {e.label}
            </Button>
          ))}
        </div>
      </div>

      <div style={sectionStyle}>
        <span style={sectionLabelStyle}>Mode</span>
        <div role="radiogroup" aria-label="Theme mode" style={buttonRowStyle}>
          {MODES.map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant={selectedMode === m.id ? 'primary' : 'outline'}
              data-testid={`mode-${m.id}`}
              aria-checked={selectedMode === m.id}
              role="radio"
              onClick={() => handleModeClick(m.id)}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}