import { describe, it, expect } from 'vitest';
import {
  wdkWarmTheme,
  coolDarkTheme,
  institutionalLightTheme,
  defaultThemes,
  defaultTheme,
} from './default-themes.js';
import type { WdkTheme } from './types.js';

/**
 * Regression tests for the three preset themes.
 *
 * Critical invariant: wdkWarmTheme.colors.primary MUST be '#F4642F' (the canonical
 * brand orange measured from the WDK logo per design-system.md Doc 16 v2 + the
 * tailwind-tokens.ts source-of-truth comment). NOT '#FF5722' (Master Agent's
 * eyeball estimate that lingered in early Doc 32 drafts and design-system.md L17).
 *
 * If this test fails, someone reverted to the eyeball estimate. Reject and refer
 * back to packages/wdk-web-core/src/design/tailwind-tokens.ts line 12-13 comment.
 */
describe('default-themes', () => {
  describe('wdkWarmTheme (THE DEFAULT)', () => {
    it('uses canonical brand orange #F4642F (NOT #FF5722)', () => {
      expect(wdkWarmTheme.colors.primary).toBe('#F4642F');
      expect(wdkWarmTheme.colors.primary).not.toBe('#FF5722');
    });

    it('mirrors tailwind-tokens.ts darkSurfaces verbatim', () => {
      expect(wdkWarmTheme.colors.bgBase).toBe('#0F0B08');
      expect(wdkWarmTheme.colors.bgElevated1).toBe('#1A1410');
      expect(wdkWarmTheme.colors.bgElevated2).toBe('#251D17');
      expect(wdkWarmTheme.colors.bgElevated3).toBe('#30261F');
    });

    it('mirrors tailwind-tokens.ts darkText verbatim', () => {
      expect(wdkWarmTheme.colors.textPrimary).toBe('#FAF6F0');
      expect(wdkWarmTheme.colors.textSecondary).toBe('rgba(250, 246, 240, 0.72)');
      expect(wdkWarmTheme.colors.textTertiary).toBe('rgba(250, 246, 240, 0.48)');
    });

    it('is dark mode with standard motion + standard glass', () => {
      expect(wdkWarmTheme.mode).toBe('dark');
      expect(wdkWarmTheme.motion).toBe('standard');
      expect(wdkWarmTheme.glass).toBe('standard');
    });

    it('is exported as defaultTheme (Decision 8 lock per Doc 33 Part I)', () => {
      expect(defaultTheme).toBe(wdkWarmTheme);
    });
  });

  describe('coolDarkTheme', () => {
    it('uses purple primary and cool gray base', () => {
      expect(coolDarkTheme.colors.primary).toBe('#9333EA');
      expect(coolDarkTheme.colors.bgBase).toBe('#111827');
    });

    it('is dark mode with playful motion (Phantom-like)', () => {
      expect(coolDarkTheme.mode).toBe('dark');
      expect(coolDarkTheme.motion).toBe('playful');
    });
  });

  describe('institutionalLightTheme', () => {
    it('uses warm-tinted white base from tailwind-tokens.ts lightSurfaces', () => {
      expect(institutionalLightTheme.colors.bgBase).toBe('#FFFBF7');
      expect(institutionalLightTheme.colors.bgElevated1).toBe('#FFFFFF');
    });

    it('is light mode with glass:off (backdrop blur looks bad on white)', () => {
      expect(institutionalLightTheme.mode).toBe('light');
      expect(institutionalLightTheme.glass).toBe('off');
    });

    it('uses subtle motion (conservative B2B aesthetic)', () => {
      expect(institutionalLightTheme.motion).toBe('subtle');
    });
  });

  describe('defaultThemes (convenience map)', () => {
    it('exposes all three presets keyed by short name', () => {
      expect(defaultThemes.wdkWarm).toBe(wdkWarmTheme);
      expect(defaultThemes.coolDark).toBe(coolDarkTheme);
      expect(defaultThemes.institutionalLight).toBe(institutionalLightTheme);
    });

    it('all presets satisfy the WdkTheme contract (required fields present)', () => {
      const themes: readonly WdkTheme[] = [wdkWarmTheme, coolDarkTheme, institutionalLightTheme];
      for (const t of themes) {
        // colors - required
        expect(t.colors.primary).toBeTruthy();
        expect(t.colors.bgBase).toBeTruthy();
        expect(t.colors.bgElevated1).toBeTruthy();
        expect(t.colors.bgElevated2).toBeTruthy();
        expect(t.colors.bgElevated3).toBeTruthy();
        expect(t.colors.textPrimary).toBeTruthy();
        expect(t.colors.success).toBeTruthy();
        expect(t.colors.warning).toBeTruthy();
        expect(t.colors.error).toBeTruthy();
        expect(t.colors.info).toBeTruthy();

        // fonts - required
        expect(t.fonts.display).toBeTruthy();
        expect(t.fonts.body).toBeTruthy();
        expect(t.fonts.mono).toBeTruthy();

        // radius - required
        expect(t.radius.sm).toBeTruthy();
        expect(t.radius.md).toBeTruthy();
        expect(t.radius.lg).toBeTruthy();
        expect(t.radius.xl).toBeTruthy();

        // discriminated unions - check valid values
        expect(['subtle', 'standard', 'playful', 'none']).toContain(t.motion);
        expect(['off', 'subtle', 'standard', 'heavy']).toContain(t.glass);
        expect(['dark', 'light', 'auto']).toContain(t.mode);
      }
    });
  });
});