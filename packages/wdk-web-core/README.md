# `@wdk-starter/wdk-web-core`

Framework-agnostic engine for WDK-based browser wallet products. Consumed by:

- `apps/nextjs-template` - Next.js Template Wallet (Phase 1 Session 03 work)
- `apps/extension` - Browser Extension Starter (Phase 1 Session 04 work)

## Public surface

Each entry below is an independent import path per the exports map in `package.json`:

| Import path | Contents | Status |
|---|---|---|
| `@wdk-starter/wdk-web-core` | Re-exports of `./types` (barrel) | Step 1 - done |
| `@wdk-starter/wdk-web-core/types` | EvmAccount, SolanaAccount, ChainId, WalletWorkerApi, MV3 envelopes | Step 1 - done |
| `@wdk-starter/wdk-web-core/polyfill-globals` | Side-effect module for MV3 SW bootstrap (ADR-011) | Step 2 |
| `@wdk-starter/wdk-web-core/vault` | WebCryptoVault (PBKDF2 + AES-GCM, port of Phase 0 prototype) | Step 3 |
| `@wdk-starter/wdk-web-core/worker` | `createWalletWorkerApi` factory (Comlink-exposed) | Step 6 |
| `@wdk-starter/wdk-web-core/adapters/relayer` | RelayerAdapter interface + impls | Step 8 |

Implementation order and acceptance criteria: see `docs/15_PHASE_1_KICKOFF_HANDOVER.md` Part V.

## Architectural constraints (LOCKED)

- **ADR-008** - polyfill recipe (sodium-javascript explicit dep + Buffer/global/process polyfills via framework plugin)
- **ADR-009** - BIP-44 derivation paths (`m/44'/60'/0'/0/0` EVM, `m/44'/501'/0'/0'` Solana)
- **ADR-010** - Comlink as Web Worker message bus with FLAT method names (`vault_store`, never `vault.store`)
- **ADR-011** - MV3 SW bootstrap requires `polyfill-globals.ts` first-import + `'wasm-unsafe-eval'` CSP

## Development

From the workspace root:

    pnpm --filter @wdk-starter/wdk-web-core typecheck
    pnpm --filter @wdk-starter/wdk-web-core build