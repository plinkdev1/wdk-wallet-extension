/**
 * WalletEngine — the SW's stateful core.
 *
 * Holds the in-memory cleartext after vault unlock plus lock-state
 * tracking. The engine is owned by the SW and re-created on cold
 * respawn (with state restored from chrome.storage.local in B3.3).
 *
 * For B3.2, the engine is a stub: it tracks lock state correctly
 * but doesn't yet wire to the WDK orchestrator or vault validation.
 * Real signing and account derivation arrive in B3.3+.
 *
 * Lock state semantics:
 *   - 'locked':   no cleartext in memory, password required to unlock
 *   - 'unlocked': cleartext in memory, ready to sign/derive
 *
 * Lock state transitions:
 *   - locked   -> unlocked  via unlock(password)
 *   - unlocked -> locked    via lock() / auto-lock alarm (B3.3) / suspend (B3.3)
 *
 * Listeners receive lock state changes (popup UI, content scripts).
 * Same-state transitions do NOT fire.
 *
 * See:
 *   - PRD 01 Addendum 3.3 (auto-lock; engine holds state, alarm logic in B3.3)
 *   - PRD 01 Addendum 10.2 (lock-on-suspend; wires lock() in B3.3)
 *   - ADR-009 (BIP-44 portability; engine derives accounts from mnemonic in B3.3)
 */

export type LockState = 'locked' | 'unlocked';

export interface WalletEngine {
  /** Current lock state (sync read). */
  getLockState(): LockState;

  /** Zeroize in-memory cleartext. Vault storage is NOT touched. */
  lock(): void;

  /**
   * Unlock with password. STUB for B3.2: accepts any non-empty
   * password and transitions to 'unlocked'. B3.3 validates against
   * the encrypted vault loaded from chrome.storage.local.
   * Throws if password is empty or not a string.
   */
  unlock(password: string): Promise<void>;

  /**
   * Subscribe to lock state transitions. Returns an unsubscribe
   * function. Fires only on actual state change.
   */
  onLockStateChange(listener: (state: LockState) => void): () => void;
}

export function createEngine(): WalletEngine {
  let lockState: LockState = 'locked';
  const listeners = new Set<(state: LockState) => void>();

  function setLockState(next: LockState): void {
    if (lockState === next) return;
    lockState = next;
    for (const l of listeners) l(next);
  }

  return {
    getLockState: () => lockState,
    lock: () => setLockState('locked'),
    unlock: async (password: string) => {
      if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Password required');
      }
      // STUB: B3.3 validates against vault loaded from chrome.storage.local
      setLockState('unlocked');
    },
    onLockStateChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}