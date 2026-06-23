# `@wdk-starter/wdk-web-core`

**The framework-agnostic engine behind the WDK browser wallets.** One package that
turns Tether's [WDK](https://docs.wallet.tether.io) SDK (`@tetherto/wdk-*`) into a
browser / Web-Worker / MV3-service-worker–ready toolkit: an encrypted key vault, a
multi-chain registry, signing, EIP-3009 gasless transfers, **address & payment-URI
validation** (BIP-21 / EIP-681 / BOLT11), **pluggable indexer & pricing adapters**
(a Tether-aligned primary with optional fallbacks), **Spark / Lightning** wiring,
RPC / relayer / WebSocket adapters, and a Comlink worker surface.

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

(EIP-3009 builders; the HTTP RPC / indexer / **pricing** / WebSocket adapters; the
**payments** validators + URI parsers; and the design tokens are re-exported from
the barrel entry.)

## Adapters — pluggable, primary + fallback

History and pricing are dependency-injected, so a product chooses its sources and
gains resilience. Each is a small interface; compose a **primary** with optional
fallbacks via a `…Fallback…` helper that tries each source in order:

```ts
import {
  createTetherIndexerAdapter, createEtherscanIndexerAdapter, createFallbackIndexerAdapter,
  createBitfinexPricingAdapter, createCoingeckoPricingAdapter, createFallbackPricingAdapter,
} from '@wdk-starter/wdk-web-core';

// Transaction history: Tether-hosted primary → Etherscan fallback
const indexer = createFallbackIndexerAdapter([
  createTetherIndexerAdapter({ baseUrl: process.env.TETHER_INDEXER_URL! }),
  createEtherscanIndexerAdapter({ apiKey: process.env.ETHERSCAN_KEY!, resolveChainId }),
]);

// USD pricing: Bitfinex (Tether / iFinex) primary → CoinGecko fallback
const pricing = createFallbackPricingAdapter([
  createBitfinexPricingAdapter(),
  createCoingeckoPricingAdapter({ coinIds }),
]);
// → new WalletWorker({ /* … */, pricingAdapter: pricing })
```

Adding a source is just another `IndexerAdapter` / `PricingAdapter` implementation
dropped into the array — no core changes (RPC and the relayer follow the same
pattern).

## Payments — validation & URI parsing

`validateAddress(family, address)` and `detectPaymentFamily(address)` cover EVM,
Solana, Bitcoin (segwit + legacy), TON, Tron, and Spark; `parsePaymentUri(input)`
decodes BIP-21 (`bitcoin:`), EIP-681 (`ethereum:`), and BOLT11 (`lightning:` / bare
`ln…`); `decodeBolt11` reads a Lightning invoice. These are pure (no key material)
and power both send-form validation and the worker's send-path recipient guard.

## Spark / Lightning

Spark is wired as an on-demand, lazy-loaded family (`account_*Spark*`,
`lightning_createInvoice` / `lightning_payInvoice`). Its SDK is an **app-provided
optional dependency** — it conflicts with `wdk-wallet-btc` over `@noble/hashes`
v1↔v2 in a shared install (see the validation repo's
`spark-browser-validation/NOBLE-HASHES-V1-V2-CONFLICT.md`), so it never enters the
engine's default bundle.

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
