/**
 * @wdk-starter/wdk-ui - useCustomColors hook
 *
 * Stores optional per-color hex overrides for the background, surface,
 * and text tokens of WdkThemeColors. Pairs with composeTheme + the
 * mode-aware palette: customColors layer LAST in the spread chain so
 * a user-set bg/text/surface hex always wins over the swatch base and
 * the mode preset.
 *
 * Companion to useCustomPrimary (which handles the brand primary only).
 * This hook is the "any color the dev/user wants" surface for everything
 * else - 5 named tokens covering page bg, button/input surfaces, hover
 * emphasis, primary text, secondary text (placeholders).
 *
 * localStorage key: 'wdk-theme-custom-colors-v1'.
 *
 * Value contract:
 *   - CustomColors object with any subset of the 5 allowed keys
 *   - Each value must match /^#[0-9A-Fa-f]{6}$/ exactly; invalid hex is
 *     rejected at setter time with console.warn, no state change
 *   - Setting a key to null DELETES it from the object (so the consumer
 *     can distinguish "not set" from "set to falsy value")
 *
 * Source: B0c per user feedback - "background theme colors should also
 * be completely HEX and the color picker / OS color wheel".
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wdk-theme-custom-colors-v1';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export type CustomColorKey =
  | 'bgBase'
  | 'bgElevated1'
  | 'bgElevated2'
  | 'textPrimary'
  | 'textSecondary';

const VALID_KEYS: ReadonlyArray<CustomColorKey> = [
  'bgBase', 'bgElevated1', 'bgElevated2', 'textPrimary', 'textSecondary',
];

export interface CustomColors {
  bgBase?: string;
  bgElevated1?: string;
  bgElevated2?: string;
  textPrimary?: string;
  textSecondary?: string;
}

function loadStored(): CustomColors {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: CustomColors = {};
    for (const k of VALID_KEYS) {
      const v = (parsed as Record<string, unknown>)[k];
      if (typeof v === 'string' && HEX_RE.test(v)) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStored(colors: CustomColors): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (Object.keys(colors).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    }
  } catch {
    // ignore quota / privacy errors
  }
}

/** Public for testability + Settings reset button. */
export function clearStoredCustomColors(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Controlled state hook for per-color hex overrides.
 *
 * Returns a tuple:
 *   - colors: the current CustomColors object (may be empty)
 *   - setColor(key, hex|null): update or delete a single color
 *   - clearAll(): wipe all overrides
 *
 * @example
 *   const [colors, setColor, clearAll] = useCustomColors();
 *   setColor('bgBase', '#F0F0F0');  // set
 *   setColor('bgBase', null);        // delete
 *   clearAll();                       // wipe everything
 */
export function useCustomColors(): [
  CustomColors,
  (key: CustomColorKey, hex: string | null) => void,
  () => void
] {
  const [colors, setColorsState] = useState<CustomColors>(() => loadStored());

  useEffect(() => {
    saveStored(colors);
  }, [colors]);

  const setColor = useCallback((key: CustomColorKey, hex: string | null) => {
    setColorsState((prev) => {
      if (hex === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (!HEX_RE.test(hex)) {
        // eslint-disable-next-line no-console
        console.warn(`[useCustomColors] invalid hex for ${key} (expected #RRGGBB):`, hex);
        return prev;
      }
      if (prev[key] === hex) return prev;
      return { ...prev, [key]: hex };
    });
  }, []);

  const clearAll = useCallback(() => {
    setColorsState({});
  }, []);

  return [colors, setColor, clearAll];
}