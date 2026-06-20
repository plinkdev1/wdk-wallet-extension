import { describe, it, expect } from 'vitest';
import { cssVariables, cssVariablesAsBlock, toRgba } from './css-variables.js';
import { wdkWarmTheme, coolDarkTheme, institutionalLightTheme } from './default-themes.js';
import type { WdkTheme } from './types.js';

describe('toRgba', () => {
  it('converts 6-digit hex to rgba', () => {
    expect(toRgba('#F4642F', 1)).toBe('rgba(244, 100, 47, 1)');
    expect(toRgba('#FAF6F0', 0.72)).toBe('rgba(250, 246, 240, 0.72)');
    expect(toRgba('#000000', 0)).toBe('rgba(0, 0, 0, 0)');
  });

  it('converts 3-digit hex to rgba (expands each nibble)', () => {
    expect(toRgba('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
    expect(toRgba('#abc', 0.5)).toBe('rgba(170, 187, 204, 0.5)');
  });

  it('replaces alpha in existing rgba() while preserving rgb channels', () => {
    expect(toRgba('rgba(250, 246, 240, 0.5)', 0.72)).toBe('rgba(250, 246, 240, 0.72)');
  });

  it('replaces alpha in rgb() (adds alpha)', () => {
    expect(toRgba('rgb(244, 100, 47)', 0.3)).toBe('rgba(244, 100, 47, 0.3)');
  });

  it('returns unchanged for unrecognized color formats', () => {
    expect(toRgba('red', 0.5)).toBe('red');
    expect(toRgba('hsl(20, 100%, 50%)', 0.5)).toBe('hsl(20, 100%, 50%)');
  });
});

describe('cssVariables', () => {
  describe('wdkWarmTheme (DEFAULT) - canonical brand anchor preserved', () => {
    const vars = cssVariables(wdkWarmTheme);

    it('emits --color-primary as #F4642F (canonical anchor, NOT #FF5722)', () => {
      expect(vars['--color-primary']).toBe('#F4642F');
      expect(vars['--color-primary']).not.toBe('#FF5722');
    });

    it('emits --bg-* matching tailwind-tokens.ts darkSurfaces verbatim', () => {
      expect(vars['--bg-base']).toBe('#0F0B08');
      expect(vars['--bg-elevated-1']).toBe('#1A1410');
      expect(vars['--bg-elevated-2']).toBe('#251D17');
      expect(vars['--bg-elevated-3']).toBe('#30261F');
    });

    it('emits --text-* using explicit values (NOT derived for wdkWarmTheme)', () => {
      expect(vars['--text-primary']).toBe('#FAF6F0');
      expect(vars['--text-secondary']).toBe('rgba(250, 246, 240, 0.72)');
      expect(vars['--text-tertiary']).toBe('rgba(250, 246, 240, 0.48)');
    });

    it('emits --color-primary-hover and --color-primary-active (defined in WDK Warm)', () => {
      expect(vars['--color-primary-hover']).toBe('#E94816');
      expect(vars['--color-primary-active']).toBe('#C03A0E');
    });

    it('emits --font-* CSS strings containing canonical families', () => {
      expect(vars['--font-display']).toContain('Bricolage Grotesque');
      expect(vars['--font-body']).toContain('Geist');
      expect(vars['--font-mono']).toContain('Geist Mono');
    });

    it('emits --radius-* matching theme.radius', () => {
      expect(vars['--radius-sm']).toBe('6px');
      expect(vars['--radius-md']).toBe('10px');
      expect(vars['--radius-lg']).toBe('14px');
      expect(vars['--radius-xl']).toBe('20px');
    });

    it('emits --motion-duration = 200ms (standard) and --glass-blur = 20px (standard)', () => {
      expect(vars['--motion-duration']).toBe('200ms');
      expect(vars['--glass-blur']).toBe('20px');
    });

    it('emits all 4 semantic color vars', () => {
      expect(vars['--color-success']).toBe('#10B981');
      expect(vars['--color-warning']).toBe('#F59E0B');
      expect(vars['--color-error']).toBe('#EF4444');
      expect(vars['--color-info']).toBe('#3B82F6');
    });
  });

  describe('coolDarkTheme - Phantom-like presets', () => {
    const vars = cssVariables(coolDarkTheme);

    it('emits purple primary and cool gray base', () => {
      expect(vars['--color-primary']).toBe('#9333EA');
      expect(vars['--bg-base']).toBe('#111827');
    });

    it('emits --motion-duration = 360ms (playful)', () => {
      expect(vars['--motion-duration']).toBe('360ms');
    });

    it('emits --glass-blur = 8px (subtle)', () => {
      expect(vars['--glass-blur']).toBe('8px');
    });
  });

  describe('institutionalLightTheme - light mode', () => {
    const vars = cssVariables(institutionalLightTheme);

    it('emits --bg-base as warm-tinted white (#FFFBF7 from tailwind-tokens.ts)', () => {
      expect(vars['--bg-base']).toBe('#FFFBF7');
    });

    it('emits --glass-blur = 0px (glass:off, backdrop blur looks bad on white)', () => {
      expect(vars['--glass-blur']).toBe('0px');
    });

    it('emits --motion-duration = 120ms (subtle - conservative B2B)', () => {
      expect(vars['--motion-duration']).toBe('120ms');
    });
  });

  describe('derivation for optional fields (minimal theme)', () => {
    const minimal: WdkTheme = {
      colors: {
        primary: '#F4642F',
        bgBase: '#000000',
        bgElevated1: '#111111',
        bgElevated2: '#222222',
        bgElevated3: '#333333',
        textPrimary: '#FFFFFF',
        // textSecondary, textTertiary, border*, primaryHover, primaryActive OMITTED
        success: '#10B981',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#3B82F6',
      },
      fonts: { display: 'A', body: 'B', mono: 'C' },
      radius: { sm: '1px', md: '2px', lg: '3px', xl: '4px' },
      motion: 'none',
      glass:  'off',
      mode:   'dark',
    };

    it('derives text-secondary at 72% alpha from textPrimary', () => {
      const vars = cssVariables(minimal);
      expect(vars['--text-secondary']).toBe('rgba(255, 255, 255, 0.72)');
    });

    it('derives text-tertiary at 48% alpha from textPrimary', () => {
      const vars = cssVariables(minimal);
      expect(vars['--text-tertiary']).toBe('rgba(255, 255, 255, 0.48)');
    });

    it('derives border-subtle/default/emphasis at 6/10/18% alpha from textPrimary', () => {
      const vars = cssVariables(minimal);
      expect(vars['--border-subtle']).toBe('rgba(255, 255, 255, 0.06)');
      expect(vars['--border-default']).toBe('rgba(255, 255, 255, 0.1)');
      expect(vars['--border-emphasis']).toBe('rgba(255, 255, 255, 0.18)');
    });

    it('does NOT emit --color-primary-hover when undefined (CSS falls back to --color-primary)', () => {
      const vars = cssVariables(minimal);
      expect(vars).not.toHaveProperty('--color-primary-hover');
      expect(vars).not.toHaveProperty('--color-primary-active');
    });

    it('emits --motion-duration = 0ms when motion=none', () => {
      const vars = cssVariables(minimal);
      expect(vars['--motion-duration']).toBe('0ms');
    });
  });
});

describe('cssVariablesAsBlock', () => {
  it('wraps vars in :root selector by default', () => {
    const block = cssVariablesAsBlock(wdkWarmTheme);
    expect(block.startsWith(':root {\n')).toBe(true);
    expect(block.endsWith('\n}')).toBe(true);
    expect(block).toContain('  --color-primary: #F4642F;');
    expect(block).toContain('  --bg-base: #0F0B08;');
  });

  it('accepts custom selector', () => {
    const block = cssVariablesAsBlock(coolDarkTheme, '[data-theme="cool-dark"]');
    expect(block.startsWith('[data-theme="cool-dark"] {\n')).toBe(true);
    expect(block).toContain('  --color-primary: #9333EA;');
  });

  it('every line in the body is "  --key: value;" form', () => {
    const block = cssVariablesAsBlock(wdkWarmTheme);
    const lines = block.split('\n');
    // First line is ":root {", last line is "}", middle lines are var declarations
    const bodyLines = lines.slice(1, -1);
    for (const line of bodyLines) {
      expect(line).toMatch(/^  --[a-z][a-z0-9-]*: .+;$/);
    }
  });
});