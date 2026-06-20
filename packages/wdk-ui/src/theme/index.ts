/**
 * @wdk-starter/wdk-ui/theme barrel.
 */

// w-2 types + presets
export type {
  WdkTheme, WdkThemeColors, WdkThemeFonts, WdkThemeRadius,
  WdkMotion, WdkGlass, WdkMode,
} from './types.js';
export {
  wdkWarmTheme, coolDarkTheme, institutionalLightTheme,
  defaultThemes, defaultTheme,
} from './default-themes.js';

// w-2 provider + w-3 runtime injection
export { WdkThemeProvider, useWdkTheme } from './provider.js';
export type { WdkThemeProviderProps } from './provider.js';

// w-3 CSS variable generator
export { cssVariables, cssVariablesAsBlock, toRgba } from './css-variables.js';

// w-5 theme picker + companion hook
export {
  ThemePicker,
  PRIMARY_SWATCHES, EDGE_STYLES, MODES,
  findSwatchByColor, findEdgeByRadius, composeTheme,
} from './picker.js';
export type { ThemePickerProps, PrimarySwatch, EdgeStyle, ModeOption } from './picker.js';
export { useThemePicker, clearStoredThemePrefs } from './use-theme-picker.js';
// B0a: arbitrary hex primary override (any-color picker companion to ThemePicker swatches)
export { useCustomPrimary, isValidHexPrimary, clearStoredCustomPrimary } from './use-custom-primary.js';
// B0c: per-color hex overrides for bg + text tokens (5 named slots)
export { useCustomColors, clearStoredCustomColors } from './use-custom-colors.js';
export type { CustomColors, CustomColorKey } from './use-custom-colors.js';
