# WalletConnect v2 bridge (Phase 5 seam)

A WalletConnect `session_request` is an EIP-1193 call from a remote dApp, so it
routes through the **same** handler chain as the injected provider — same
approval prompt, same per-origin allow-list, zero duplicated signing logic.

`bridge.ts` is the buildable, unit-tested glue. To go live, wire three adapters:

1. **`client`** — implement `WalletConnectClient` over `@walletconnect/sign-client`:
   ```ts
   import SignClient from '@walletconnect/sign-client'
   const sign = await SignClient.init({ projectId, metadata })
   const client = {
     approveSession: (a) => sign.approve(a),
     rejectSession: (a) => sign.reject(a),
     respondSessionRequest: (a) => sign.respond(a),
     on: (e, cb) => sign.on(e, cb),
   }
   ```
2. **`router`** — pass the existing dApp dispatcher:
   ```ts
   const dispatch = createDappDispatcher(createDappHandlers({ engine, worker, approvalFlow, connectionState }))
   const router = (req, ctx) => dispatch(req, ctx)
   ```
   (A WC request now hits `personal_sign` / `eth_sendTransaction` / … exactly like an injected one — including `approvalFlow.open()`.)
3. **`approveProposal`** — open the approval flow for the proposal and, on approve,
   build the CAIP-25 `namespaces` from the accounts/chains the user granted, then
   record the session via `connectionState.approve(originForTopic(topic), chains, indices)`.

Then `createWalletConnectBridge({ client, router, approveProposal }).start()`.
Manage sessions in the existing **Settings → Connections** UI (a WC session is
just another origin: `wc:<topic>`); `connectionState.revoke()` disconnects it.

> The relay (network) is the only piece that needs connectivity to exercise
> end-to-end; the bridge logic is fully covered by `bridge.spec.ts`.
