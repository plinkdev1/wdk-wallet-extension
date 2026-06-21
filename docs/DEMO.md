# Demo Video Script (2–5 min)

A tight walkthrough for the bounty demo video. Aim for ~4 minutes.

## Setup (before recording)
- `pnpm install && pnpm build`
- Load `apps/extension/dist/` unpacked in Chrome **and** Brave (show it runs on both).
- Have a testnet faucet tab ready (e.g. Sepolia) and a dApp tab (any EIP-1193 site, or `https://metamask.github.io/test-dapp/`).

## Beats

**0:00 — Intro (20s)**
> "This is the WDK Wallet — a self-custodial, multi-chain browser extension built on Tether's Wallet Development Kit. Everything you'll see is open source and backed by 870 automated tests."

Show the repo README, then the extension icon in the toolbar.

**0:20 — Create a wallet (35s)**
- Open the popup → **Create new wallet**.
- Show the BIP-39 recovery phrase, the verify step, and password setup.
- Land on the dashboard. Call out: *"The seed is encrypted with AES-GCM and stored locally — it never leaves this service worker."*

**0:55 — Multi-chain (30s)**
- Open the chain selector. Switch between **Plasma, Ethereum, Polygon, Arbitrum, Solana, Bitcoin, TON, Tron**.
- Point out the live address and balance per chain (in native + **USD**), and that the same seed derives every account.

**1:25 — DeFi & agentic payments (45s)**
- On an EVM chain, show the action row: **Swap · Earn (Aave) · Bridge**, plus **Smart Account** and **Buy crypto**.
- Open **Earn (Aave)**: show the live position (collateral / debt / health factor) and a supply form. Toggle **⚡ Gasless** — *"with a bundler configured, this runs as an ERC-4337 UserOperation, so you pay no ETH for gas."*
- Open **Swap**: pick a pair, **Get quote**, show the expected output.
- Open **Buy crypto** / **Smart Account**: show the "configure" notice — *"these activate from the developer's own MoonPay key and bundler; nothing is hard-coded. This is a template standard."*
- One line on **x402**: *"The same EIP-3009 signing lets a WDK wallet pay HTTP 402 challenges — so an agent can pay per-request for an API or to bypass a crawler paywall. The matching facilitator ships in the checkout repo."*

**2:10 — Lock & unlock (20s)**
- Click **Lock**. Reopen → unlock with the password.
- Mention auto-lock: *"It also auto-locks on idle, using chrome.alarms so the timer survives the service worker being killed."*

**2:30 — Connect to a dApp (50s)**
- Open the dApp tab. Click **Connect**.
- Show the **approval prompt** with the origin. Approve.
- Trigger a `personal_sign` → show the dedicated signing review screen → approve.
- Note: *"The wallet announces itself via EIP-6963, so it's discovered alongside other wallets, and every action requires explicit, per-origin approval."*

**3:20 — Security & architecture (25s)**
- Flash the architecture diagram from the README.
- *"All keys live in the service worker behind an allow-listed message bus. The popup is a pure view — it can't read a private key."*

**3:45 — Outro (15s)**
- *"Open source, MIT licensed, documented end to end. A reference you can fork to ship a production WDK wallet."*
- Show the GitHub URL.

## Verifying the new features live (bring your own config/funds)

What the automated suites already cover (run `pnpm -r test` — **870 tests**):
chain derivation, vault, dApp bus, the DeFi/AA/on-ramp wrappers' wire contracts,
and the x402 sign→encode→decode→verify round-trip.

To exercise the on-chain paths end-to-end:
- **RPC** — set `VITE_ETH_RPC_URL` (and friends) in `.env.local` for live balances.
- **DeFi (Aave / Velora / USDT0)** — public infra, no keys. Use a funded EVM
  account on Ethereum/Polygon/Arbitrum; supply a small USDC amount, get a swap
  quote, or bridge USDT Ethereum⇄Arbitrum.
- **Gasless + Smart Account** — set `VITE_BUNDLER_URL` (+ optional
  `VITE_PAYMASTER_URL`) from Pimlico/Stackup/etc.; the ⚡ toggle and Smart Account
  view then run UserOperations.
- **MoonPay** — set `VITE_MOONPAY_API_KEY` (publishable); defaults to sandbox.
- **x402** — sign a challenge from the wallet (`X402_CREATE_PAYMENT`) and verify
  with the `wdk-checkout/x402` facilitator or the Cloudflare Worker example.

> Screenshots in the README were captured headlessly against a throwaway wallet;
> regenerate them after wiring RPC so balances render.

## Recording tips
- 1280×800, hide bookmarks/other extensions for a clean frame.
- Use a fresh browser profile so the WDK Wallet is the only wallet (or keep MetaMask installed for the EIP-6963 coexistence moment).
- Never show a real seed phrase tied to real funds — use a throwaway wallet.
