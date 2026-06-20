import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThemePicker, clearStoredThemePrefs } from './use-theme-picker.js';
import { wdkWarmTheme, coolDarkTheme, institutionalLightTheme } from './default-themes.js';
import { composeTheme, EDGE_STYLES } from './picker.js';

describe('useThemePicker', () => {
  beforeEach(() => {
    clearStoredThemePrefs();
  });

  it('returns the initialTheme on first mount when no localStorage entry exists', () => {
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    expect(result.current[0]).toEqual(wdkWarmTheme);
  });

  it('returns the setTheme function as second tuple element', () => {
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    expect(typeof result.current[1]).toBe('function');
  });

  it('updates the theme when setTheme is called', () => {
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    act(() => {
      result.current[1](coolDarkTheme);
    });
    expect(result.current[0]).toEqual(coolDarkTheme);
  });

  it('persists matching themes to localStorage', () => {
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    act(() => {
      // Choose a theme that matches known picker options
      const newTheme = composeTheme(wdkWarmTheme, '#0EA5E9', EDGE_STYLES[0].radius, 'light');
      result.current[1](newTheme);
    });
    const raw = window.localStorage.getItem('wdk-theme-pref-v1');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.primaryId).toBe('azure');
    expect(parsed.edgeId).toBe('sharp');
    expect(parsed.modeId).toBe('light');
  });

  it('hydrates from localStorage on mount when entry exists', () => {
    window.localStorage.setItem('wdk-theme-pref-v1', JSON.stringify({
      primaryId: 'cool-purple',
      edgeId: 'pill',
      modeId: 'dark',
    }));
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    expect(result.current[0].colors.primary).toBe('#9333EA');
    expect(result.current[0].radius.md).toBe('24px');
    expect(result.current[0].mode).toBe('dark');
  });

  it('ignores corrupted localStorage entries and falls back to initialTheme', () => {
    window.localStorage.setItem('wdk-theme-pref-v1', '{ not valid json');
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    expect(result.current[0]).toEqual(wdkWarmTheme);
  });

  it('ignores stored entries with invalid shape', () => {
    window.localStorage.setItem('wdk-theme-pref-v1', JSON.stringify({ foo: 'bar' }));
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    expect(result.current[0]).toEqual(wdkWarmTheme);
  });

  it('clearStoredThemePrefs removes the storage entry', () => {
    window.localStorage.setItem('wdk-theme-pref-v1', JSON.stringify({
      primaryId: 'azure', edgeId: 'sharp', modeId: 'light'
    }));
    clearStoredThemePrefs();
    expect(window.localStorage.getItem('wdk-theme-pref-v1')).toBeNull();
  });

  it('skips persistence for themes that do not match any picker option (custom theme)', () => {
    const { result } = renderHook(() => useThemePicker(wdkWarmTheme));
    act(() => {
      const customTheme = { ...wdkWarmTheme, colors: { ...wdkWarmTheme.colors, primary: '#abcdef' } };
      result.current[1](customTheme);
    });
    expect(window.localStorage.getItem('wdk-theme-pref-v1')).toBeNull();
  });
});