# Changelog

All notable changes to `@wdk-starter/wdk-web-core` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
