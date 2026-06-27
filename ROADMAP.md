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
| **Spark (Bitcoin L2) + Lightning** | `@tetherto/wdk-wallet-spark` | ✅ **shipped** — branded Spark/Lightning view (address, balance, Spark↔Spark send, deposit-from-BTC, withdraw-to-BTC, BOLT11 receive/pay); `@noble/hashes` conflict solved |
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

| Item | Status | Dev configures |
|---|---|---|
| **Lending** (`-lending-aave-evm`, Aave V3) | ✅ **SHIPPED** — engine + LendingView (supply/withdraw/borrow/repay + position) | nothing (public RPC) |
| **Swap** (`-swap-velora-evm`, ParaSwap/Velora) | ✅ **SHIPPED** — engine + SwapView (quote → execute) | nothing (Velora public API) |
| **Bridge** (`-bridge-usdt0-evm`, LayerZero OFT) | ✅ **SHIPPED** — engine + BridgeView (Ethereum ⇄ Arbitrum USDT0) | nothing (public RPCs) |
| **ERC-4337** (`-evm-erc-4337`, smart accounts) | ✅ **SHIPPED** — engine + SmartAccountView (address, balance, gasless send) | own `VITE_BUNDLER_URL` (+ optional `VITE_PAYMASTER_URL`) |
| **Fiat on-ramp** (`-fiat-moonpay`) | ✅ **SHIPPED** — engine + BuyView (quote → widget) | own `VITE_MOONPAY_API_KEY` (publishable) |

**All five protocol packages are now fully integrated** (engine + worker + UI +
tests). As a **template standard** (not a branded product), each is wired so a
downstream developer drops in their *own* infrastructure and it works — the
ERC-4337 and MoonPay views render a clear "configure" notice until the dev sets
the env var, then activate immediately (see [`.env.example`](./.env.example)). No
provider key, bundler, or partner secret is hard-coded. Each protocol is bound to
the keyed account **inside the worklet** so keys never cross the trust boundary,
and every SDK was **bundle-proven** into the MV3 service worker before any UI was
built (no Bare/Node failure; `@noble/hashes` stays at v1.x, so Bitcoin is
unaffected).

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
- **dApp connectivity** — EIP-1193 + EIP-6963, per-origin approvals, and a
  **Connections** management view (Settings → Connections: list connected sites,
  revoke any).
- **Side panel (Phase C)** — the full wallet also runs as a Chrome **side panel**
  (`manifest.side_panel` + `chrome.sidePanel`), a persistent surface that stays
  open while you browse (the popup closes on blur). The toolbar click still opens
  the popup; the panel opens from the action's right-click menu. It reuses the
  popup `App` verbatim — one UI, two surfaces — in a responsive full-height layout.
- **Quality** — 916 automated tests, strict TypeScript, CI, loadable `dist/`.

---

## ⏳ Phase 2 — Lightning, fiat values, richer history

1. ✅ **Lightning / Spark** (`@tetherto/wdk-wallet-spark`) — **SHIPPED**. Spark is
   wired as an on-demand L2 manager (keyed off the mnemonic, like ERC-4337), with a
   branded **Spark & Lightning** popup view: a Spark tab (Receive · Send Spark→Spark ·
   Deposit-from-Bitcoin · Withdraw-to-BTC with a fee quote + exit speed) and a
   Lightning tab (BOLT11 receive/pay). Worker methods: `account_getSparkAddress` /
   `…Balance` / `…sendSparkTransaction` / `…getSparkDepositAddress` /
   `…quoteSparkWithdraw` / `…sparkWithdraw` + `lightning_createInvoice` /
   `lightning_payInvoice`. The ~6.4 MB SDK lazy-loads into its own chunk.

   > **The `@noble/hashes` v1↔v2 conflict — SOLVED.** The blocker was that
   > `@tetherto/wdk-wallet-btc` imports the extensionless `@noble/hashes/hmac`
   > (v1-only; **undeclared** — a phantom dependency) while the Spark SDK pins
   > `@noble/hashes` v2 (which dropped the extensionless exports), so installing
   > Spark broke Bitcoin. A global Vite alias can't serve both (same specifier,
   > different majors). The fix: pin BTC to v1 via `pnpm.packageExtensions`
   > (`@tetherto/wdk-wallet-btc` → `@noble/hashes@^1.8.0`) so BTC and Spark resolve
   > their own copies side-by-side. Verified at install, tsc/vitest, **and** in both
   > bundlers (crxjs/Vite MV3 + Next.js/webpack) — Bitcoin L1 and Spark now coexist
   > in one build. The upstream source fix (declare the dependency) is drafted for
   > `tetherto/wdk-wallet-btc`.
   >
   > **MV3 caveat (F-MV3-04).** On the MV3 service worker, runtime `import()` may be
   > restricted; the Spark view surfaces that as a clear connect-error rather than
   > failing silently. The Web-Worker (template) path is unaffected.
   >
   > **Payment-target groundwork (`payments/`).** Per-family address validation plus
   > **BOLT11**/BIP-21/EIP-681 parsing (`validateAddress`, `parsePaymentUri`,
   > `decodeBolt11`), with tests over canonical vectors and no new runtime dependency
   > — what the Lightning send/pay UI consumes.
