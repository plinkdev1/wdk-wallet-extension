/**
 * Lifecycle wiring for the MV3 service worker.
 *
 * Three concerns:
 *
 *   1. AUTO-LOCK via chrome.alarms (PRD 01 Addendum §3.3 + §10.3).
 *      A recurring alarm fires every minute and checks lastActivity
 *      against a configurable idle threshold. If exceeded, engine.lock().
 *      Alarms survive SW termination (Chrome respawns the SW to fire
 *      them), which is why we use alarms instead of setTimeout (which
 *      dies with the SW).
 *
 *   2. ONCONNECT ports (PRD 01 Addendum §5.3). chrome.runtime.onMessage
 *      handles request/response RPC (B3.1 dispatcher); onConnect handles
 *      streaming events. The popup connects with name 'wdk-events' to
 *      subscribe to lock state changes.
 *
 *   3. (Deferred to B3.4) SUSPEND/RESTORATION. MV3 SWs don't reliably
 *      get a shutdown notification — chrome.runtime.onSuspend was MV2.
 *      Defense in depth = persist state on every change + restore on
 *      cold respawn. Lands when chrome.storage.local integration ships.
 *
 * The auto-lock and onConnect modules are pure logic (no chrome.* APIs
 * in their bodies) — chrome wiring is isolated to registerAutoLockAlarm.
 * This makes the load-bearing logic fully unit-testable without mocks.
 */

import type { LockState, WalletEngine } from './engine.js';

// ────────────────────────────────────────────────────────────────────
// AutoLock — idle-timer state machine
// ────────────────────────────────────────────────────────────────────

export interface AutoLockOptions {
  /** Idle minutes before auto-lock fires. Default 5 (matches STORAGE_DEFAULTS['prefs:autoLockMinutes']). */
  idleMinutes?: number;
}

export interface AutoLock {
  /** Mark activity now. Resets the idle timer. */
  onActivity(now?: number): void;
  /** Check idle threshold; lock engine if exceeded. Returns true if locked this call. */
  checkIdle(now?: number): boolean;
  /** Current lastActivity timestamp (for debug/test). */
  getLastActivity(): number;
  /** Update the idle threshold (minutes) post-construction. 0 = disabled (Never). No-op for negative or non-finite input. */
  setIdleMinutes(minutes: number): void;
}

export function createAutoLock(
  engine: WalletEngine,
  options: AutoLockOptions = {}
): AutoLock {
  let idleThresholdMs = (options.idleMinutes ?? 5) * 60 * 1000;
  let lastActivity = Date.now();

  return {
    onActivity: (now?: number) => {
      lastActivity = now ?? Date.now();
    },
    checkIdle: (now?: number) => {
      if (idleThresholdMs === 0) return false; // B1c: 0 = Never (auto-lock disabled)
      const t = now ?? Date.now();
      if (
        engine.getLockState() === 'unlocked' &&
        t - lastActivity > idleThresholdMs
      ) {
        engine.lock();
        return true;
      }
      return false;
    },
    getLastActivity: () => lastActivity,
    setIdleMinutes: (minutes: number) => {
      if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return; // B1c: 0 allowed as Never sentinel
      idleThresholdMs = minutes * 60 * 1000;
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Alarm wiring (the chrome.* boundary)
// ────────────────────────────────────────────────────────────────────

export interface RegisterAutoLockAlarmOptions {
  alarmName?: string;
  periodInMinutes?: number;
}

/**
 * Register the recurring chrome.alarms trigger that calls autoLock.checkIdle().
 *
 * Creating an alarm with the same name replaces any existing one, so this
 * is idempotent across SW cold-respawns. PRD 01 Addendum §10.3.
 */
export function registerAutoLockAlarm(
  autoLock: AutoLock,
  options: RegisterAutoLockAlarmOptions = {}
): void {
  const alarmName = options.alarmName ?? 'wdk-auto-lock';
  const periodInMinutes = options.periodInMinutes ?? 1;

  chrome.alarms.create(alarmName, { periodInMinutes });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === alarmName) {
      autoLock.checkIdle();
    }
  });
}

// ────────────────────────────────────────────────────────────────────
// onConnect handler — long-lived event ports
// ────────────────────────────────────────────────────────────────────

/**
 * Build the chrome.runtime.onConnect handler. Per PRD 01 Addendum §5.3,
 * popup/content scripts subscribe to lock state changes via:
 *
 *   const port = chrome.runtime.connect({ name: 'wdk-events' });
 *   port.onMessage.addListener((msg) => { ... });
 *
 * Lifecycle:
 *   1. Port connects → send current lock state immediately
 *   2. Engine state changes → push new state via port.postMessage
 *   3. Port disconnects → unsubscribe from engine
 */
export function createOnConnectHandler(engine: WalletEngine) {
  return (port: chrome.runtime.Port) => {
    if (port.name !== 'wdk-events') return;

    try {
      port.postMessage({ type: 'lock-state', state: engine.getLockState() });
    } catch {
      // Port may have closed mid-connect; disconnect listener cleans up.
    }

    const unsubscribe = engine.onLockStateChange((state: LockState) => {
      try {
        port.postMessage({ type: 'lock-state', state });
      } catch {
        // Port closed; disconnect listener will fire shortly.
      }
    });

    port.onDisconnect.addListener(() => {
      unsubscribe();
    });
  };
}