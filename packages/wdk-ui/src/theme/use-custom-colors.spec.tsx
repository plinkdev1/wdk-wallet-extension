// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomColors, clearStoredCustomColors } from './use-custom-colors.js';

describe('useCustomColors', () => {
  beforeEach(() => {
    clearStoredCustomColors();
  });

  it('returns empty object initially when localStorage is empty', () => {
    const { result } = renderHook(() => useCustomColors());
    expect(result.current[0]).toEqual({});
  });

  it('setColor with valid hex updates the state', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => { result.current[1]('bgBase', '#F0F0F0'); });
    expect(result.current[0]).toEqual({ bgBase: '#F0F0F0' });
  });

  it('setColor with multiple keys accumulates', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => { result.current[1]('bgBase', '#F0F0F0'); });
    act(() => { result.current[1]('textPrimary', '#111111'); });
    expect(result.current[0]).toEqual({ bgBase: '#F0F0F0', textPrimary: '#111111' });
  });

  it('setColor with null deletes the key', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => { result.current[1]('bgBase', '#F0F0F0'); });
    act(() => { result.current[1]('bgBase', null); });
    expect(result.current[0]).toEqual({});
  });

  it('setColor with invalid hex is rejected (state unchanged)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useCustomColors());
    act(() => { result.current[1]('bgBase', 'not-a-hex'); });
    expect(result.current[0]).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('clearAll wipes everything', () => {
    const { result } = renderHook(() => useCustomColors());
    act(() => {
      result.current[1]('bgBase', '#F0F0F0');
      result.current[1]('textPrimary', '#111111');
    });
    act(() => { result.current[2](); });
    expect(result.current[0]).toEqual({});
  });

  it('persists to localStorage and rehydrates on remount', () => {
    const { result, unmount } = renderHook(() => useCustomColors());
    act(() => { result.current[1]('bgBase', '#ABCDEF'); });
    unmount();
    const { result: result2 } = renderHook(() => useCustomColors());
    expect(result2.current[0]).toEqual({ bgBase: '#ABCDEF' });
  });
});