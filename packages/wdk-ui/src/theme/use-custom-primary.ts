/**
 * @wdk-starter/wdk-ui - useCustomPrimary hook
 *
 * Stores an OPTIONAL arbitrary hex primary color in localStorage. Pairs
 * with useThemePicker + composeTheme: when a custom hex is set, the
 * consumer composes the final theme by passing the hex into composeTheme
 * as the primary color override (the swatch picker's selection becomes
 * cosmetic - the actual primary is the custom hex).
 *
 * This is the "any color the dev/user wants" surface: the 7 swatches in
 * ThemePicker are a starting palette; this hook unlocks the full 16M-color
 * RGB space via a #RRGGBB string.
 *
 * localStorage key: 'wdk-theme-custom-primary-v1'.
 *
 * Value contract:
 *   - null: no custom override; the swatch from useThemePicker is the primary
 *   - string: must match /^#[0-9A-Fa-f]{6}$/ exactly; invalid values are
 *     rejected at setter time with a console.warn, no state change
 *
 * Companion: composeTheme(base, customHex, base.radius, base.mode) - already
 * exported from './picker.js' - to produce the effective theme.
 *
 * Source: B0a per user requirement that the picker should support arbitrary
 * hex, not just the 7 swatches.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wdk-theme-custom-primary-v1';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** Validate a hex string. Public for testability + reuse by Settings UI. */
export function isValidHexPrimary(value: string): boolean {
  return HEX_RE.test(value);
}

function loadStored(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return isValidHexPrimary(raw) ? raw : null;
  } catch {
    return null;
  }
}

function saveStored(hex: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.setItem(STORAGE_KEY, hex); } catch { /* ignore */ }
}

function clearStored(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Public for testability + Settings UI reset button. */
export function clearStoredCustomPrimary(): void {
  clearStored();
}

/**
 * Controlled state hook for an arbitrary hex primary override.
 *
 * Returns `[hex, setHex]` where:
 *   - hex: string | null - current custom primary, null if none
 *   - setHex(next): set to a valid hex string, or null to clear
 *
 * Invalid hex strings passed to setHex are silently rejected with a
 * console.warn (no state change). Pass null to clear.
 *
 * @example
 *   function AppearanceSection() {
 *     const [theme] = useThemePicker(defaultTheme);
 *     const [custom, setCustom] = useCustomPrimary();
 *     const effective = custom
 *       ? composeTheme(theme, custom, theme.radius, theme.mode)
 *       : theme;
 *     return (
 *       <>
 *         <WdkThemeProvider theme={effective}>...</WdkThemeProvider>
 *         <input
 *           type="text" placeholder="#RRGGBB"
 *           value={custom ?? ''}
 *           onChange={(e) => setCustom(e.target.value || null)}
 *         />
 *       </>
 *     );
 *   }
 */
export function useCustomPrimary(): [string | null, (next: string | null) => void] {
  const [hex, setHexState] = useState<string | null>(() => loadStored());

  useEffect(() => {
    if (hex === null) clearStored();
    else saveStored(hex);
  }, [hex]);

  const setHex = useCallback((next: string | null) => {
    if (next === null) {
      setHexState(null);
      return;
    }
    if (!isValidHexPrimary(next)) {
      // eslint-disable-next-line no-console
      console.warn('[useCustomPrimary] invalid hex (expected #RRGGBB):', next);
      return;
    }
    setHexState(next);
  }, []);

  return [hex, setHex];
}