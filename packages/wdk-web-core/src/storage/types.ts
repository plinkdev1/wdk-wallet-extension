/**
 * Typed schema for chrome.storage.local in the WDK browser extension.
 *
 * Per PRD 01 Addendum §9.3 — the schema lives in wdk-web-core because
 * both the extension product and any future extension-protocol
 * consumers share the same definitions.
 *
 * Security boundary (per addendum §9.4): chrome.storage.local is
 * treated as plaintext-equivalent for security planning, even though
 * modern Chromium browsers encrypt extension storage at rest with the
 * OS profile key. NO raw key material is ever written here — the
 * encrypted vault blob lives in IndexedDB (per ADR-002, addendum §7).
 */

/**
 * Full chrome.storage.local schema, keyed by namespaced string keys.
 * Used as the type parameter for getLocal/setLocal generic wrappers.
 */
export type LocalStorageSchema = {
  // Active wallet selection
  'wallet:active': string | null;             // wallet ID, null if none selected

  // Wallet registry (small metadata only; vault blobs live in IndexedDB)
  'wallets:list': readonly WalletMetadata[];

  // User preferences
  'prefs:theme': 'light' | 'dark' | 'system';
  'prefs:defaultChain': string;               // ChainId from chains module
  'prefs:autoLockMinutes': number;
  'prefs:relayerAdapter': RelayerAdapterConfig | null;

  // Lock state — source of truth for SW cold-spawn lock-state hydration
  'lock:state': 'locked' | 'unlocked';
  'lock:lastUnlockedAt': number | null;       // ms epoch

  // dApp connection registry — origin → permitted chains + permission timestamps
  'connections:origins': Readonly<Record<string, ConnectionEntry>>;
};

export type WalletMetadata = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;                 // ms epoch
  readonly vaultExists: boolean;              // does the IDB vault blob exist?
};

export type ConnectionEntry = {
  readonly origin: string;
  readonly chains: readonly string[];         // ChainId list
  readonly permittedAt: number;               // ms epoch
  readonly lastUsedAt: number;                // ms epoch
};

/**
 * Relayer adapter configuration per ADR-004 (Plasma Relayer Adapter Pattern).
 * Three variants matching the three RelayerAdapter implementations shipped
 * in wdk-web-core/src/adapters/relayer.ts.
 */
export type RelayerAdapterConfig =
  | { readonly kind: 'none' }
  | { readonly kind: 'plasma-foundation'; readonly url: string; readonly apiKey: string }
  | { readonly kind: 'generic'; readonly url: string };

/**
 * Default values for the storage schema. Used by the SW on first install
 * to populate sensible defaults. Each key has a sane "fresh-install" value.
 */
export const STORAGE_DEFAULTS: LocalStorageSchema = {
  'wallet:active':         null,
  'wallets:list':          [],
  'prefs:theme':           'system',
  'prefs:defaultChain':    'plasma-mainnet',
  'prefs:autoLockMinutes': 5,
  'prefs:relayerAdapter':  null,
  'lock:state':            'locked',
  'lock:lastUnlockedAt':   null,
  'connections:origins':   {},
};