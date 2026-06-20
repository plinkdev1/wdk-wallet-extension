// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveChain, clearStoredActiveChain } from './use-active-chain.js';

const SUPPORTED = ['ethereum', 'sepolia-testnet'] as const;

describe('useActiveChain', () => {
  beforeEach(() => { clearStoredActiveChain(); });

  it('returns the default when localStorage is empty', () => {
    const { result } = renderHook(() => useActiveChain({ supported: SUPPORTED, default: 'ethereum' }));
    expect(result.current[0]).toBe('ethereum');
  });

  it('falls back to supported[0] when no default is provided', () => {
    const { result } = renderHook(() => useActiveChain({ supported: SUPPORTED }));
    expect(result.current[0]).toBe('ethereum');
  });

  it('setChain updates the active chain', () => {
    const { result } = renderHook(() => useActiveChain({ supported: SUPPORTED, default: 'ethereum' }));
    act(() => { result.current[1]('sepolia-testnet'); });
    expect(result.current[0]).toBe('sepolia-testnet');
  });

  it('persists to localStorage and rehydrates on remount', () => {
    const { result, unmount } = renderHook(() => useActiveChain({ supported: SUPPORTED, default: 'ethereum' }));
    act(() => { result.current[1]('sepolia-testnet'); });
    unmount();
    const { result: result2 } = renderHook(() => useActiveChain({ supported: SUPPORTED, default: 'ethereum' }));
    expect(result2.current[0]).toBe('sepolia-testnet');
  });

  it('ignores stored values not in the supported list (falls back to default)', () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('wdk-active-chain-v1', 'unknown-chain');
    }
    const { result } = renderHook(() => useActiveChain({ supported: SUPPORTED, default: 'ethereum' }));
    expect(result.current[0]).toBe('ethereum');
  });

  it('throws when supported list is empty', () => {
    expect(() => renderHook(() => useActiveChain({ supported: [] as ReadonlyArray<string> }))).toThrow();
  });
});