2. **Fiat values** (`@tetherto/wdk-pricing-*`) — show balances and amounts in USD;
   a pricing adapter alongside the RPC/indexer adapters in `wdk-web-core`.
   - ✅ **Pricing adapter shipped + wired** — `PricingAdapter` + Bitfinex
     (Tether-aligned primary) / CoinGecko sources + `createFallbackPricingAdapter`,
     over a shared `DEFAULT_COIN_IDS`. The extension **and** template now inject the
     Bitfinex → CoinGecko fallback at the worker boundary, so USD values survive a
     single source going down.
3. **Token auto-discovery** — enumerate held ERC-20/SPL tokens via the indexer
   adapter instead of a static registry.
   - ✅ **Indexer backend shipped** — `createTetherIndexerAdapter` (the
     Tether-hosted **primary**) + `createFallbackIndexerAdapter` (Tether →
     optional Etherscan / Solana-RPC fallback chain) in `adapters/indexer.ts`;
     the live Tether endpoint shape is dev-supplied and to be confirmed.
4. ✅ **Transaction detail view** — a per-tx panel (amount, **live** status, network,
   recipient, time, copyable hash, explorer link). Opened by clicking any Activity
   row (`transaction-detail.tsx`); the live status reuses the list's existing poll.

## ✅ Phase 3 — More chains & account abstraction (SHIPPED)

5. ✅ **Account abstraction** (`@tetherto/wdk-wallet-evm-erc-4337`) — smart-account
   address, native balance, and gasless `UserOperation` sends in `SmartAccountView`
   (config-driven via `VITE_BUNDLER_URL` / `VITE_PAYMASTER_URL`).
6. ✅ **TON & Tron** (`@tetherto/wdk-wallet-ton`, `-tron`) — both account families
   shipped (v5r1 / Tron address, balance, native send) on the same registry pattern.

## ✅ Phase 4 — DeFi & fiat rails (in-wallet) (SHIPPED)

7. ✅ **Swaps** (`@tetherto/wdk-protocol-swap-velora-evm`) — `SwapView` (quote → execute).
8. ✅ **Lending** (`@tetherto/wdk-protocol-lending-aave-evm`) — `LendingView` (supply/withdraw/borrow/repay + live position).
9. ✅ **Bridging** (`@tetherto/wdk-protocol-bridge-usdt0-evm`) — `BridgeView` (Ethereum ⇄ Arbitrum USDt0).
10. ✅ **Fiat on-ramp** (`@tetherto/wdk-protocol-fiat-moonpay`) — `BuyView` (quote → widget; config-driven key).

## 🚧 Phase 5 — Hardening & distribution

