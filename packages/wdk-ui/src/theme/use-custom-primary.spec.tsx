/**
 * useCustomPrimary contract tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomPrimary, isValidHexPrimary, clearStoredCustomPrimary } from './use-custom-primary';

describe('useCustomPrimary', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when no custom primary is stored', () => {
    const { result } = renderHook(() => useCustomPrimary());
    expect(result.current[0]).toBeNull();
  });

  it('persists a valid hex via setHex', () => {
    const { result } = renderHook(() => useCustomPrimary());
    act(() => { result.current[1]('#FF00FF'); });
    expect(result.current[0]).toBe('#FF00FF');
    expect(window.localStorage.getItem('wdk-theme-custom-primary-v1')).toBe('#FF00FF');
  });

  it('hydrates from localStorage on mount', () => {
    window.localStorage.setItem('wdk-theme-custom-primary-v1', '#ABCDEF');
    const { result } = renderHook(() => useCustomPrimary());
    expect(result.current[0]).toBe('#ABCDEF');
  });

  it('setHex(null) clears the custom primary', () => {
    const { result } = renderHook(() => useCustomPrimary());
    act(() => { result.current[1]('#123456'); });
    act(() => { result.current[1](null); });
    expect(result.current[0]).toBeNull();
    expect(window.localStorage.getItem('wdk-theme-custom-primary-v1')).toBeNull();
  });

  it('rejects invalid hex with console.warn, no state change', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useCustomPrimary());
    act(() => { result.current[1]('not-hex'); });
    expect(result.current[0]).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('isValidHexPrimary recognizes #RRGGBB only (not #RGB, not without hash)', () => {
    expect(isValidHexPrimary('#FF00FF')).toBe(true);
    expect(isValidHexPrimary('#abcdef')).toBe(true);
    expect(isValidHexPrimary('#F0F')).toBe(false);       // 3-digit not accepted
    expect(isValidHexPrimary('FF00FF')).toBe(false);     // missing hash
    expect(isValidHexPrimary('#FF00FFAA')).toBe(false);  // 8-digit (with alpha) not accepted
    expect(isValidHexPrimary('')).toBe(false);
  });

  it('clearStoredCustomPrimary removes the storage entry', () => {
    window.localStorage.setItem('wdk-theme-custom-primary-v1', '#FF00FF');
    clearStoredCustomPrimary();
    expect(window.localStorage.getItem('wdk-theme-custom-primary-v1')).toBeNull();
  });
});