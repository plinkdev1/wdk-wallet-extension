/**
 * MV3 SW `document` polyfill. F-MV3-03.
 *
 * WDK's EVM wallet-manager dependency tree references the bare `document`
 * identifier somewhere in its chain registration path, throwing
 * ReferenceError in the MV3 SW context (which has no DOM).
 *
 * This file MUST be the FIRST import in the SW entry, BEFORE
 * polyfill-globals from wdk-web-core. ES module evaluation order
 * guarantees this module body runs before any subsequent import is
 * evaluated.
 *
 * The stub is a plain empty object so property reads return undefined
 * silently - WDK's try/catch patterns (see F-BIP39-01) handle that.
 * The typeof guard prevents clobbering a real `document` if this code
 * is ever evaluated in a tab/popup context.
 *
 * Lives in apps/extension (not wdk-web-core) because vite-plugin-node-
 * polyfills strips the document assignment when it co-exists in
 * polyfill-globals.ts with the Buffer/process imports - the plugin
 * appears to rewrite files that import 'buffer'/'process', dropping
 * our manual globalThis assignments. Isolating the document stub in
 * a separate file with no other imports keeps it out of the plugin's
 * path. Empirically verified B3.4c smoke-load 2026-05-19.
 */

// Empty-object stub fixes the bare-`document` ReferenceError, but WDK's
// EVM chain registration actually CALLS methods on `document` -
// specifically getElementsByTagName, empirically observed in the B3.4c
// smoke-load. Likely a DOM-probing pattern looking for <script> tags
// (CSP nonce detection or data-attribute config extraction). Use a
// Proxy that returns benign defaults for the common DOM-query API
// surface. Catch-all returns undefined; WDK's try/catch patterns
// (see F-BIP39-01) tolerate that.
// Recursive self-stub: any property/call/construct on `document`
// returns the same Proxy. This handles chained DOM access patterns
// like `document.createElement('div').setAttribute('id', x)` or
// `document.head.appendChild(link)` without crashing.
//
// Specific traps handle common iteration semantics:
//   .length          -> 0   (for-loops over collections don't iterate)
//   [Symbol.iterator] -> empty generator (for-of yields nothing)
//   [Symbol.toPrimitive] / .toString -> '' (string coercion safe)
//   .valueOf         -> undefined
//
// The catch-all return-self fakes "operation succeeded" for WDK's
// DOM-side-effect code (likely script-tag injection or DOM probing
// for environment detection). EVM key derivation is pure crypto -
// it doesn't actually USE the DOM, so making DOM ops no-op is safe.
//
// The `let docStub: any` with deferred assignment is required because
// the Proxy handlers reference docStub via closure (TS would error on
// const used-before-declaration; let permits it).
let docStub: unknown;
docStub = new Proxy(function () { /* proxy target */ }, {
  get(_t, prop): unknown {
    if (prop === 'length') return 0;
    if (prop === Symbol.iterator) return function* () { /* empty */ };
    if (prop === Symbol.toPrimitive || prop === 'toString') return () => '';
    if (prop === 'valueOf') return () => undefined;
    return docStub;
  },
  set(): boolean { return true; },
  apply(): unknown { return docStub; },
  construct(): object { return docStub as object; },
});

if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  (globalThis as { document?: unknown }).document = docStub;
}

// `window` is also referenced as a bare identifier by WDK's environment
// detection. Reuse the same recursive proxy - functionally indistinguishable
// from document for stubbing purposes (both surfaces are no-op proxies).
// If WDK later needs window-specific properties (e.g. window.location.origin
// for a CSRF check), upgrade to a smarter stub then.
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as { window?: unknown }).window = docStub;
}

export {};