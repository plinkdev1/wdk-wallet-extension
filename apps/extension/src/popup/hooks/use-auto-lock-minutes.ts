/**
 * useAutoLockMinutes - popup-side hook for the auto-lock idle threshold.
 *
 * Reads + writes directly to chrome.storage.local (key 'prefs:autoLockMinutes').
 * The background SW listens to chrome.storage.onChanged and pushes any new
 * value to its live autoLock state machine, so popup-side writes propagate
 * to the lock-state engine without a separate message round-trip.
 *
 * Semantics:
 *   value = positive integer  -> minutes before auto-lock fires
 *   value = 0                  -> Never (auto-lock disabled, B1c)
 *
 * Hook degrades gracefully when chrome.storage is unavailable (e.g. in
 * vitest/jsdom contexts without a chrome mock): loading turns to false
 * with the default value of 5, and setMinutes is a no-op error state.
 *
 * Source: B1c configurable auto-lock delay.
 */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'prefs:autoLockMinutes';
const DEFAULT_MINUTES = 5;

export interface UseAutoLockMinutesResult {
  readonly minutes: number;
  readonly setMinutes: (next: number) => Promise<void>;
  readonly loading: boolean;
  readonly error: string | null;
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined'
    && typeof (chrome as unknown as { storage?: unknown }).storage !== 'undefined'
    && typeof (chrome as { storage: { local?: unknown } }).storage.local !== 'undefined';
}

export function useAutoLockMinutes(): UseAutoLockMinutesResult {
  const [minutes, setMinutesState] = useState<number>(DEFAULT_MINUTES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasChromeStorage()) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const r = await chrome.storage.local.get(KEY);
        if (cancelled) return;
        const v = (r as Record<string, unknown>)[KEY];
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          setMinutesState(v);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasChromeStorage()) return;
    if (typeof chrome.storage.onChanged === 'undefined') return;
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ): void => {
      if (areaName !== 'local') return;
      const change = changes[KEY];
      if (change && typeof change.newValue === 'number' && Number.isFinite(change.newValue)) {
        setMinutesState(change.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => { chrome.storage.onChanged.removeListener(listener); };
  }, []);

  const setMinutes = useCallback(async (next: number): Promise<void> => {
    if (!hasChromeStorage()) {
      setError('chrome.storage unavailable');
      return;
    }
    if (!Number.isFinite(next) || next < 0) {
      setError('invalid auto-lock minutes: ' + String(next));
      return;
    }
    try {
      await chrome.storage.local.set({ [KEY]: next });
      setMinutesState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { minutes, setMinutes, loading, error };
}