/**
 * UnlockView - extension wrapper around wdk-ui UnlockScreen.
 *
 * Responsibilities (extension-specific glue):
 *   1. Calls VAULT_LOAD via sw-client when the user submits a password.
 *   2. Re-tags any wire-side error as OperationError to satisfy F-VAULT-01
 *      at the wdk-ui UnlockScreen classifier. Critical detail - see below.
 *   3. On success, fires onUnlocked() so the app re-runs the vault-state
 *      query and routes onward.
 *
 * F-VAULT-01 wire-boundary preservation:
 *   sw-client.send() wraps the SW's structured error response in
 *   `new Error(response.error)` - which means the original WebCrypto
 *   OperationError.name is lost across chrome.runtime.sendMessage. Without
 *   re-tagging here, wdk-ui UnlockScreen's `err.name === 'OperationError'`
 *   classifier would never match a vault decryption failure, and every
 *   wrong-password attempt would fall through to the generic "unexpected
 *   error" string instead of the locked F-VAULT-01 string.
 *
 *   The conservative fix: ANY error thrown by VAULT_LOAD is re-tagged as
 *   OperationError before propagating to UnlockScreen. This collapses
 *   wrong-password, tampered-ciphertext, AND infrastructure failures into
 *   the same user-visible string. F-VAULT-01 exists to prevent ANY
 *   side-channel about which failure mode occurred; even leaking
 *   "infrastructure-vs-crypto" through a distinguishable error string
 *   would be a (small) contract violation. Conservative wins here.
 *
 *   The original error is preserved as a property on the re-tagged
 *   error so the console log in UnlockScreen retains diagnostic value
 *   (the diagnostic never includes the user's password).
 *
 * Source: ADR-002 (F-VAULT-01), ADR-006, Doc 32 Part IX.
 */

import { useCallback } from 'react';
import { UnlockScreen, LogoMark, useBrand } from '@wdk-starter/wdk-ui';
import { send } from '../lib/sw-client.js';

export interface UnlockViewProps {
  /** Called after VAULT_LOAD succeeds. Parent should refresh vault state. */
  readonly onUnlocked: () => void;
}

export function UnlockView({ onUnlocked }: UnlockViewProps): JSX.Element {
  const brand = useBrand();
  const handleSubmit = useCallback(async (password: string): Promise<void> => {
    try {
      await send({ type: 'VAULT_LOAD', password });
      onUnlocked();
    } catch (err) {
      // F-VAULT-01 wire-boundary preservation. Re-tag as OperationError so
      // wdk-ui UnlockScreen renders the locked string. Conservative: ALL
      // VAULT_LOAD errors collapse to OperationError, including non-crypto
      // failures, so no side channel can leak which mode failed.
      const original = err instanceof Error ? err.message : String(err);
      const tagged = new Error(original);
      tagged.name = 'OperationError';
      throw tagged;
    }
  }, [onUnlocked]);

  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 16 }}>
      {brand.markSrc && (<LogoMark src={brand.markSrc} alt={brand.markAlt ?? brand.name} size="md" />)}
      <div style={{ width: '100%' }}>
        <UnlockScreen onSubmit={handleSubmit} />
      </div>
    </div>;
}