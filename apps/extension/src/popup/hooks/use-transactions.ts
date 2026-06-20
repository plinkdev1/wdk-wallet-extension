/**
 * useTransactions - a small, persistent transaction-history store backed by
 * localStorage (the popup runs in a normal DOM context with localStorage that
 * persists per extension origin). Records the user-initiated sends the wallet
 * broadcasts so the Activity view can list them with status and explorer links.
 *
 * localStorage (not chrome.storage) is used deliberately: it is synchronous,
 * available in the popup, and works in the jsdom test environment without a
 * chrome mock.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wdk:tx-history';
const MAX_RECORDS = 100;

export interface TxRecord {
  /** Transaction hash. */
  readonly hash: string;
  /** Chain id the transaction was sent on. */
  readonly chain: string;
  /** Recipient address. */
  readonly to: string;
  /** Amount in base units (decimal string). */
  readonly value: string;
  /** Display symbol (e.g. ETH). */
  readonly symbol: string;
  /** Token decimals for formatting (18 for native EVM). */
  readonly decimals: number;
  /** Unix milliseconds when broadcast. */
  readonly ts: number;
  /** Local status. 'submitted' until confirmation is observed on an explorer. */
  readonly status: 'submitted';
}

function read(): TxRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as TxRecord[]) : [];
  } catch {
    return [];
  }
}

function write(txs: readonly TxRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs.slice(0, MAX_RECORDS)));
  } catch {
    // ignore quota / unavailable storage
  }
}

/** Appends a transaction to the persisted history (newest first). */
export function addTransaction(tx: Omit<TxRecord, 'status'>): void {
  write([{ ...tx, status: 'submitted' }, ...read()]);
}

/** Clears all stored history. */
export function clearTransactions(): void {
  write([]);
}

export interface UseTransactionsResult {
  readonly transactions: readonly TxRecord[];
  readonly refresh: () => void;
}

/** Reads the persisted transaction history (newest first). */
export function useTransactions(): UseTransactionsResult {
  const [transactions, setTransactions] = useState<readonly TxRecord[]>(() => read());

  const refresh = useCallback(() => setTransactions(read()), []);

  // Re-read when the popup regains focus (another popup instance may have added one).
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  return { transactions, refresh };
}
