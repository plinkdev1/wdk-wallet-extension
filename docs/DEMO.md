# Demo Video Script (2–5 min)

A tight walkthrough for the bounty demo video. Aim for ~3 minutes.

## Setup (before recording)
- `pnpm install && pnpm build`
- Load `apps/extension/dist/` unpacked in Chrome **and** Brave (show it runs on both).
- Have a testnet faucet tab ready (e.g. Sepolia) and a dApp tab (any EIP-1193 site, or `https://metamask.github.io/test-dapp/`).

## Beats

**0:00 — Intro (20s)**
> "This is the WDK Wallet — a self-custodial, multi-chain browser extension built on Tether's Wallet Development Kit. Everything you'll see is open source and backed by 811 automated tests."

Show the repo README, then the extension icon in the toolbar.

**0:20 — Create a wallet (35s)**
- Open the popup → **Create new wallet**.
- Show the BIP-39 recovery phrase, the verify step, and password setup.
- Land on the dashboard. Call out: *"The seed is encrypted with AES-GCM and stored locally — it never leaves this service worker."*

**0:55 — Multi-chain (30s)**
- Open the chain selector. Switch between **Plasma, Ethereum, Polygon, Arbitrum, Solana**.
- Point out the live address and balance per chain, and that the same seed derives every account.

**1:25 — Lock & unlock (20s)**
- Click **Lock**. Reopen → unlock with the password.
- Mention auto-lock: *"It also auto-locks on idle, using chrome.alarms so the timer survives the service worker being killed."*

**1:45 — Connect to a dApp (50s)**
- Open the dApp tab. Click **Connect**.
- Show the **approval prompt** with the origin. Approve.
- Trigger a `personal_sign` → show the dedicated signing review screen → approve.
- Note: *"The wallet announces itself via EIP-6963, so it's discovered alongside other wallets, and every action requires explicit, per-origin approval."*

**2:35 — Security & architecture (25s)**
- Flash the architecture diagram from the README.
- *"All keys live in the service worker behind an allow-listed message bus. The popup is a pure view — it can't read a private key."*

**3:00 — Outro (15s)**
- *"Open source, MIT licensed, documented end to end. A reference you can fork to ship a production WDK wallet."*
- Show the GitHub URL.

## Recording tips
- 1280×800, hide bookmarks/other extensions for a clean frame.
- Use a fresh browser profile so the WDK Wallet is the only wallet (or keep MetaMask installed for the EIP-6963 coexistence moment).
- Never show a real seed phrase tied to real funds — use a throwaway wallet.
