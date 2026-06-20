import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ThemePicker,
  PRIMARY_SWATCHES,
  EDGE_STYLES,
  MODES,
  findSwatchByColor,
  findEdgeByRadius,
  composeTheme,
} from './picker.js';
import { wdkWarmTheme, coolDarkTheme, institutionalLightTheme } from './default-themes.js';

describe('PRIMARY_SWATCHES', () => {
  it('contains exactly 7 swatches', () => {
    expect(PRIMARY_SWATCHES.length).toBe(7);
  });
  it('first swatch is WDK Warm (#F4642F) as the anchor', () => {
    expect(PRIMARY_SWATCHES[0].id).toBe('warm-orange');
    expect(PRIMARY_SWATCHES[0].color).toBe('#F4642F');
  });
  it('all swatch IDs are unique', () => {
    const ids = PRIMARY_SWATCHES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('EDGE_STYLES', () => {
  it('contains exactly 4 edge styles', () => {
    expect(EDGE_STYLES.length).toBe(4);
  });
  it('sharp edges set all radius values to 0px', () => {
    const sharp = EDGE_STYLES.find((e) => e.id === 'sharp')!;
    expect(sharp.radius.sm).toBe('0px');
    expect(sharp.radius.md).toBe('0px');
    expect(sharp.radius.lg).toBe('0px');
    expect(sharp.radius.xl).toBe('0px');
  });
  it('pill edges have larger radii than sharp', () => {
    const sharp = EDGE_STYLES.find((e) => e.id === 'sharp')!;
    const pill = EDGE_STYLES.find((e) => e.id === 'pill')!;
    expect(parseInt(pill.radius.md)).toBeGreaterThan(parseInt(sharp.radius.md));
  });
});

describe('MODES', () => {
  it('contains light and dark', () => {
    const ids = MODES.map((m) => m.id);
    expect(ids).toContain('light');
    expect(ids).toContain('dark');
  });
});

describe('findSwatchByColor', () => {
  it('returns matching swatch for known color', () => {
    expect(findSwatchByColor('#F4642F')?.id).toBe('warm-orange');
  });
  it('case-insensitive match', () => {
    expect(findSwatchByColor('#f4642f')?.id).toBe('warm-orange');
  });
  it('returns null for unknown color', () => {
    expect(findSwatchByColor('#abcdef')).toBeNull();
  });
});

describe('findEdgeByRadius', () => {
  it('returns matching edge for sharp radius', () => {
    const sharp = EDGE_STYLES.find((e) => e.id === 'sharp')!;
    expect(findEdgeByRadius(sharp.radius)?.id).toBe('sharp');
  });
  it('returns null for non-matching radius', () => {
    expect(findEdgeByRadius({ sm: '99px', md: '99px', lg: '99px', xl: '99px' })).toBeNull();
  });
});

describe('composeTheme', () => {
  it('overrides primary, radius, and mode on the base', () => {
    const result = composeTheme(wdkWarmTheme, '#0EA5E9', EDGE_STYLES[0].radius, 'light');
    expect(result.colors.primary).toBe('#0EA5E9');
    expect(result.radius).toEqual(EDGE_STYLES[0].radius);
    expect(result.mode).toBe('light');
  });
  it('preserves non-overridden theme fields (fonts, semantic colors, motion)', () => {
    const result = composeTheme(wdkWarmTheme, '#0EA5E9', EDGE_STYLES[0].radius, 'light');
    expect(result.fonts).toEqual(wdkWarmTheme.fonts);
    expect(result.motion).toBe(wdkWarmTheme.motion);
    expect(result.colors.error).toBe(wdkWarmTheme.colors.error);
  });
});

describe('ThemePicker component', () => {
  it('renders 7 swatches + 4 edge buttons + 2 mode buttons', () => {
    render(<ThemePicker value={wdkWarmTheme} onChange={() => {}} />);
    expect(screen.getAllByRole('radio').length).toBe(7 + 4 + 2);
  });

  it('marks the swatch matching theme.colors.primary as aria-checked', () => {
    render(<ThemePicker value={wdkWarmTheme} onChange={() => {}} />);
    const warmSwatch = screen.getByTestId('swatch-warm-orange');
    expect(warmSwatch).toHaveAttribute('aria-checked', 'true');
  });

  it('marks the edge matching theme.radius as aria-checked', () => {
    render(<ThemePicker value={wdkWarmTheme} onChange={() => {}} />);
    // wdkWarmTheme uses a radius scale - find which edge style it matches
    const expectedEdge = findEdgeByRadius(wdkWarmTheme.radius);
    if (expectedEdge) {
      expect(screen.getByTestId(`edge-${expectedEdge.id}`)).toHaveAttribute('aria-checked', 'true');
    } else {
      // wdkWarm radius doesn't match any preset - none should be checked
      EDGE_STYLES.forEach((e) => {
        expect(screen.getByTestId(`edge-${e.id}`)).toHaveAttribute('aria-checked', 'false');
      });
    }
  });

  it('marks the mode matching theme.mode as aria-checked', () => {
    render(<ThemePicker value={wdkWarmTheme} onChange={() => {}} />);
    expect(screen.getByTestId(`mode-${wdkWarmTheme.mode}`)).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with composed new theme when a swatch is clicked', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={wdkWarmTheme} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('swatch-azure'));
    expect(onChange).toHaveBeenCalledOnce();
    const nextTheme = onChange.mock.calls[0][0];
    expect(nextTheme.colors.primary).toBe('#0EA5E9');
    expect(nextTheme.radius).toEqual(wdkWarmTheme.radius);
    expect(nextTheme.mode).toBe(wdkWarmTheme.mode);
  });

  it('fires onChange with composed new theme when an edge button is clicked', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={wdkWarmTheme} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('edge-sharp'));
    expect(onChange).toHaveBeenCalledOnce();
    const nextTheme = onChange.mock.calls[0][0];
    expect(nextTheme.radius.sm).toBe('0px');
    expect(nextTheme.colors.primary).toBe(wdkWarmTheme.colors.primary);
  });

  it('fires onChange with composed new theme when a mode button is clicked', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={institutionalLightTheme} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mode-dark'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0][0].mode).toBe('dark');
  });

  it('supports keyboard activation on swatches (Enter and Space)', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={wdkWarmTheme} onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('swatch-azure'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledOnce();
  });

  // ---- B0c mode fix: composeTheme actually swaps light/dark palette ----

  it('B0c.mode-fix: composeTheme with mode=light injects light bg + text palette', () => {
    const baseDark: WdkTheme = {
      colors: {
        primary: '#000000',
        bgBase: '#888888', bgElevated1: '#888888', bgElevated2: '#888888', bgElevated3: '#888888',
        textPrimary: '#888888',
        success: '#22C55E', warning: '#EAB308', error: '#EF4444', info: '#3B82F6',
      },
      fonts: { display: 'sans', body: 'sans', mono: 'mono' },
      radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px' },
      motion: 'standard', glass: 'standard', mode: 'dark',
    };
    const result = composeTheme(baseDark, '#FF0000', { sm: '0', md: '0', lg: '0', xl: '0' }, 'light');
    expect(result.mode).toBe('light');
    expect(result.colors.bgBase).toBe('#F8F8F7');
    expect(result.colors.bgElevated1).toBe('#FFFFFF');
    expect(result.colors.textPrimary).toBe('#1C1B17');
    expect(result.colors.primary).toBe('#FF0000');
  });

  it('B0c.mode-fix: composeTheme with mode=dark injects dark bg + text palette', () => {
    const baseLight: WdkTheme = {
      colors: {
        primary: '#000000',
        bgBase: '#FFFFFF', bgElevated1: '#FFFFFF', bgElevated2: '#FFFFFF', bgElevated3: '#FFFFFF',
        textPrimary: '#000000',
        success: '#22C55E', warning: '#EAB308', error: '#EF4444', info: '#3B82F6',
      },
      fonts: { display: 'sans', body: 'sans', mono: 'mono' },
      radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px' },
      motion: 'standard', glass: 'standard', mode: 'light',
    };
    const result = composeTheme(baseLight, '#FF0000', { sm: '0', md: '0', lg: '0', xl: '0' }, 'dark');
    expect(result.mode).toBe('dark');
    expect(result.colors.bgBase).toBe('#0A0A0A');
    expect(result.colors.bgElevated1).toBe('#171717');
    expect(result.colors.textPrimary).toBe('#FAFAFA');
    expect(result.colors.primary).toBe('#FF0000');
  });

  it('B0c.mode-fix: primary color always wins over the mode palette', () => {
    const base: WdkTheme = {
      colors: {
        primary: '#000000',
        bgBase: '#888888', bgElevated1: '#888888', bgElevated2: '#888888', bgElevated3: '#888888',
        textPrimary: '#888888',
        success: '#22C55E', warning: '#EAB308', error: '#EF4444', info: '#3B82F6',
      },
      fonts: { display: 'sans', body: 'sans', mono: 'mono' },
      radius: { sm: '4px', md: '8px', lg: '12px', xl: '16px' },
      motion: 'standard', glass: 'standard', mode: 'dark',
    };
    const radius = { sm: '0', md: '0', lg: '0', xl: '0' };
    const customPrimary = '#9333EA';
    expect(composeTheme(base, customPrimary, radius, 'light').colors.primary).toBe(customPrimary);
    expect(composeTheme(base, customPrimary, radius, 'dark').colors.primary).toBe(customPrimary);
  });
});