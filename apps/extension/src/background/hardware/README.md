# Hardware-wallet signing (Phase 5 seam)

A hardware-backed account signs on an external device (Ledger/Trezor) — the
seed-derived key is never used for it. The signing path has a single chokepoint
(the worker's `account_sign*` / `account_sendTransaction`), so the routing is
small and testable.

`signer.ts` is the buildable, unit-tested registry + router. To go live:

1. **Implement `HardwareSigner`** over a transport adapter, e.g. Ledger via
   WebHID + `@ledgerhq/hw-app-eth`:
   ```ts
   const ledger: HardwareSigner = {
     id: 'ledger-nano-x',
     getAddress: (chain, i) => eth.getAddress(pathFor(chain, i)).then(r => r.address),
     signMessage: (chain, i, msg) => eth.signPersonalMessage(pathFor(chain, i), toHex(msg)).then(toSig),
     signTypedData: (chain, i, td) => eth.signEIP712Message(pathFor(chain, i), td).then(toSig),
     signTransaction: (chain, i, tx) => eth.signTransaction(pathFor(chain, i), serialize(tx)).then(toSig),
   }
   ```
2. **Register** the device per account the user pairs:
   `registry.register('ethereum', 0, ledger)`.
3. **Consult the registry at the chokepoint** — in the EVM signing handlers (or,
   for the shared engine, inject the registry into `WalletWorker` and guard the
   three `account_*` methods):
   ```ts
   return routeSignMessage(registry, chain, index, message, () => worker.account_signMessage(chain, index, message))
   ```
   The dApp/WalletConnect handlers and the approval flow are unchanged — only the
   final sign is redirected to the device.

List paired devices in **Settings → Security** via `registry.list()`.

> A physical device is the only piece needed to exercise this end-to-end; the
> registry + routing are fully covered by `signer.spec.ts`.
