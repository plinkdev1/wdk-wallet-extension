/**
 * @wdk-starter/wdk-ui - WdkThemeProvider
 *
 * React context provider for theme distribution to wdk-ui components.
 *
 * v0.2 (w-2): plain context provider.
 * v0.3 (w-3): provider now injects CSS variables onto document.documentElement
 *             on mount + theme-change. Variables follow the naming convention
 *             established by packages/wdk-web-core/src/design/tailwind-tokens.ts
 *             so wdk-ui components can use var(--bg-base) etc. regardless of
 *             whether the vars came from build-time emission or runtime injection.
 *
 * SSR note: useEffect doesn't run server-side, so SSR'd HTML won't have CSS
 *           variables on first paint. For SSR-critical first-paint themes, the
 *           consuming app should emit cssVariablesAsBlock(theme) into a <style>
 *           tag at build time AND pass skipCssInjection={true} to the provider
 *           so the runtime injection doesn't clobber the build-time emission.
 *
 * Source: docs/phase-1/wdk-ui-component-library-spec.md (Doc 32) Part III
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { WdkTheme } from './types.js';
import { defaultTheme } from './default-themes.js';
import { cssVariables } from './css-variables.js';

const WdkThemeContext = createContext<WdkTheme>(defaultTheme);

export interface WdkThemeProviderProps {
  /** Theme override. If omitted, the WDK Warm default is used. */
  readonly theme?: WdkTheme;
  /**
   * If true, the provider does NOT inject CSS variables onto document.documentElement.
   * Useful when the consuming app handles CSS variable emission via another
   * mechanism (e.g. build-time stylesheet emission via cssVariablesAsBlock())
   * and only needs the React context distribution.
   * @default false
   */
  readonly skipCssInjection?: boolean;
  readonly children?: ReactNode;
}

/**
 * Provides a WdkTheme to descendant components via React context AND injects
 * the theme's CSS variables onto document.documentElement on mount.
 *
 * Default theme is wdkWarmTheme (#F4642F brand orange). Developers override
 * by passing their own WdkTheme via the `theme` prop.
 *
 * @example
 *   <WdkThemeProvider theme={defaultThemes.coolDark}>
 *     <WalletApp />
 *   </WdkThemeProvider>
 */
export function WdkThemeProvider({
  theme = defaultTheme,
  skipCssInjection = false,
  children,
}: WdkThemeProviderProps) {
  useEffect(() => {
    if (skipCssInjection) return;
    if (typeof document === 'undefined') return; // SSR safety
    const root = document.documentElement;
    const vars = cssVariables(theme);
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }
    root.setAttribute('data-theme', theme.mode);
    return () => {
      for (const k of Object.keys(vars)) {
        root.style.removeProperty(k);
      }
      root.removeAttribute('data-theme');
    };
  }, [theme, skipCssInjection]);

  return (
    <WdkThemeContext.Provider value={theme}>
      {children}
    </WdkThemeContext.Provider>
  );
}

/**
 * Reads the current WdkTheme from context.
 *
 * Components inside WdkThemeProvider receive the provided theme. Components
 * outside any provider receive the default WDK Warm theme - graceful fallback
 * so primitives still render with brand colors even when not explicitly wrapped.
 */
export function useWdkTheme(): WdkTheme {
  return useContext(WdkThemeContext);
}