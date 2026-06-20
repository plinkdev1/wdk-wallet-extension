/**
 * useBrandPicker contract tests.
 * Mirrors the useThemePicker test shape.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrandPicker, clearStoredBrandPrefs } from './use-brand-picker';
import { DEFAULT_WDK_BRAND, type BrandConfig } from './brand-config';

describe('useBrandPicker', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns initialBrand when no localStorage entry exists', () => {
    const { result } = renderHook(() => useBrandPicker(DEFAULT_WDK_BRAND));
    expect(result.current[0]).toEqual(DEFAULT_WDK_BRAND);
  });

  it('persists setBrand to localStorage', () => {
    const { result } = renderHook(() => useBrandPicker(DEFAULT_WDK_BRAND));
    const next: BrandConfig = { ...DEFAULT_WDK_BRAND, name: 'MyWallet' };
    act(() => { result.current[1](next); });
    expect(result.current[0]).toEqual(next);
    const raw = window.localStorage.getItem('wdk-brand-pref-v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(next);
  });

  it('hydrates from localStorage on mount', () => {
    const stored: BrandConfig = { ...DEFAULT_WDK_BRAND, name: 'Stored', wordmarkSrc: '/stored.svg' };
    window.localStorage.setItem('wdk-brand-pref-v1', JSON.stringify(stored));
    const { result } = renderHook(() => useBrandPicker(DEFAULT_WDK_BRAND));
    expect(result.current[0]).toEqual(stored);
  });

  it('ignores malformed JSON in localStorage and falls back to initialBrand', () => {
    window.localStorage.setItem('wdk-brand-pref-v1', '{not json');
    const { result } = renderHook(() => useBrandPicker(DEFAULT_WDK_BRAND));
    expect(result.current[0]).toEqual(DEFAULT_WDK_BRAND);
  });

  it('clearStoredBrandPrefs removes the storage entry', () => {
    window.localStorage.setItem('wdk-brand-pref-v1', JSON.stringify(DEFAULT_WDK_BRAND));
    clearStoredBrandPrefs();
    expect(window.localStorage.getItem('wdk-brand-pref-v1')).toBeNull();
  });
});