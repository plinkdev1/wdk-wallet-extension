# Changelog

All notable changes to `@wdk-starter/wdk-web-core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
