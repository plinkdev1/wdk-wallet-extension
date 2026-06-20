import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAutoLock,
  registerAutoLockAlarm,
  createOnConnectHandler,
} from './lifecycle.js';
import { createEngine } from './engine.js';

describe('AutoLock (B3.3)', () => {
  it('initializes lastActivity to current time', () => {
    const before = Date.now();
    const autoLock = createAutoLock(createEngine());
    const after = Date.now();
    expect(autoLock.getLastActivity()).toBeGreaterThanOrEqual(before);
    expect(autoLock.getLastActivity()).toBeLessThanOrEqual(after);
  });

  it('onActivity updates lastActivity', () => {
    const autoLock = createAutoLock(createEngine());
    autoLock.onActivity(1000);
    expect(autoLock.getLastActivity()).toBe(1000);
  });

  it('checkIdle returns false before threshold', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    await engine.unlock('pw');
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(5 * 60 * 1000)).toBe(false);
    expect(engine.getLockState()).toBe('unlocked');
  });

  it('checkIdle locks engine after threshold', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    await engine.unlock('pw');
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(15 * 60 * 1000)).toBe(true);
    expect(engine.getLockState()).toBe('locked');
  });

  it('checkIdle does not re-lock if already locked', () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(99 * 60 * 1000)).toBe(false);
  });

  it('activity within threshold prevents auto-lock', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    await engine.unlock('pw');
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(5 * 60 * 1000)).toBe(false);
    autoLock.onActivity(5 * 60 * 1000);
    expect(autoLock.checkIdle(14 * 60 * 1000)).toBe(false);
    expect(engine.getLockState()).toBe('unlocked');
  });

  it('setIdleMinutes updates threshold post-construction (A2 - G1)', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    await engine.unlock('pw');
    autoLock.onActivity(0);
    // 7 min idle with 10 min threshold - no lock yet
    expect(autoLock.checkIdle(7 * 60 * 1000)).toBe(false);
    expect(engine.getLockState()).toBe('unlocked');
    // Tighten to 5 min - 7 min idle now exceeds the new threshold
    autoLock.setIdleMinutes(5);
    expect(autoLock.checkIdle(7 * 60 * 1000)).toBe(true);
    expect(engine.getLockState()).toBe('locked');
  });

  it('setIdleMinutes ignores invalid input (A2 - G1)', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 10 });
    await engine.unlock('pw');
    autoLock.setIdleMinutes(-5);
    autoLock.setIdleMinutes(NaN);
    autoLock.setIdleMinutes(Infinity);
    // Threshold unchanged at 10 min - 5 min idle should NOT trigger lock
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(5 * 60 * 1000)).toBe(false);
    expect(engine.getLockState()).toBe('unlocked');
  });
});

describe('registerAutoLockAlarm (B3.3)', () => {
  let alarmsCreate: ReturnType<typeof vi.fn>;
  let alarmListeners: Array<(alarm: chrome.alarms.Alarm) => void>;

  beforeEach(() => {
    alarmsCreate = vi.fn();
    alarmListeners = [];
    vi.stubGlobal('chrome', {
      alarms: {
        create: alarmsCreate,
        onAlarm: {
          addListener: vi.fn((cb: (alarm: chrome.alarms.Alarm) => void) => {
            alarmListeners.push(cb);
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the alarm with default name + period', () => {
    const autoLock = createAutoLock(createEngine());
    registerAutoLockAlarm(autoLock);
    expect(alarmsCreate).toHaveBeenCalledWith('wdk-auto-lock', {
      periodInMinutes: 1,
    });
  });

  it('accepts custom alarm name + period', () => {
    const autoLock = createAutoLock(createEngine());
    registerAutoLockAlarm(autoLock, {
      alarmName: 'custom',
      periodInMinutes: 5,
    });
    expect(alarmsCreate).toHaveBeenCalledWith('custom', { periodInMinutes: 5 });
  });

  it('alarm listener calls checkIdle on matching alarm', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 1 });
    await engine.unlock('pw');
    // Set lastActivity to epoch so any current time exceeds the threshold —
    // avoids flaky clock-resolution issue where Date.now() in createAutoLock
    // and Date.now() in checkIdle land in the same millisecond.
    autoLock.onActivity(0);
    registerAutoLockAlarm(autoLock);
    alarmListeners[0]!({ name: 'wdk-auto-lock', scheduledTime: Date.now() });
    expect(engine.getLockState()).toBe('locked');
  });

  it('alarm listener ignores non-matching alarms', async () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 1 });
    await engine.unlock('pw');
    autoLock.onActivity(0);
    registerAutoLockAlarm(autoLock);
    alarmListeners[0]!({ name: 'some-other-alarm', scheduledTime: Date.now() });
    expect(engine.getLockState()).toBe('unlocked');
  });
});

describe('createOnConnectHandler (B3.3)', () => {
  function makeMockPort(name: string) {
    const messages: unknown[] = [];
    const disconnectListeners: Array<() => void> = [];
    return {
      name,
      postMessage: vi.fn((msg: unknown) => {
        messages.push(msg);
      }),
      onDisconnect: {
        addListener: vi.fn((cb: () => void) => {
          disconnectListeners.push(cb);
        }),
      },
      _messages: messages,
      _triggerDisconnect: () => {
        disconnectListeners.forEach((cb) => cb());
      },
    };
  }

  it('ignores ports with wrong name', () => {
    const engine = createEngine();
    const handler = createOnConnectHandler(engine);
    const port = makeMockPort('wrong-name');
    handler(port as unknown as chrome.runtime.Port);
    expect(port.postMessage).not.toHaveBeenCalled();
    expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
  });

  it('sends current lock state on connect', () => {
    const engine = createEngine();
    const handler = createOnConnectHandler(engine);
    const port = makeMockPort('wdk-events');
    handler(port as unknown as chrome.runtime.Port);
    expect(port.postMessage).toHaveBeenCalledWith({
      type: 'lock-state',
      state: 'locked',
    });
  });

  it('pushes state changes to subscribed port', async () => {
    const engine = createEngine();
    const handler = createOnConnectHandler(engine);
    const port = makeMockPort('wdk-events');
    handler(port as unknown as chrome.runtime.Port);

    await engine.unlock('pw');
    expect(port._messages).toEqual([
      { type: 'lock-state', state: 'locked' },
      { type: 'lock-state', state: 'unlocked' },
    ]);

    engine.lock();
    expect(port._messages[2]).toEqual({ type: 'lock-state', state: 'locked' });
  });

  it('unsubscribes on disconnect', async () => {
    const engine = createEngine();
    const handler = createOnConnectHandler(engine);
    const port = makeMockPort('wdk-events');
    handler(port as unknown as chrome.runtime.Port);

    expect(port.postMessage).toHaveBeenCalledTimes(1);
    port._triggerDisconnect();

    await engine.unlock('pw');
    expect(port.postMessage).toHaveBeenCalledTimes(1);
  });

  it('B1c: setIdleMinutes(0) disables auto-lock entirely (Never sentinel)', () => {
    const engine = createEngine();
    const autoLock = createAutoLock(engine, { idleMinutes: 5 });
    autoLock.setIdleMinutes(0);
    autoLock.onActivity(0);
    expect(autoLock.checkIdle(5 * 60 * 1000)).toBe(false);
    expect(autoLock.checkIdle(60 * 60 * 1000)).toBe(false);
    expect(autoLock.checkIdle(Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});