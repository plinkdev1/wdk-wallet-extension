import { describe, it, expect } from 'vitest';
import {
  wdkOrange,
  darkSurfaces,
  darkText,
  semantic,
  tetherMark,
  fontFamily,
  fontSize,
  glass,
  darkShadows,
  ecommerceCheckoutPreset,
  tailwindTheme,
  cssVariables,
  cssVariablesAsBlock,
} from './tailwind-tokens';

describe('design tokens v2 (WDK brand recalibration)', () => {
  it('WDK orange primary anchored at #F4642F (measured from logo)', () => {
    expect(wdkOrange[500]).toBe('#F4642F');
  });

  it('dark surface base uses warm-undertone dark', () => {
    expect(darkSurfaces.base).toBe('#0F0B08');
  });

  it('dark text primary uses warm off-white (not pure white)', () => {
    expect(darkText.primary).toBe('#FAF6F0');
    expect(darkText.primary).not.toBe('#FFFFFF');
  });

  it('semantic success is emerald (not Tether green, not WDK orange)', () => {
    expect(semantic.success).toBe('#10B981');
    expect(semantic.success).not.toBe('#26A17B');
    expect(semantic.success).not.toBe('#F4642F');
  });

  it('Tether mark green exists separately for credit-line usage only', () => {
    expect(tetherMark.green).toBe('#26A17B');
  });

  it('fontFamily includes display family with Bricolage Grotesque', () => {
    expect(fontFamily.display[0]).toContain('Bricolage Grotesque');
  });

  it('display fontSize weights stepped up to 700', () => {
    const displayEntry = fontSize['display-2xl'];
    const options = displayEntry[1];
    expect(options.fontWeight).toBe('700');
  });

  it('glass recipe uses warm-tinted base', () => {
    expect(glass.dark.background).toMatch(/rgba\(37, 29, 23/);
  });

  it('shadows include warm-glow halo plus orange brand glow', () => {
    expect(darkShadows['glow-warm']).toBeDefined();
    expect(darkShadows['glow-brand']).toMatch(/rgba\(244, 100, 47/);
  });

  it('eCommerce checkout preset has WDK orange accent in both modes', () => {
    expect(ecommerceCheckoutPreset.dark.accentColor).toBe('#F4642F');
    expect(ecommerceCheckoutPreset.light.accentColor).toBe('#F4642F');
  });

  it('helpers produce well-formed Tailwind theme + CSS variable outputs', () => {
    const theme = tailwindTheme();
    expect(theme.colors['wdk-orange'][500]).toBe('#F4642F');

    const darkVars = cssVariables('dark');
    expect(darkVars['--bg-base']).toBe('#0F0B08');
    expect(darkVars['--text-primary']).toBe('#FAF6F0');
    expect(darkVars['--wdk-orange-500']).toBe('#F4642F');

    const block = cssVariablesAsBlock('dark');
    expect(block).toContain(':root');
    expect(block).toContain('--wdk-orange-500: #F4642F');
  });
});