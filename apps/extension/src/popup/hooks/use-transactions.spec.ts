/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { addTransaction, clearTransactions, useTransactions } from './use-transactions.js';

const base = { chain: 'ethereum', to: '0x1', value: '1000', symbol: 'ETH', decimals: 18 } as const;

describe('useTransactions', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toEqual([]);
  });

  it('persists an added transaction with submitted status', () => {
    addTransaction({ ...base, hash: '0xabc', ts: 1000 });
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0]?.hash).toBe('0xabc');
    expect(result.current.transactions[0]?.status).toBe('submitted');
  });

  it('orders newest first', () => {
    addTransaction({ ...base, hash: '0x1', ts: 1 });
    addTransaction({ ...base, hash: '0x2', ts: 2 });
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions[0]?.hash).toBe('0x2');
  });

  it('clears history', () => {
    addTransaction({ ...base, hash: '0x1', ts: 1 });
    clearTransactions();
    const { result } = renderHook(() => useTransactions());
    expect(result.current.transactions).toEqual([]);
  });
});
