# `@wdk-starter/wdk-web-core`

**The framework-agnostic engine behind the WDK browser wallets.** One package that
turns Tether's [WDK](https://docs.wallet.tether.io) SDK (`@tetherto/wdk-*`) into a
browser / Web-Worker / MV3-service-worker–ready toolkit: an encrypted key vault, a
multi-chain registry, signing, EIP-3009 gasless transfers, RPC / indexer / relayer /
WebSocket adapters, and a Comlink worker surface.

It is consumed **byte-identically** by both reference products — build the engine
once, ship it on every surface:

- [WDK Template Wallet](https://github.com/plinkdev1/wdk-wallet-template) — Next.js
- [WDK Wallet Extension](https://github.com/plinkdev1/wdk-wallet-extension) — MV3

## Install

```bash
npm install @wdk-starter/wdk-web-core
```

## Public surface

Each entry is an independent import path (see the `exports` map in `package.json`):

| Import | What it gives you |
|---|---|
| `@wdk-starter/wdk-web-core` | Barrel — types · vault · chains · EIP-3009 · worker · adapters |
| `…/types` | `ChainId`, `EvmAccount`, `SolanaAccount`, `WalletWorkerApi`, MV3 message envelopes |
| `…/vault` | `WebCryptoVault` — AES-256-GCM + PBKDF2-SHA-512 (600k) seed encryption |
| `…/chains` | Chain registry + per-chain loaders (EVM, Solana, BTC, TON, Tron, Plasma) |
| `…/worker`, `…/worker/*` | `createWalletWorkerApi` — the Comlink-exposed "worklet"; keys never leave it |
| `…/adapters/relayer` | Relayer adapter interface + implementations (gasless submit) |
| `…/storage` | IndexedDB vault storage |
| `…/polyfill-globals` | Side-effect import that bootstraps Buffer/process for an MV3 service worker |

(EIP-3009 builders, the HTTP RPC / indexer / WebSocket adapters, and the design
tokens are re-exported from the barrel entry.)

## Security model

- Seed and keys are encrypted at rest with **AES-256-GCM + PBKDF2-SHA-512 (600k)** in IndexedDB.
- All custody, key derivation, and signing run inside a **Web Worker / MV3 service worker**
  (the "worklet"); the UI holds only a Comlink proxy and can never read a private key.
- **No persistent unlock** — a fresh worker always cold-starts locked.

## Development

```bash
pnpm --filter @wdk-starter/wdk-web-core typecheck
pnpm --filter @wdk-starter/wdk-web-core build
```

Part of the [WDK](https://docs.wallet.tether.io) ecosystem.
