/**
 * UnlockScreen - composes PasswordInput + AdaptiveSpinner + submit flow.
 *
 * The screen the user sees when they open a wallet that has a stored vault.
 * Per ADR-006 ("No Persistent Unlock"), this screen is mandatory on every
 * fresh session - there is no remember-me option, no biometric quick path
 * in v1.0.
 *
 * Parent provides an async `onSubmit(password)` callback. The screen:
 *   1. captures password input
 *   2. on submit (button click or Enter key) flips pending=true
 *   3. awaits onSubmit(password)
 *   4. on success: parent navigates away; this component doesn't care
 *   5. on throw: maps the error to a user-facing string per F-VAULT-01
 *
 * F-VAULT-01 (Vault generic error contract): WebCrypto's OperationError
 * does NOT distinguish wrong-password from tampered-ciphertext (anti
 * side-channel by design). The user-facing string MUST be the same for
 * both failure modes. We hardcode the canonical string from ADR-002:
 *
 *   "Incorrect password or corrupted vault data. Please try again."
 *
 * This is non-negotiable. The parent's `onSubmit` may throw whatever error
 * shape it likes - if the error's `name === 'OperationError'` we render
 * the locked string. Other errors get a generic "unexpected error" fallback.
 * The parent CANNOT inject a custom error string for the OperationError
 * case (security guarantee, not a styling concern).
 *
 * Adaptive spinner per F-WEBCRYPTO-01: only shown if onSubmit takes >300ms.
 * On modern Chrome with hardware-accelerated PBKDF2, unlock typically lands
 * in ~100-200ms - spinner never appears, UX feels instant.
 *
 * Source: ADR-002 (Vault), ADR-006 (No Persistent Unlock), Doc 32 Part II.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '../../primitives/button.js';
import { Label } from '../../primitives/label.js';
import { PasswordInput } from './password-input.js';
import { AdaptiveSpinner } from './adaptive-spinner.js';

/**
 * F-VAULT-01 locked error string. Exported for parents that want to
 * cross-reference (e.g., test assertions). Do not localize this string
 * differently per failure mode - wrong-password and tampered-ciphertext
 * MUST collapse to the same user-visible string.
 */
export const F_VAULT_01_ERROR_STRING =
  'Incorrect password or corrupted vault data. Please try again.';

const GENERIC_ERROR_STRING = 'An unexpected error occurred. Please try again.';

export interface UnlockScreenProps {
  /**
   * Async callback fired when the user submits a password. Should throw
   * on failure (the screen maps OperationError -> F-VAULT-01 string,
   * other errors -> generic). On success the parent should navigate.
   */
  readonly onSubmit: (password: string) => Promise<void>;
  /** Defaults to "Unlock Wallet". */
  readonly title?: string;
  /** Optional subtitle below the title. */
  readonly subtitle?: string;
}

export function UnlockScreen(props: UnlockScreenProps): JSX.Element {
  const {
    onSubmit,
    title = 'Unlock Wallet',
    subtitle = 'Enter your password to continue.',
  } = props;

  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (pending) return;
    if (password.length === 0) {
      setErrorMessage(F_VAULT_01_ERROR_STRING);
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      await onSubmit(password);
      // parent navigates; this component stays mounted briefly until unmount
    } catch (err) {
      // F-VAULT-01: collapse wrong-pw + tampered into the locked string.
      // Any OperationError (or anything that masquerades with name='OperationError') gets the locked text.
      if (err instanceof Error && err.name === 'OperationError') {
        setErrorMessage(F_VAULT_01_ERROR_STRING);
      } else {
        setErrorMessage(GENERIC_ERROR_STRING);
      }
      // eslint-disable-next-line no-console -- diagnostic; never includes plaintext password
      console.error('[UnlockScreen] vault load failed:', err);
    } finally {
      setPending(false);
    }
  };

  const onFormSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleSubmit();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '28px 32px',
        width: '100%',
        boxSizing: 'border-box',
        flex: 1,
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h1>
        <p
          style={{
            margin: '8px 0 0 0',
            paddingRight: 4,
            fontSize: 13,
            opacity: 0.72,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      </div>

      <form onSubmit={onFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label htmlFor="wdk-unlock-password" style={{ fontSize: 12, opacity: 0.72 }}>
          Password
        </Label>
        <PasswordInput
          id="wdk-unlock-password"
          value={password}
          onChange={setPassword}
          onSubmit={() => { void handleSubmit(); }}
          autoFocus
          disabled={pending}
        />

        {errorMessage && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--color-error, #EF4444)',
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <Button
            type="submit"
            disabled={pending || password.length === 0}
            style={{ width: '100%' }}
          >
            {pending ? 'Unlocking...' : 'Unlock'}
          </Button>
          {pending ? (
            <div style={{ alignSelf: 'center' }}>
              <AdaptiveSpinner pending={pending} label="Unlocking..." />
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}