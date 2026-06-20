/**
 * @wdk-starter/wdk-ui - useBrandPicker hook
 *
 * State + localStorage persistence for BrandPicker. Mirrors the shape of
 * useThemePicker (same patterns, same conventions) so consumers can hoist
 * both picker states at the app root with parallel boilerplate.
 *
 * localStorage key: 'wdk-brand-pref-v1' (versioned for schema migration).
 *
 * The brand config is stored as a FULL BrandConfig JSON object (not a derived
 * ID like useThemePicker does), because brand identity does not map to a
 * fixed set of picker options - the wordmark / mark URLs are user-supplied
 * data URIs and the brand name is free-form text. The full config IS the
 * preference.
 *
 * SSR-safe: localStorage access guarded by typeof window check; returns
 * initialBrand unchanged when no storage is available.
 *
 * Source: B0a, A3.9 BrandProvider commit (7fbbda3).
 */

import { useCallback, useEffect, useState } from 'react';
import { type BrandConfig, DEFAULT_WDK_BRAND } from './brand-config.js';

const STORAGE_KEY = 'wdk-brand-pref-v1';

function isBrandConfig(v: unknown): v is BrandConfig {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r['name'] === 'string';
}

function loadStored(): BrandConfig | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBrandConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveStored(brand: BrandConfig): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

/** Public for testability; remove the stored brand pref key. */
export function clearStoredBrandPrefs(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Controlled state hook for BrandPicker with localStorage persistence.
 *
 * On mount: tries to hydrate from localStorage; falls back to initialBrand.
 * On setBrand: persists the new BrandConfig as JSON. To reset, call setBrand
 * with DEFAULT_WDK_BRAND (or use clearStoredBrandPrefs + remount).
 *
 * @example
 *   function App() {
 *     const [brand, setBrand] = useBrandPicker(DEFAULT_WDK_BRAND);
 *     return (
 *       <BrandProvider brand={brand}>
 *         <BrandPicker value={brand} onChange={setBrand} />
 *       </BrandProvider>
 *     );
 *   }
 */
export function useBrandPicker(
  initialBrand: BrandConfig = DEFAULT_WDK_BRAND,
): [BrandConfig, (next: BrandConfig) => void] {
  const [brand, setBrandState] = useState<BrandConfig>(() => {
    const stored = loadStored();
    return stored ?? initialBrand;
  });

  // Persist on every change.
  useEffect(() => {
    saveStored(brand);
  }, [brand]);

  const setBrand = useCallback((next: BrandConfig) => {
    setBrandState(next);
  }, []);

  return [brand, setBrand];
}