# Changelog

All notable changes to `@wdk-starter/wdk-web-core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`./payments` subpath export.** `@wdk-starter/wdk-web-core/payments` exposes the
  validators + URI parsers directly, so UIs import `validateAddress` /
  `parsePaymentUri` without pulling the worker/chains barrel. Consumed by the send
  forms in both products: recipient validation is now the engine's checksum-aware
  `validateAddress` (replacing lenient per-family regexes), with **BIP-21 / EIP-681
  paste auto-fill**, and the template's cross-VM bridge signpost uses the engine
  detector. Validator reason strings normalized to "not a valid {family} address (…)".

- **Pricing adapters + fallback chain (`adapters/pricing.ts`).** Brings USD
  pricing into the adapter pattern (like rpc/indexer): a `PricingAdapter`
  interface with `createBitfinexPricingAdapter` (the Tether/iFinex-aligned
  **primary**; direct public-ticker HTTP, no dependency),
  `createCoingeckoPricingAdapter` (wraps `@tetherto/wdk-pricing-coingecko-http`,
  broad long-tail coverage), `createFallbackPricingAdapter([…])` (tries each in
  order, first non-null price wins), and `createMockPricingAdapter`. The worker's
  `pricing_getUsdPrice` now runs through an injectable `pricingAdapter` option —
  the default is CoinGecko over the built-in symbol map (behavior unchanged), and
  a product can inject a Bitfinex → CoinGecko fallback for resilience. +11 tests.

- **Tether-hosted indexer + fallback chain (`adapters/indexer.ts`).**
  `createTetherIndexerAdapter` is the **primary** transaction-history source — a
  configurable HTTP adapter over a dev-supplied Tether endpoint (never
  hard-coded), with an overridable URL builder and response mapper; the defaults
  tolerate common field aliases (`hash|txid|signature`, `blockNumber|blockHeight|slot`,
  `timestamp|blockTime`, `value|amount`, `status|isError|err`) and `nextCursor`
  paging. `createFallbackIndexerAdapter([…])` composes the Tether primary with
  the optional third-party adapters (Etherscan-v2 EVM, Solana-RPC) into one that
  tries each in order and falls back on **unavailability** (a thrown error) — the
  documented "Tether-hosted primary, third parties optional / RPC fallback"
  strategy; a legitimately-empty success does *not* fall through, and the paged
  variant is exposed only when a member supports it. The exact Tether endpoint
  shape is deployment-specific and must be confirmed against the live API. +11
  tests (mocked fetch).

- **Spark / Lightning engine wiring (`protocols/spark.ts`).** On-demand Spark
  manager + worker methods: `account_getSparkAddress`, `account_getSparkBalance`,
  `account_sendSparkTransaction` (recipient guarded via `isSparkAddress`),
  `lightning_createInvoice` (returns the BOLT11 string), and `lightning_payInvoice`
  (the invoice is validated with the shared `decodeBolt11` before paying). Built on
  the retained-mnemonic on-demand pattern (like ERC-4337) and lazy-loaded via a
  non-literal dynamic import, so the ~6.4 MB Spark SDK is deliberately **not** an
  engine dependency — it conflicts with `@tetherto/wdk-wallet-btc` over
  `@noble/hashes` v1↔v2 in a shared install (F-SPARK-03 / spark-browser-validation).
  The consuming app installs + bundles `@tetherto/wdk-wallet-spark`: on a Web-Worker
  host it loads as its own chunk; on the MV3 service worker it surfaces a clear
  "needs the bundler shim" error (F-MV3-04). Pure result-normalizers and the worker
  guard paths (bad recipient / non-BOLT11 / bad amount / locked) are unit-tested
  without loading the SDK.

- **`payments/` module — address validation + payment-URI parsing.** A
  framework-agnostic, dependency-light source of truth shared by every WDK
  surface (extension + template), exported from the package root:
  - `validateAddress(family, address)` / `detectPaymentFamily(address)` plus
    per-family checks: EVM (EIP-55), Solana (32-byte base58), Bitcoin
    (bech32/bech32m segwit + legacy Base58Check, with network), Tron
    (Base58Check + `0x41`), TON (CRC16-XMODEM friendly + raw), and Spark
    (`spark1…`, bech32m — recognised ahead of the chain loader).
  - `parsePaymentUri(input)` for BIP-21 (`bitcoin:`), EIP-681 (`ethereum:`,
    native value + ERC-20 `transfer`), and BOLT11 (`lightning:` / bare `ln…`),
    returning a discriminated `ParsedPaymentTarget`.
  - `decodeBolt11(invoice)` (network + amount→msat + timestamp) and a
    self-contained bech32/bech32m decoder, so no new runtime dependency is added
    (reuses `viem`, `bs58`, `Buffer`). Covered by 30 tests over canonical
    real-world vectors (BIP-173/350, the BOLT #11 spec invoices, the
    USDT-TRON contract, a TON address, and the Spark validation address).

  This is the first engine unit toward the Lightning/Spark roadmap item (BOLT11
  is the Lightning invoice format, so it de-risks Spark without touching the
  blocked SDK bundling) and the basis for the worker send-path recipient guard
  (now wired — see Changed).

### Changed

- **Worker send-path recipient guard.** Every `account_send*Transaction` method
  now validates the recipient via the `payments` module before asking WDK to
  sign — rejecting a malformed or wrong-family `to` up front (EVM `tx.to`,
  Solana/Bitcoin/TON/Tron `to`). The check is family-level (a valid testnet
  address still passes on a mainnet chain) and runs before any network call.
  Exposed as `assertValidRecipient(family, address)`.

## [0.2.0] - 2026-06-22

### Added

- **Solana transaction-history indexer** — `createSolanaRpcIndexerAdapter`
  over standard JSON-RPC (`getSignaturesForAddress` + `getTransaction`), so
  Solana Activity works against any Solana RPC (e.g. Alchemy) with no
  Helius-specific API. Native-SOL deltas are derived from pre/post balances;
  cursor pagination via the last signature; `maxEnrich` caps the per-page
  enrichment fan-out.
- **WebSocket subscriptions** — `createWebSocketSubscriptionAdapter` for live
  block/address push (EVM `eth_subscribe` newHeads + ERC-20 Transfer logs;
  Solana `slotSubscribe` + `logsSubscribe`), with id-correlated JSON-RPC,
  subscription-id routing, and transparent reconnect. `createMockSubscriptionAdapter`
  drives ticks with no network for tests/dev.
- **RPC URL overrides** — `createHttpRpcAdapter` now accepts `rpcUrls`
  (per-chain URL map) and `resolveRpcUrl` (resolver), which take precedence
  over each chain config's baked-in default. A consumer can point any chain at
  its own keyed endpoint (e.g. Alchemy via env) without rebuilding chain modules.

### Fixed

- **Dead public RPC defaults** replaced with CORS-enabled, no-key endpoints so
  balances load in a browser out of the box: ethereum (`eth.llamarpc.com` →
  HTTP 521), polygon (`polygon-rpc.com` → 401, deprecated public access), and
  sepolia (`rpc.sepolia.org` → 404) now use the corresponding PublicNode
  gateways.
- **Mock indexer filter enforcement (B-10)** — `createMockIndexerAdapter` now
  applies `fromBlock`/`toBlock`/`limit` to its fixed result set, matching a real
  indexer's windowing/truncation.

## [0.1.0]

Initial release — WebCrypto vault, `WalletWorker` (Comlink-exposed), the chain
registry, and the RPC / indexer / relayer adapters.
