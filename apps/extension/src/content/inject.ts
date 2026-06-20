/**
 * Inject the inpage script into the page's main world via a <script> tag.
 * Sets script.dataset.uuid before appending so the inpage script can read it
 * via document.currentScript at top-level evaluation.
 *
 * The inpage script's URL comes from chrome.runtime.getURL() - it must be a
 * web_accessible_resource per the manifest. This is set up in manifest.config.ts
 * by B4.2 alongside this file.
 *
 * Per PRD 01 Addendum S12.6.4. Pattern matches Phantom / Metamask injection.
 */

export interface InjectDeps {
  /** Resolve an extension-relative path to a fully-qualified chrome-extension:// URL. */
  readonly getURL: (path: string) => string;
  /** Per-install UUID passed to inpage via the script's dataset. */
  readonly uuid: string;
  /** Optional icon URL (chrome-extension:// or data URI) for EIP-6963 announce.
   *  Passed via script.dataset.icon so inpage can read it from document.currentScript.
   *  Omit to let the inpage script fall back to its built-in placeholder. */
  readonly icon?: string;
  /** Optional override of the inpage script path (default matches manifest). */
  readonly inpagePath?: string;
  /** Optional target element override (default: document.head ?? documentElement). */
  readonly target?: Element;
}

/**
 * Inject the inpage script. Returns the created script element (mostly useful
 * for tests; in production the script can be left in place or removed after
 * load, both work).
 */
export function injectInpage(deps: InjectDeps): HTMLScriptElement {
  const path = deps.inpagePath ?? 'inpage.js';
  const script = document.createElement('script');
  script.src = deps.getURL(path);
  script.dataset.uuid = deps.uuid;
  if (deps.icon !== undefined) {
    script.dataset.icon = deps.icon;
  }
  // Synchronous injection - script tag loads as classical script.
  // type="module" is intentionally omitted; @crxjs handles the bundle format.
  const target = deps.target ?? document.head ?? document.documentElement;
  target.appendChild(script);
  return script;
}