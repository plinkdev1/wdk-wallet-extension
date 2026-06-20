# Architecture

This document explains how the WDK Wallet Extension is built and *why* it is built that way. It is written for an engineer who wants to fork this into a production wallet, or who is reviewing the design.

## 1. Design goals

1. **Keys never leave the secure boundary.** All key material and signing happen in one place — the Manifest V3 service worker. No other context can read a private key.
2. **Reusable engine.** Wallet logic is framework-agnostic and lives in `wdk-web-core`, so the same engine powers the extension, a Next.js template, and future surfaces.
3. **Standards-compliant dApp connectivity.** EIP-1193 and EIP-6963 so the wallet is auto-detected and interoperable, coexisting with other wallets.
4. **Strictly typed, fully tested.** TypeScript strict mode plus a comprehensive test suite gate every change.

## 2. The three layers

```
apps/extension          ← the product surface (MV3 plumbing + React popup)
packages/wdk-ui         ← reusable view layer (no wallet logic)
packages/wdk-web-core   ← reusable engine (all wallet logic, no UI)
```

### `wdk-web-core` — the engine

Framework-agnostic. Knows nothing about React or Chrome APIs. Exposes:

- **`WalletWorker`** — the orchestrator. Wraps `@tetherto/wdk` (`WdkManager`) and implements a flat, typed RPC surface: `vault_store`, `vault_load`, `account_getEvmAddress`, `account_signMessage`, `account_signTypedData`, `account_sendTransaction`, `rpc_getBalance`, etc.
- **Vault** (`vault/`) — WebCrypto AES-GCM encryption, PBKDF2-SHA-512 key derivation, IndexedDB persistence.
- **Chain registry** (`chains/`) — a map of `chainId → loader`. Each chain module exports the WDK wallet-manager class, its config, and display metadata. Adding a chain is one file plus one registry line.
- **Adapters** (`adapters/`) — pluggable `RpcAdapter` (balance reads), `IndexerAdapter` (history), and `RelayerAdapter` (gasless/sponsored transactions). Real or mock implementations satisfy the same interface.
- **EIP-3009 builder** (`eip3009/`) — constructs `transferWithAuthorization` typed-data for gasless USDt-style transfers.
- **Message types** (`types/`) — the wire contract shared by every consumer.

### `wdk-ui` — the component library

Pure React. Primitives (button, card, dialog, input, tabs, badge, network/token icons), onboarding components (mnemonic display/verify/grid, password setup), unlock screen, theming, and a brand picker. No wallet logic — it receives data and emits events. This is what makes a second product (the template wallet) cheap to build.

### `apps/extension` — the product

The Manifest V3 wiring plus the popup app:

- **`src/background/`** — the service worker: handler registry, `WalletWorker` host, dApp dispatcher, approval flow, per-origin connection state, auto-lock lifecycle.
- **`src/content/`** — the content script (isolated world) that bridges page ↔ worker and injects the inpage provider.
- **`src/inpage/`** — the EIP-1193 provider + EIP-6963 announcer injected into the page's main world.
- **`src/popup/`** — the React app: onboarding, unlock, dashboard, settings, and approval views, plus hooks that call the worker.

## 3. The secure boundary

The single most important property: **the popup and content scripts can never obtain a private key.**

```
React popup ──typed RPC──► Service Worker ──► WalletWorker ──► seed (in-memory only)
content script ─────────────►   (allow-listed dispatch)
```

- The worker exposes only *operations* (sign this, derive that address, read this balance). No method returns raw key bytes.
- The dispatcher uses an explicit **allow-list** checked with `Object.hasOwn(ALLOWED, method)` — never the `in` operator, which would match inherited `Object.prototype` members and allow `toString`/`constructor` to slip through. This was a real bug caught by a security regression test; the test remains as a guard.
- dApp requests cross a second, inner allow-list (`createDappDispatcher`) before any worker call.

## 4. Lock state & lifecycle

- Lock state is **in-memory only**. A fresh service-worker spawn always starts *locked*; the decrypted seed must be restored by `vault_load(password)`.
- **Auto-lock** is scheduled with `chrome.alarms`, not `setTimeout` — alarms survive service-worker termination, so the idle timer is reliable even though MV3 workers are aggressively killed.
- `LOCK` zeroizes in-memory state and cancels pending approvals but **does not** revoke dApp connections (locking is a security pause, not a trust withdrawal). `VAULT_CLEAR` (wallet reset) revokes everything — a new seed gets a fresh allow-list.

## 5. dApp connectivity

```
window.ethereum (page main world)
   │  EIP-1193 request
   ▼
inpage provider ──postMessage──► content script ──chrome.runtime──► SW dispatcher
                                                                        │
                                          per-origin permission? ───────┤
                                          needs approval? ─► popup approval UI
                                                                        ▼
                                                                  WalletWorker
```

- **EIP-6963** (`eip6963:announceProvider`) lets the wallet be discovered alongside MetaMask and others — no more `window.ethereum` collisions.
- Every origin has an explicit permission record. First connect, and every signing/sending request, surface a dedicated approval view (`personal_sign`, `signTypedData`, `sendTransaction`, `addEthereumChain`).

## 6. WDK integration & known casts

The engine wraps `@tetherto/wdk`. Two documented boundary casts exist because of upstream packaging details (the wallet-manager packages don't dedupe `@tetherto/wdk-wallet`, so TypeScript sees nominally-distinct private fields). They are isolated to the chain-registration and account-access boundaries, documented inline, and validated at runtime by tests. See `packages/wdk-web-core/src/chains/index.ts` and `worker/wallet-worker.ts`.

## 7. Build pipeline

- `wdk-web-core`: `tsc` → `dist/` (typed ESM).
- `wdk-ui`: `vite build` (library mode) → `dist/`.
- `extension`: `tsc --noEmit` (gate) → `esbuild` bundles the inpage IIFE → `@crxjs/vite-plugin` builds the MV3 bundle and generates `manifest.json`.

## 8. Extending the wallet

| To add… | Do this |
|---|---|
| A new EVM chain | Add a module in `chains/` (or an entry in `_evm-bulk-chains.ts`) + a `CHAIN_LOADERS` line. |
| A non-EVM chain | Add a chain module exporting the WDK wallet manager + config; wire the worker's address/sign branches. |
| Token balances | Implement `IndexerAdapter`/token reads and surface them in the dashboard. |
| A new dApp method | Add a handler in `dapp-handlers.ts` and (if it needs consent) an approval view. |

See the [roadmap](../../README.md#roadmap) for the prioritized list.
