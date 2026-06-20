# `@wdk-starter/extension` — WDK Wallet (browser extension)

The Manifest V3 browser-extension application. This is one of three workspace
projects in the [wdk-wallet-extension](../../README.md) monorepo; it consumes
the reusable [`@wdk-starter/wdk-web-core`](../../packages/wdk-web-core) engine
and [`@wdk-starter/wdk-ui`](../../packages/wdk-ui) component library.

> **Start at the [repository README](../../README.md)** for the full project
> overview, architecture, security model, and quickstart. This file is a
> developer reference for the extension package itself.

## Layout

```
src/
├── background/   # MV3 service worker: handlers, WalletWorker host, dApp dispatcher,
│                 # approval flow, per-origin connection state, auto-lock lifecycle
├── content/      # content script (isolated world): page ↔ worker bridge + provider injection
├── inpage/       # EIP-1193 provider + EIP-6963 announcer (page main world)
├── popup/        # React app: onboarding, unlock, dashboard, settings, approval views
└── types/        # message-bus contracts
manifest.config.ts  # MV3 manifest (generated to dist/manifest.json by @crxjs/vite-plugin)
```

## Commands

```bash
pnpm -F @wdk-starter/extension dev         # vite dev server (HMR)
pnpm -F @wdk-starter/extension build       # typecheck → bundle inpage → MV3 build (dist/)
pnpm -F @wdk-starter/extension typecheck   # tsc --noEmit (strict)
pnpm -F @wdk-starter/extension test        # vitest (typecheck + unit/component tests)
```

`build` runs from the repo root require the shared packages to be built first
(`pnpm build:packages`). See [`docs/SETUP.md`](../../docs/SETUP.md).

## Architecture & security

- [Architecture](../../docs/architecture/ARCHITECTURE.md)
- [Security model](../../docs/security/SECURITY.md)

The core invariant: **all key material and signing live in the service worker.**
The popup is a pure view that talks to the worker over a typed, allow-listed
message bus and can never read a private key.
