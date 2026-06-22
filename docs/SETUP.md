# Setup & Build Guide

This guide takes you from a fresh clone to a wallet running in your browser.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | LTS recommended |
| pnpm | 10.x | `corepack enable` provides the pinned version |
| Chrome / Brave / Edge | current | any Chromium browser with Manifest V3 |

This is a [pnpm workspace](https://pnpm.io/workspaces). Use `pnpm`, not `npm`/`yarn` — the lockfile and `workspace:*` links depend on it.

## 1. Install dependencies

```bash
pnpm install
```

This installs the root toolchain plus the three workspace projects:
- `packages/wdk-web-core` — the engine
- `packages/wdk-ui` — the component library
- `apps/extension` — the extension

## 2. (Optional) Configure RPC endpoints

The wallet ships with working public-RPC fallbacks, so this step is optional. To use your own endpoints (recommended for reliability and higher rate limits):

```bash
cp .env.example .env.local
# edit .env.local and set VITE_ETH_RPC_URL, etc.
```

> **Why `.env.local` at the repo root?** `apps/extension/vite.config.ts` sets `envDir: '../../'`, so Vite loads env files from the monorepo root. `.env.local` is gitignored — your keys never enter version control. Only `VITE_`-prefixed variables are exposed to the build.

## 3. Build

```bash
# Build the shared packages, then the extension
pnpm build
```

Or build pieces individually:

```bash
pnpm build:packages        # wdk-web-core + wdk-ui
pnpm build:extension       # the MV3 extension → apps/extension/dist/
```

The production bundle lands in `apps/extension/dist/`, including a generated `manifest.json`.

## 4. Run the tests

```bash
pnpm test          # all 916 tests
pnpm typecheck     # strict typecheck across all packages
```

## 5. Load in the browser

1. Open `chrome://extensions` (or `brave://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** → select `apps/extension/dist/`.
4. Pin **WDK Wallet** and open it.

### Reloading after changes

After `pnpm build:extension`, click the ↻ (reload) icon on the WDK Wallet card in `chrome://extensions`. If you change manifest permissions, remove and re-add the unpacked extension.

### Resetting wallet state during development

Open the extension's service-worker console (`chrome://extensions` → WDK Wallet → *service worker*) and run:

```js
chrome.storage.local.clear()
indexedDB.deleteDatabase('wdk-vault')   // clears the encrypted vault
```

then reload the extension.

## Development workflow

```bash
pnpm dev      # vite dev server with HMR for the extension
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '@wdk-starter/wdk-web-core/...'` on typecheck | Run `pnpm build:packages` first — the extension consumes the packages' built `dist/`. |
| WASM/CSP error in the service worker | Ensure you loaded the **built** `dist/`, not `src/`. The manifest's `wasm-unsafe-eval` CSP is required by WDK's crypto. |
| Balances show `0` | Set a real `VITE_ETH_RPC_URL` in `.env.local`; public fallbacks are rate-limited. |
| Stale UI after rebuild | Reload the extension card, then close & reopen the popup. |
