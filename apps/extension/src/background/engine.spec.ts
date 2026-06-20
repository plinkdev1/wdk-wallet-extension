import { describe, it, expect, vi } from 'vitest';
import { createEngine } from './engine.js';

describe('WalletEngine (stub, B3.2)', () => {
  it('starts in locked state', () => {
    const engine = createEngine();
    expect(engine.getLockState()).toBe('locked');
  });

  it('unlocks with a non-empty password', async () => {
    const engine = createEngine();
    await engine.unlock('hunter2');
    expect(engine.getLockState()).toBe('unlocked');
  });

  it('rejects unlock with empty password', async () => {
    const engine = createEngine();
    await expect(engine.unlock('')).rejects.toThrow(/Password required/);
    expect(engine.getLockState()).toBe('locked');
  });

  it('rejects unlock with non-string password', async () => {
    const engine = createEngine();
    await expect(
      engine.unlock(undefined as unknown as string)
    ).rejects.toThrow(/Password required/);
    expect(engine.getLockState()).toBe('locked');
  });

  it('locks after unlock', async () => {
    const engine = createEngine();
    await engine.unlock('hunter2');
    expect(engine.getLockState()).toBe('unlocked');
    engine.lock();
    expect(engine.getLockState()).toBe('locked');
  });

  it('notifies lock state listeners on transitions', async () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.onLockStateChange(listener);

    await engine.unlock('hunter2');
    expect(listener).toHaveBeenCalledWith('unlocked');
    expect(listener).toHaveBeenCalledTimes(1);

    engine.lock();
    expect(listener).toHaveBeenCalledWith('locked');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not fire listener for same-state transitions', async () => {
    const engine = createEngine();
    const listener = vi.fn();
    engine.onLockStateChange(listener);

    engine.lock();
    expect(listener).not.toHaveBeenCalled();

    await engine.unlock('hunter2');
    expect(listener).toHaveBeenCalledTimes(1);

    await engine.unlock('hunter2');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes a listener', async () => {
    const engine = createEngine();
    const listener = vi.fn();
    const unsubscribe = engine.onLockStateChange(listener);

    await engine.unlock('hunter2');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    engine.lock();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});