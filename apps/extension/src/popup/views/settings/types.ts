/**
 * Shared state interfaces between UnlockedRouter (which holds the picker
 * state hoisted from App.tsx) and SettingsView (which consumes it).
 *
 * Lives in its own file to avoid circular type imports between
 * unlocked-router.tsx and settings/index.tsx.
 */

import type { WdkTheme, BrandConfig } from '@wdk-starter/wdk-ui';
import type { CustomColors, CustomColorKey } from '@wdk-starter/wdk-ui';

export interface ThemeState {
  readonly baseTheme: WdkTheme;
  readonly setBaseTheme: (next: WdkTheme) => void;
  /** Arbitrary hex override; null when no custom primary is active. */
  readonly customPrimary: string | null;
  readonly setCustomPrimary: (next: string | null) => void;

  // B0c.per-color: per-color hex overrides (added via JSX spread in app.tsx)
  readonly customColors?: CustomColors;
  readonly setCustomColor?: (key: CustomColorKey, hex: string | null) => void;
  readonly clearAllCustomColors?: () => void;
}

export interface BrandState {
  readonly brand: BrandConfig;
  readonly setBrand: (next: BrandConfig) => void;
}