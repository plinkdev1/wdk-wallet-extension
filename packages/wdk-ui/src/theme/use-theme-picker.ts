/**
 * @wdk-starter/wdk-ui - useThemePicker hook
 *
 * State + localStorage persistence for ThemePicker. Stores the 3 picker
 * dimension IDs (not the full theme) so base-theme references stay live
 * on rehydration (consumer can swap base theme in code and the picker
 * picks up the new base on next mount).
 *
 * localStorage key: 'wdk-theme-pref-v1' (versioned for schema migration).
 *
 * SSR-safe: localStorage access guarded by typeof window check; returns
 * initialTheme unchanged when no storage available.
 *
 * Source: docs/phase-1/doc32-addendum-theme-expansion-phantom-patterns.md (Doc 33)
 */

import { useCallback, useEffect, useState } from 'react';
import { type WdkTheme, type WdkMode } from './types.js';
import {
  PRIMARY_SWATCHES, EDGE_STYLES, findSwatchByColor, findEdgeByRadius, composeTheme,
} from './picker.js';

const STORAGE_KEY = 'wdk-theme-pref-v1';

interface StoredPrefs {
  primaryId: string;
  edgeId: string;
  modeId: WdkMode;
}

function isStoredPrefs(v: unknown): v is StoredPrefs {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r['primaryId'] === 'string' &&
    typeof r['edgeId'] === 'string' &&
    (r['modeId'] === 'light' || r['modeId'] === 'dark')
  );
}

function loadPrefs(): StoredPrefs | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredPrefs(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePrefs(prefs: StoredPrefs): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/** Public for testability; remove the stored prefs key. */
export function clearStoredThemePrefs(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

function applyPrefsToTheme(base: WdkTheme, prefs: StoredPrefs): WdkTheme {
  const swatch = PRIMARY_SWATCHES.find((s) => s.id === prefs.primaryId);
  const edge = EDGE_STYLES.find((e) => e.id === prefs.edgeId);
  if (!swatch || !edge) return base;
  return composeTheme(base, swatch.color, edge.radius, prefs.modeId);
}

function deriveIdsFromTheme(theme: WdkTheme): StoredPrefs | null {
  const swatch = findSwatchByColor(theme.colors.primary);
  const edge = findEdgeByRadius(theme.radius);
  if (!swatch || !edge) return null;
  return { primaryId: swatch.id, edgeId: edge.id, modeId: theme.mode };
}

/**
 * Controlled state hook for ThemePicker with localStorage persistence.
 *
 * On mount: tries to hydrate from localStorage; falls back to initialTheme.
 * On setTheme: derives prefs from the new theme and persists them. If the
 * new theme doesn't match any picker option (custom theme), persistence is
 * skipped silently.
 *
 * @example
 *   function App() {
 *     const [theme, setTheme] = useThemePicker(defaultTheme);
 *     return (
 *       <WdkThemeProvider theme={theme}>
 *         <ThemePicker value={theme} onChange={setTheme} />
 *       </WdkThemeProvider>
 *     );
 *   }
 */
export function useThemePicker(initialTheme: WdkTheme): [WdkTheme, (next: WdkTheme) => void] {
  const [theme, setThemeState] = useState<WdkTheme>(() => {
    const prefs = loadPrefs();
    return prefs ? applyPrefsToTheme(initialTheme, prefs) : initialTheme;
  });

  // Persist on every change.
  useEffect(() => {
    const derived = deriveIdsFromTheme(theme);
    if (derived) savePrefs(derived);
  }, [theme]);

  const setTheme = useCallback((next: WdkTheme) => {
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}