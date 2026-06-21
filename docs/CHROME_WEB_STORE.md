# Chrome Web Store submission

Everything needed to publish **WDK Wallet** to the Chrome Web Store (and the same
package works for the Edge Add-ons and Firefox stores). This is the Bounty 1 (M3)
distribution step — it requires a Chrome Web Store **developer account** (one-time
$5 fee) and is the only step that can't be automated here.

## 1. Build the upload package

```bash
pnpm pack:store
# → dist-store/wdk-wallet-extension-v<version>.zip   (source maps excluded)
```

The zip's root is `manifest.json` (Chrome rejects a nested folder). Upload that
zip in the Developer Dashboard → **Add new item**.

## 2. Store listing copy

- **Name:** WDK Wallet
- **Summary (132 char max):** Self-custodial multi-chain wallet (EVM · Solana ·
  Bitcoin · TON · Tron). Your keys never leave your device.
- **Category:** Productivity
- **Language:** English

**Detailed description (paste):**

> WDK Wallet is a self-custodial browser wallet built on Tether's Wallet
> Development Kit (WDK). Create or import a standard BIP-39 recovery phrase and
> manage assets across EVM chains (Ethereum, Polygon, Arbitrum, Plasma + more),
> Solana, Bitcoin, TON, and Tron — all from one extension.
>
> • Self-custodial: your seed is encrypted with AES-256-GCM (PBKDF2-SHA-512,
>   600k iterations) and never leaves your browser. We never see your keys.
> • Standard derivation (BIP-44/BIP-84): the same recovery phrase restores into
>   MetaMask, Phantom, and hardware wallets.
> • Connect to dApps via the standard EIP-1193 / EIP-6963 provider, with
>   per-site approval you control.
> • Send, receive (QR), token balances (USDt/XAUt), and real-time activity.
>
> Open-source reference implementation. Not an official Tether product.

## 3. Permissions justification

The reviewer will ask why each permission is needed. Answers:

| Permission | Justification |
|---|---|
| `storage` | Persist the **encrypted** vault blob and user preferences (active chain, theme, auto-lock). No plaintext key material is ever stored. |
| `alarms` | Drive the auto-lock timer reliably across MV3 service-worker suspension (`setTimeout` does not survive SW termination). |
| `host_permissions: https://*/*` | The wallet injects a standard **EIP-1193 / EIP-6963** provider (`window.ethereum`) so web3 dApps can detect and request connection — exactly like MetaMask. The user's dApp set isn't known in advance, so injection must be available on any https site. The content script only announces the provider and relays user-approved requests; it does **not** read page content. |

**Single purpose:** "A self-custodial cryptocurrency wallet: store keys locally,
sign transactions, and connect to web3 dApps."

## 4. Privacy disclosures (Data usage tab)

- **Does this item collect user data?** No.
- The extension does **not** collect, transmit, or sell any personal or financial
  data. Keys and the vault stay in the browser. RPC calls go directly from the
  user's browser to the configured public node. Check every "I do not…" box.
- **Remote code:** No. All code is bundled in the package (MV3 forbids remote
  code); the manifest CSP allows `wasm-unsafe-eval` only for in-package WASM.

## 5. Assets to attach (need capture)

- **Icon:** 128×128 (already in `apps/extension/icons/`).
- **Screenshots:** 1280×800 or 640×400 — at least one, up to five. Capture:
  onboarding, dashboard with balances, a dApp connection approval, the send flow.
  (These also fill the README gallery — see the "presentation follow-ups" in
  `ROADMAP.md`.)
- **Small promo tile (optional):** 440×280.

## 6. Pre-submit checklist

- [ ] `pnpm test` green, `pnpm typecheck` clean, `pnpm build` succeeds.
- [ ] `pnpm pack:store` produces the zip; load it unpacked once and smoke-test
      onboarding → unlock → a dApp connect.
- [ ] Bump `apps/extension/manifest.config.ts` version for each store revision.
- [ ] Privacy policy URL ready (store requires one for wallets) — a short page
      stating "no data collected; keys stay local" suffices.
- [ ] Screenshots + icon attached.
- [ ] Submit; first review typically 1–3 business days.

> Edge Add-ons and Firefox (AMO) accept the same MV3 zip with minor manifest
> tweaks; the build is store-agnostic.