11. Hardware-wallet signing, WalletConnect v2, encrypted cloud backup of the
    (already-encrypted) vault, third-party security audit, and Chrome/Firefox
    Web Store submission with the published-store review checklist.
    - ✅ **Encrypted cloud backup** — done. Export the vault's *already-encrypted*
      blob (PBKDF2 + AES-GCM ciphertext — the seed never leaves in plaintext) as a
      portable, versioned, checksummed envelope, and restore it on another device;
      decryption still needs the original password, so a leaked backup is useless
      without it. `background/backup.ts` (encode/decode + a pluggable
      `CloudBackupTarget`: memory / generic REST), the `BACKUP_EXPORT_VAULT` /
      `BACKUP_IMPORT_VAULT` messages + SW handlers, and a **Backup** panel in
      Settings → Security (export-to-copy + restore-from-paste). Unit-tested
      (envelope round-trip, tamper/version rejection, targets) + a jsdom view test.
    - ✅ **WalletConnect v2 bridge (seam)** — `background/walletconnect/bridge.ts`:
      a WC `session_request` routes through the **same** dApp dispatcher as the
      injected provider (same approval prompt, same per-origin allow-list), and a
      proposal flows through the approval flow. Imports no `@walletconnect` SDK —
      the client is a narrow interface over `@walletconnect/sign-client`. Unit-
      tested (route→respond, error mapping, proposal approve/reject, event wiring);
      `README.md` documents the 3 adapters to go live. *(The relay needs network.)*
    - ✅ **Hardware-wallet signing (seam)** — `background/hardware/signer.ts`: a
      `HardwareSigner` interface + a per-account registry + `routeSign*` that picks
      the device at the single signing chokepoint, else the seed. Unit-tested;
      `README.md` documents the Ledger/WebHID adapter. *(A physical device is the
      only piece needed for end-to-end.)*
    - ⏳ Remaining Phase-5 (deferred by choice — the owner has WalletConnect creds
      and hardware wallets, but is not exercising the live paths at this stage):
      the live WC-relay + device transport adapters (the in-repo seams + tests are
      done), end-to-end funded-testnet runs, a real-store install test, a
      third-party **security audit**, and **Web Store submission**.

---

## Pro-wallet build (per the Design PRD)

Bringing the popup up to a pro-wallet bar (Phantom/Coinbase/Rainbow-class) on the
already-pro engine, in lockstep with the [Template Wallet](https://github.com/plinkdev1/wdk-wallet-template/blob/main/ROADMAP.md).

- ✅ **Token logos everywhere** — the shared `TokenChip` (logo + symbol) backs the
  Swap/Lending/Buy selectors; the Home balance + token rows show real marks.
- ✅ **Navigation shell (Phase 1)** — the popup's "swap the whole surface" routing
  is now a real tabbed IA: a persistent **Home · Swap · Earn · Activity** bottom
  bar (the shared `wdk-ui` `TabBar`, same primitive the template's `WalletShell`
  uses) drives the primary destinations, while the modal-style flows (Receive /
  Send / Buy / Smart-account / Spark) push the full surface above the bar. Earn
  groups Lend (Aave) + Bridge (USDT0) behind a sub-nav; Swap/Earn show a clear
  "EVM only" note off-EVM. The four flow views gained an `embedded` prop so they
  render headerless inside the shell. Settings stays on the header gear; Lock stays
  one click away (ADR-006). 441 popup tests green.
- ✅ **Send-flow primitives** — `AmountInput` (fiat⇄crypto + Max), `ReviewSheet`,
  `SuccessScreen`, and `StatusPill` are mirrored byte-identical from the template
  in `wdk-ui`, ready for the popup Send/Swap flows to adopt next.

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


## Presentation follow-ups (deferred — need tooling/funds)

- ✅ **Capture screenshots** of the tabbed Home shell + the flows (Swap / Lending /
  Bridge / Buy / Smart Account) — done via a reusable view-render harness
  (`apps/extension/screenshots/`, `vite build -c screenshots/vite.config.ts`) that
  mounts the real popup views (incl. the full `MainView` with its TabBar) with the
  SW client stubbed and the wdk-ui theme applied, so imagery regenerates without
  loading the unpacked extension or wiring RPC/keys. The stub answers the Home read
  messages (address / balance / token balances / price) with sample data so the
  shell renders populated. Captured to `media/screenshots/{main,*}-view.png` and
  shown in the README gallery (gated screens render their honest "configure …" state).
- **Testnet integration runs** for the protocols end-to-end (needs funded accounts). The automated suites already cover the wire contracts + x402 round-trip.
