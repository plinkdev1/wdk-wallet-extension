# WDK Wallet — Product Roadmap

> **Intent of this document.** This roadmap exists so reviewers (and the Tether
> WDK team) can see both the **depth already built** and the **standard we are
> aiming to set** for WDK-powered wallets. Everything in "Shipped" is in this
> repository today with tests and a loadable build. Everything in later phases
> is scoped against **real, published `@tetherto/*` packages** (verified to exist
> and install) — not aspirational hand-waving.

This wallet is deliberately built as a **reference standard**, not a one-off. All
wallet logic lives in two framework-agnostic packages — `wdk-web-core` (the
engine: vault, chain registry, worker boundary, RPC adapters) and `wdk-ui` (the
component library). The browser extension is the first surface; the
[Next.js Template Wallet](https://github.com/plinkdev1/wdk-wallet-template) is the
second; the [WooCommerce checkout](https://github.com/plinkdev1/wdk-checkout-and-woocommerce-plugin)
is the third. **Build the engine once, ship it on every surface.**

---

## The WDK surface we are standardising on

The `@tetherto/*` ecosystem is far larger than any single bounty requires. We
have validated (installed and/or resolved from npm) the following building
blocks and sequenced them into the roadmap below:

| Capability | WDK package | Status here |
|---|---|---|
| EVM accounts (40+ chains) | `@tetherto/wdk-wallet-evm` | ✅ shipped |
| Solana accounts | `@tetherto/wdk-wallet-solana` | ✅ shipped |
| Bitcoin accounts (BIP-84) | `@tetherto/wdk-wallet-btc` | ✅ shipped |
| **TON accounts (v5r1)** | `@tetherto/wdk-wallet-ton` | ✅ **shipped** |
| **Tron accounts** | `@tetherto/wdk-wallet-tron` | ✅ **shipped** |
| Gasless stablecoin transfers | `@tetherto/wdk-protocol-eip3009` *(our module)* | ✅ shipped |
| Lightning / Spark | `@tetherto/wdk-wallet-spark` | ⏳ Phase 2 (validated; needs MV3 bundler shim — see below) |
| Account abstraction (ERC-4337) | `@tetherto/wdk-wallet-evm-erc-4337` | ⏳ Phase 3 (validated; **infrastructure-gated** — see below) |
| TON-gasless | `@tetherto/wdk-wallet-ton-gasless` | ⏳ Phase 3 |
| Fiat pricing (balances in $) | `@tetherto/wdk-pricing-coingecko-http`, `-bitfinex-http` | ⏳ Phase 2 |
| Swaps | `@tetherto/wdk-protocol-swap-velora-evm` | ⏳ Phase 4 (infrastructure-gated) |
| Lending | `@tetherto/wdk-protocol-lending-aave-evm` | ⏳ Phase 4 (infrastructure-gated) |
| Bridging (USDT0) | `@tetherto/wdk-protocol-bridge-usdt0-evm` | ⏳ Phase 4 (infrastructure-gated) |
| Fiat on-ramp | `@tetherto/wdk-protocol-fiat-moonpay` | ⏳ Phase 4 (needs MoonPay key) |

### What each infrastructure-gated item needs to go live

Probed and confirmed from each package's deps/config. "You provide" = a key or
endpoint that is deployment-specific and can't ship in an open-source repo.

| Item | Engine work | You provide |
|---|---|---|
| **ERC-4337** (`-evm-erc-4337`, abstractionkit/Safe) | chain-style loader + worker; `predictSafeAddress` is offline | a **bundler URL + paymaster** (config is required & validated) |
| **Swap** (`-swap-velora-evm`, `@velora-dex/sdk`) | swap quote/execute on an EVM account + a swap UI | usually **nothing** (Velora public API) — optional partner key for higher limits |
| **Lending** (`-lending-aave-evm`, on-chain Aave) | supply/borrow on Aave pools + a lending UI | just an **RPC** (contracts are on-chain via the Aave address-book) |
| **Bridge** (`-bridge-usdt0-evm`, LayerZero) | cross-chain USDT0 transfer + a bridge UI | just **RPCs** for the chains involved |
| **Fiat on-ramp** (`-fiat-moonpay`) | buy-crypto widget | a **MoonPay partner API key** (no keyless mode) |

Each is a *new feature surface* (a swap/lending/bridge form), not a chain drop-in,
and most pull in the ERC-4337 dependency for the optional account-abstraction path.
They are scoped, validated, and ready to wire as soon as the endpoint/key above is
supplied (Aave/Bridge/Velora can run on public infra today).

> **Self-contained vs. infrastructure-gated.** The shipped chains
> (EVM/Solana/Bitcoin/TON/Tron) are *self-contained*: they work against public
> RPC/Blockbook/TonCenter/TronGrid endpoints out of the box. **ERC-4337** and the
> **DeFi protocols** (swap/lend/bridge) are *infrastructure-gated* — they require
> external services that are deployment-specific and usually keyed: ERC-4337 needs
> a **bundler + paymaster** (its config is required and validated, so it can't be
> stubbed); swaps/lending/bridging need DEX/Aave/bridge routers; the MoonPay ramp
> needs a partner key. These are validated (packages install, APIs confirmed —
> e.g. ERC-4337 uses Safe accounts via `abstractionkit` with offline
> `predictSafeAddress`) and scoped behind a single config object; they are
> deliberately **not** wired with placeholder infra that would fail at runtime.

---

## ✅ Phase 1 — Foundations & multi-asset wallet (SHIPPED)

The current build is a production-grade MV3 wallet, not a prototype:

- **Custody & security** — WebCrypto vault (AES-256-GCM + PBKDF2-SHA-512 600k,
  IndexedDB); seed lives only in the MV3 service worker, never in `chrome.storage`;
  auto-lock via `chrome.alarms`; F-SEC-01 method allow-list at the worker boundary.
- **Accounts** — BIP-39 create/import; multiple accounts via BIP-44/BIP-84.
- **Multi-chain** — **EVM** (Plasma, Ethereum, Polygon, Arbitrum + ~40 more),
  **Solana** (mainnet/devnet/testnet), **Bitcoin** (mainnet/testnet, BIP-84).
- **Assets** — native send/receive on all three families; **USDt + XAUt** token
  balances and `transfer()` sends; tap-to-send token rows.
- **Activity** — persistent history, per-chain filtering, **real-time status**
  (EVM receipts + Solana signature statuses), explorer links.
- **dApp connectivity** — EIP-1193 + EIP-6963, per-origin approvals.
- **Quality** — 841 automated tests, strict TypeScript, CI, loadable `dist/`.

---

## ⏳ Phase 2 — Lightning, fiat values, richer history

1. **Lightning / Spark** (`@tetherto/wdk-wallet-spark`) — instant, low-fee BTC
   payments. The Bitcoin base layer already ships; Spark adds an L2 account family
   following the exact chain-loader pattern Bitcoin uses (`src/chains/spark.ts`
   + worker `account_*Spark*` methods + a Lightning send/receive (BOLT11 invoice) UI).

   > **Validated, with one scoped blocker.** We installed the package and confirmed
   > the account API (address, balance, `sendTransaction`, `createLightningInvoice`,
   > `payLightningInvoice`). The engine wiring is a straight copy of the Bitcoin
   > integration. The remaining task is **browser-bundling the Spark SDK for MV3**:
   > `@buildonspark/spark-sdk` is Bare/Node/React-Native-first, and its dependency
   > tree imports the extensionless `@noble/hashes/hmac` (removed in `@noble/hashes`
   > v2, which only exports `./hmac.js`), so Vite resolves its Node build and fails.
   > The fix is a Vite `resolve.alias` (`@noble/hashes/hmac` → `…/hmac.js`) plus a
   > browser-condition pin to the SDK's `index.browser.js` — or consuming Spark via
   > the **Bare worklet** path (how WDK intends it for mobile). Scoped as the first
   > Phase-2 task; deliberately not rushed into the shipped build.
   >
   > **Shim attempt (recorded).** We tried the obvious fix — a Vite `resolve.alias`
   > rewriting `@noble/hashes/<x>` → `@noble/hashes/<x>.js`. It **breaks the working
   > Bitcoin build**: `@tetherto/wdk-wallet-btc` resolves `@noble/hashes` **v1**
   > (which *does* expose the extensionless `./hmac`), so the alias points it at a
   > `./hmac.js` that v1's export map doesn't publish. BTC and Spark import the same
   > specifier but resolve different majors, so a *global* alias can't serve both.
   > The clean fix is one of: (a) a custom `resolveId` Vite plugin that appends `.js`
   > only when the extensionless path fails; (b) a monorepo-wide `@noble/hashes` v2
   > override (risks bitcoinjs-lib's v1 assumptions); or (c) the Bare-worklet path.
   > Reverted cleanly — the 5-chain build stays green.
2. **Fiat values** (`@tetherto/wdk-pricing-*`) — show balances and amounts in USD;
   a pricing adapter alongside the RPC/indexer adapters in `wdk-web-core`.
3. **Token auto-discovery** — enumerate held ERC-20/SPL tokens via the indexer
   adapter instead of a static registry.
4. **Transaction detail view** — per-tx screen (confirmations, fee, raw data).

## ⏳ Phase 3 — More chains & account abstraction

5. **Account abstraction** (`@tetherto/wdk-wallet-evm-erc-4337`) — smart-account
   sends, sponsored/gasless UX, batched transactions.
6. **TON & Tron** (`@tetherto/wdk-wallet-ton`, `-ton-gasless`, `-tron`) — two more
   account families on the same registry pattern; TON-gasless for USDt transfers.

## ⏳ Phase 4 — DeFi & fiat rails (in-wallet)

7. **Swaps** (`@tetherto/wdk-protocol-swap-velora-evm`) — in-wallet token swaps.
8. **Lending** (`@tetherto/wdk-protocol-lending-aave-evm`) — supply/borrow on Aave.
9. **Bridging** (`@tetherto/wdk-protocol-bridge-usdt0-evm`) — move USDt across chains.
10. **Fiat on-ramp** (`@tetherto/wdk-protocol-fiat-moonpay`) — buy crypto with card.

## ⏳ Phase 5 — Hardening & distribution

11. Hardware-wallet signing, WalletConnect v2, encrypted cloud backup of the
    (already-encrypted) vault, third-party security audit, and Chrome/Firefox
    Web Store submission with the published-store review checklist.

---

## How each phase stays a *standard*, not a fork

Every new chain is a **single chain-loader module** + worker methods guarded by
the same allow-list; every new protocol is an **adapter** in `wdk-web-core`. The
Template Wallet and WooCommerce checkout consume the same engine, so a capability
added here (e.g. Lightning, swaps) becomes available to every WDK surface at once.
That is the whole thesis: **one audited engine, many products.**

See the companion roadmaps in the
[Template Wallet](https://github.com/plinkdev1/wdk-wallet-template/blob/main/ROADMAP.md),
[EIP-3009 module](https://github.com/plinkdev1/wdk-protocol-eip3009/blob/main/ROADMAP.md),
and [WooCommerce checkout](https://github.com/plinkdev1/wdk-checkout-and-woocommerce-plugin/blob/main/ROADMAP.md).
