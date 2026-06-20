import { useCallback, useState } from 'react';
import { MnemonicGrid, PasswordSetupScreen, Button } from '@wdk-starter/wdk-ui';
import { send } from '../lib/sw-client.js';

/**
 * ImportVaultView - lets the user restore an existing wallet from a BIP-39 phrase.
 *
 * B5.4.5 rewrite: inline styles + wdk-ui Button (was Tailwind classes that didn't
 * render in the popup, per L-WDK-UI-01). Adds optional onBack prop for OnboardingFlow
 * back-navigation.
 *
 * State machine + handler logic unchanged from B5.4.2 / B5.4.4:
 *   input-mnemonic   - MnemonicGrid for paste-anywhere-fills-all phrase entry
 *   password-setup   - PasswordSetupScreen for vault password creation
 *   storing          - SW call in flight (VAULT_STORE + VAULT_LOAD)
 *   complete         - done; onVaultImported fires
 *
 * L-REACT-03 invariant preserved: 'complete' kind has NO mnemonic field; 'storing'
 * captures mnemonic in closure scope only, never in React state.
 */

export interface ImportVaultViewProps {
  readonly onVaultImported: () => void;
  /** Optional back button - when provided, renders a Back link at top-left.
   *  OnboardingFlow uses this to return to the choice screen. */
  readonly onBack?: () => void;
}

type ImportState =
  | { kind: 'input-mnemonic'; mnemonic: string; error: string | null; validating: boolean }
  | { kind: 'password-setup'; mnemonic: string }
  | { kind: 'storing' }
  | { kind: 'complete' };

const normalize = (s: string): string => s.trim().replace(/\s+/g, ' ');

export function ImportVaultView({ onVaultImported, onBack }: ImportVaultViewProps): JSX.Element {
  const [state, setState] = useState<ImportState>({
    kind: 'input-mnemonic',
    mnemonic: '',
    error: null,
    validating: false,
  });

  const handleContinueFromMnemonic = useCallback(async (): Promise<void> => {
    if (state.kind !== 'input-mnemonic' || state.validating) return;
    const normalized = normalize(state.mnemonic);
    if (normalized.length === 0) {
      setState({ ...state, error: 'Please enter your recovery phrase.' });
      return;
    }
    setState({ ...state, validating: true, error: null });
    try {
      const valid = await send({ type: 'BIP39_VALIDATE_MNEMONIC', mnemonic: normalized });
      if (!valid) {
        setState({
          kind: 'input-mnemonic',
          mnemonic: state.mnemonic,
          validating: false,
          error: 'Not a valid recovery phrase. Check for typos or wrong words.',
        });
        return;
      }
      setState({ kind: 'password-setup', mnemonic: normalized });
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Validation failed. Please try again.';
      setState({
        kind: 'input-mnemonic',
        mnemonic: state.mnemonic,
        validating: false,
        error: msg,
      });
    }
  }, [state]);

  const handlePasswordSubmit = useCallback(async (password: string): Promise<void> => {
    if (state.kind !== 'password-setup') return;
    const mnemonic = state.mnemonic;
    setState({ kind: 'storing' });
    try {
      await send({ type: 'VAULT_STORE', mnemonic, password });
      await send({ type: 'VAULT_LOAD', password });
      setState({ kind: 'complete' });
      onVaultImported();
    } catch (err) {
      setState({ kind: 'password-setup', mnemonic });
      throw err;
    }
  }, [state, onVaultImported]);

  const handleMnemonicChange = useCallback((next: string): void => {
    setState((prev) => {
      if (prev.kind !== 'input-mnemonic') return prev;
      return { ...prev, mnemonic: next, error: prev.error ? null : prev.error };
    });
  }, []);

  // Inline-styled back button - rendered only when onBack provided.
  // Same render in input-mnemonic step ONLY (mid-flow back from password-setup
  // would lose the validated mnemonic + cause confusion).
  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to choice"
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: 13,
        padding: '4px 0',
        alignSelf: 'flex-start',
        opacity: 0.7,
        fontFamily: 'var(--font-body)',
      }}
    >
      {'\u2190'} Back
    </button>
  ) : null;

  switch (state.kind) {
    case 'input-mnemonic': {
      const canContinue = !state.validating && normalize(state.mnemonic).length > 0;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 20,
            minHeight: 400,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          {backButton}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Import existing wallet</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.72, lineHeight: 1.5 }}>
              Enter the 12- or 24-word recovery phrase from the wallet you want to import.
            </p>
          </div>
          <MnemonicGrid
            onChange={handleMnemonicChange}
            error={state.error}
            disabled={state.validating}
          />
          <Button
            onClick={handleContinueFromMnemonic}
            disabled={!canContinue}
            style={{ width: '100%' }}
          >
            {state.validating ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    animation: 'wdk-spin 700ms linear infinite',
                  }}
                />
                Validating...
              </span>
            ) : 'Continue'}
          </Button>
          <style>{`@keyframes wdk-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    case 'password-setup':
      return <PasswordSetupScreen onSubmit={handlePasswordSubmit} />;
    case 'storing':
      return (
        <div
          role="status"
          aria-label="Importing wallet"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            padding: 24,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            gap: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.72 }}>Importing wallet...</div>
        </div>
      );
    case 'complete':
      return (
        <div
          role="status"
          aria-label="Wallet imported"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            padding: 24,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
            gap: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.72 }}>Wallet imported.</div>
        </div>
      );
  }
}