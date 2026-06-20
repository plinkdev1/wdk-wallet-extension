/**
 * Per-origin connection allow-list for the dApp pipeline.
 *
 * When a dApp calls eth_requestAccounts and the user approves, the SW writes
 * an entry here: which chains the dApp is approved for + which account indices
 * are visible. Future requests from the same origin consult this state - if
 * already approved, the SW returns accounts directly without prompting.
 *
 * Persistence: chrome.storage.local at key 'wdk-connections-v1' (schema-versioned
 * for future migrations). The state survives SW restarts and browser restarts;
 * VAULT_CLEAR explicitly revokes all connections (fresh wallet = fresh allow-list).
 * LOCK does NOT revoke (security pause, not "I no longer trust these dApps").
 *
 * Load() must be called before queries. Throws on synchronous query if not loaded.
 * SW startup fires void load() so the state is hot by the time user-initiated
 * dApp requests arrive (user clicks take >> chrome.storage round-trip).
 *
 * Per PRD 01 Addendum S12.6.2 + S12.6.6 (connection state engine).
 */

import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';

const STORAGE_KEY = 'wdk-connections-v1';

export interface ConnectionEntry {
  /** Full origin string (scheme + host + port) as verified by the content bridge. */
  readonly origin: string;
  /** Chains the dApp is approved to read/sign on. */
  readonly chains: readonly EvmChainId[];
  /** Account indices visible to the dApp (HD derivation path indices). */
  readonly accountIndices: readonly number[];
  /** Wall-clock ms timestamp of approval; for debug + future "revoke stale connections" UI. */
  readonly approvedAt: number;
}

export class ConnectionState {
  private readonly connections = new Map<string, ConnectionEntry>();
  private loaded = false;
  /** Track in-flight load to coalesce concurrent calls. */
  private loadPromise: Promise<void> | null = null;

  /**
   * Read all connections from chrome.storage.local. Idempotent - subsequent
   * calls are no-ops. Coalesces concurrent in-flight loads via shared Promise.
   */
  public async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const raw = (result as Record<string, unknown>)[STORAGE_KEY];
      if (raw && typeof raw === 'object') {
        for (const [origin, entry] of Object.entries(raw)) {
          if (this.isValidEntry(entry)) {
            this.connections.set(origin, entry);
          }
        }
      }
      this.loaded = true;
    })();

    return this.loadPromise;
  }

  private isValidEntry(entry: unknown): entry is ConnectionEntry {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as Partial<ConnectionEntry>;
    return (
      typeof e.origin === 'string' &&
      Array.isArray(e.chains) &&
      Array.isArray(e.accountIndices) &&
      typeof e.approvedAt === 'number'
    );
  }

  private async save(): Promise<void> {
    const obj: Record<string, ConnectionEntry> = {};
    for (const [origin, entry] of this.connections) {
      obj[origin] = entry;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: obj });
  }

  private assertLoaded(): void {
    if (!this.loaded) {
      throw new Error('ConnectionState: load() must be called before queries');
    }
  }

  /** Is this origin currently connected (has an allow-list entry)? */
  public isConnected(origin: string): boolean {
    this.assertLoaded();
    return this.connections.has(origin);
  }

  /** Approved account indices for this origin, or empty if not connected. */
  public getApprovedAccounts(origin: string): readonly number[] {
    this.assertLoaded();
    return this.connections.get(origin)?.accountIndices ?? [];
  }

  /** Approved chains for this origin, or empty if not connected. */
  public getApprovedChains(origin: string): readonly EvmChainId[] {
    this.assertLoaded();
    return this.connections.get(origin)?.chains ?? [];
  }

  /**
   * Approve a new connection. Overwrites any existing entry for the origin.
   * Returns the saved entry (includes createdAt timestamp).
   */
  public async approve(
    origin: string,
    chains: readonly EvmChainId[],
    accountIndices: readonly number[],
  ): Promise<ConnectionEntry> {
    this.assertLoaded();
    const entry: ConnectionEntry = {
      origin,
      chains,
      accountIndices,
      approvedAt: Date.now(),
    };
    this.connections.set(origin, entry);
    await this.save();
    return entry;
  }

  /** Revoke a single origin's connection. Returns true if it was present. */
  public async revoke(origin: string): Promise<boolean> {
    this.assertLoaded();
    const removed = this.connections.delete(origin);
    if (removed) await this.save();
    return removed;
  }

  /** Revoke all connections. Called on VAULT_CLEAR. */
  public async revokeAll(): Promise<void> {
    this.assertLoaded();
    this.connections.clear();
    await this.save();
  }

  /** List all current connections (for settings UI in B5+). */
  public list(): readonly ConnectionEntry[] {
    this.assertLoaded();
    return Array.from(this.connections.values());
  }
}

/** Factory matches engine.ts / approval-flow.ts pattern. */
export function createConnectionState(): ConnectionState {
  return new ConnectionState();
}