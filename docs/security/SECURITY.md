# Security Model

A wallet's only job is to protect a secret while still being usable. This document states the threat model, the mitigations, and the responsible-disclosure process. It is required reading before adapting this code for real funds.

## Assets being protected

| Asset | Where it lives | Protection |
|---|---|---|
| BIP-39 mnemonic (the master secret) | IndexedDB, **encrypted**; cleartext only in SW memory after unlock | AES-256-GCM + PBKDF2-SHA-512 (600k) |
| Derived private keys | Service-worker memory only, transiently during signing | Never persisted, never returned across the message bus |
| dApp permissions | `chrome.storage.local` | Per-origin allow-list, user-approved |

## Vault: encryption at rest

- **Cipher:** AES-256-GCM (authenticated encryption — tampering is detected).
- **Key derivation:** PBKDF2-SHA-512 with **600,000 iterations** and a per-vault random salt. This is deliberately expensive to brute-force a weak password.
- **Storage:** the encrypted blob is written to IndexedDB. The cleartext mnemonic is **never** written to `chrome.storage`, disk, or logs.
- **Unlock:** decryption happens only inside the service worker, only after the user supplies the password. A wrong password fails the GCM auth check — no oracle, no partial decryption.

## Runtime key custody

- The decrypted seed and any derived keys exist **only in service-worker memory**, and only while unlocked.
- **No persistent unlock.** MV3 service workers are killed aggressively; every cold respawn starts *locked*. There is no "remember me" that keeps cleartext on disk.
- **Auto-lock** via `chrome.alarms` zeroizes in-memory key state after a configurable idle period. Manual lock does the same on demand.
- The message bus exposes **operations, not secrets**. There is no `getPrivateKey`/`exportSeed`-style method reachable from the popup or a page. Export of the mnemonic (for backup) is gated behind password re-entry in the UI and never crosses to a web page.

## The dispatch boundary (F-SEC-01)

Every message handled by the service worker is checked against an explicit allow-list:

```ts
if (!Object.hasOwn(ALLOWED_METHODS, request.method)) reject();
```

`Object.hasOwn` (not `key in obj`) is used deliberately: the `in` operator walks the prototype chain, so `toString`, `constructor`, `hasOwnProperty`, etc. would falsely pass an `in` check and could invoke unintended behavior. A regression test asserts that prototype methods are rejected.

dApp-originated requests pass through a **second** inner allow-list before any worker method is reachable.

## dApp isolation & anti-phishing

- Pages receive an **EIP-1193 provider with no ambient authority**. Reading the provider is free; *acting* (connect, sign, send) always requires an explicit, per-request user approval.
- **Per-origin permissions.** A site must be connected, and the connection is recorded per origin. The approval UI shows the requesting origin so users can spot look-alike domains.
- **Approval surfaces are explicit and typed.** `personal_sign`, `eth_signTypedData`, `eth_sendTransaction`, and `wallet_addEthereumChain` each render a dedicated review screen rather than a generic "approve?" prompt, so the user sees *what* they are authorizing.
- **No blind signing of opaque payloads** without showing the user the decoded request.

## Injection resistance (Manifest V3 CSP)

- `content_security_policy.extension_pages` is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` — **no remote script** can run in extension pages. `wasm-unsafe-eval` is required (and only used) for WDK's WebAssembly crypto.
- The only main-world code is the inpage provider, shipped as a **web-accessible resource from the extension origin** — it is not fetched from the network.
- The content script runs in an **isolated world**; page scripts cannot reach into it or the worker except through the postMessage bridge, which only forwards allow-listed methods.

## What is explicitly out of scope (for this reference)

- Hardware-wallet / secure-enclave key storage.
- Anti-malware protection on a fully compromised host (a keylogger at the OS level defeats any browser wallet).
- Formal audit. **This is reference software.** Commission an independent security audit before handling significant real funds.

## Responsible disclosure

Found a vulnerability? Please **do not** open a public issue. Email the maintainer (see the repository owner profile) with:

- a description and impact assessment,
- reproduction steps or a proof-of-concept,
- any suggested remediation.

We aim to acknowledge within 72 hours and to coordinate a fix and disclosure timeline with you.

## Security checklist for forks

- [ ] Replace public fallback RPCs with your own keyed endpoints.
- [ ] Review and tighten `host_permissions` to the origins you actually need.
- [ ] Add rate-limiting / anomaly detection to the relayer adapter if you enable sponsored transactions.
- [ ] Commission an independent audit.
- [ ] Set up a security contact and disclosure policy.
