/**
 * CreateVaultView (B5.2) - real wallet onboarding flow.
 *
 * Local state machine that orchestrates the wdk-ui onboarding primitives
 * (MnemonicDisplay, MnemonicVerify, PasswordSetupScreen) into a 5-step
 * create-vault flow. Used by the popup when useVaultState reports 'no-vault'.
 *
 * Flow:
 *   1. Mount -> send BIP39_GENERATE_MNEMONIC -> SW returns 12-word string.
 *      Per ADR-001 + ADR-006 the bip39 library + entropy source live in the
 *      SW; the popup gets the result but cannot independently generate.
 *   2. mnemonic-display: MnemonicDisplay (blurred, ack-gated copy) wrapped
 *      in MnemonicDisplayStep which adds a Continue button gated on the
 *      same acknowledge state. Two-button UX (Copy + Continue) both gated
 *      on the same checkbox; users can copy AND continue once they have
 *      confirmed they saved the phrase.
 *   3. mnemonic-verify: MnemonicVerify (3 random-position challenge,
 *      case-insensitive + whitespace-tolerant). On success advances.
 *   4. password-setup: PasswordSetupScreen (4-tier strength meter +
 *      confirm + validation cascade). On submit triggers store sequence.
 *   5. storing (transient): VAULT_STORE then VAULT_LOAD called in sequence.
 *      VAULT_STORE persists the encrypted vault; VAULT_LOAD unlocks the
 *      engine so MainView can immediately show the account. Without this
 *      auto-unlock the user would route back to UnlockView and have to
 *      enter the password they JUST set - bad UX. Industry pattern (Phantom,
 *      MetaMask both auto-unlock after create).
 *   6. complete: onVaultCreated callback. Parent (app.tsx) refreshes vault
 *      state which now resolves to 'unlocked' -> routes to UnlockedRouter
 *      -> MainView.
 *
 * Mnemonic lifecycle: held in local React state from generation through
 * VAULT_STORE. Once stored, the state transitions to { status: 'complete' }
 * which has NO mnemonic field. The discriminated union design ENFORCES
 * that the plaintext mnemonic cannot accidentally outlive the storage
 * step - it is physically impossible to write `state.mnemonic` after
 * transition since the type doesn't have that field. React's reconciler
 * clears the old state branch; GC reclaims the string. Defense in depth
 * per master agent direction.
 *
 * Error handling:
 *   - Generation failure: shows ErrorView with Retry that re-triggers
 *     BIP39_GENERATE_MNEMONIC via key bump.
 *   - VAULT_STORE / VAULT_LOAD failure: PasswordSetupScreen catches the
 *     onSubmit throw and displays the message via its own role="alert"
 *     region. User can retry with the same password (transient SW issue)
 *     or restart by reloading the popup (re-generates a fresh mnemonic;
 *     the prior generated mnemonic is unrecoverable from popup memory).
 *
 * Source: 5e01358 (B5.1 onboarding primitives), 549340c (B5.2.0 bip39
 * SW handler), master agent B5.2 design call.
 */

import { useEffect, useState } from 'react';
import { MnemonicDisplay, MnemonicVerify, PasswordSetupScreen, Button } from '@wdk-starter/wdk-ui';
import { send } from '../lib/sw-client.js';

export interface CreateVaultViewProps {
  /** Called after VAULT_STORE + VAULT_LOAD both succeed. Parent should
   *  refresh vault state so the app routes to UnlockedRouter -> MainView. */
  readonly onVaultCreated: () => void;
  /** Optional back button - when provided, renders a Back link at top-left
   *  of the mnemonic-display step (the first user-interactive step). OnboardingFlow
   *  wires this to return to the choice screen. Not shown mid-flow (verify / password)
   *  to avoid losing progress on a step the user has invested time into. */
  readonly onBack?: () => void;
}

type CreateVaultState =
  | { status: 'generating-mnemonic' }
  | { status: 'mnemonic-display'; mnemonic: string }
  | { status: 'mnemonic-verify'; mnemonic: string }
  | { status: 'password-setup'; mnemonic: string }
  | { status: 'complete' }
  | { status: 'generation-error'; error: string };

export function CreateVaultView({ onVaultCreated, onBack }: CreateVaultViewProps): JSX.Element {
  const [state, setState] = useState<CreateVaultState>({ status: 'generating-mnemonic' });
  // Bumped to retry generation after an error.
  const [generationKey, setGenerationKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'generating-mnemonic' });
    void (async () => {
      try {
        const mnemonic = await send({ type: 'BIP39_GENERATE_MNEMONIC' });
        if (cancelled) return;
        setState({ status: 'mnemonic-display', mnemonic });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'generation-error', error: message });
      }
    })();
    return () => { cancelled = true; };
  }, [generationKey]);

  // --- Render branches by status ---

  if (state.status === 'generating-mnemonic') {
    return <LoadingView />;
  }

  if (state.status === 'generation-error') {
    return <ErrorView error={state.error} onRetry={() => setGenerationKey((k) => k + 1)} />;
  }

  if (state.status === 'mnemonic-display') {
    const mnemonic = state.mnemonic;
    return (
      <MnemonicDisplayStep
        mnemonic={mnemonic}
        onContinue={() => setState({ status: 'mnemonic-verify', mnemonic })}
        {...(onBack !== undefined ? { onBack } : {})}
      />
    );
  }

  if (state.status === 'mnemonic-verify') {
    const mnemonic = state.mnemonic;
    return (
      <MnemonicVerify
        mnemonic={mnemonic}
        onVerified={() => setState({ status: 'password-setup', mnemonic })}
      />
    );
  }

  if (state.status === 'password-setup') {
    const mnemonic = state.mnemonic;
    return (
      <PasswordSetupScreen
        onSubmit={async (password) => {
          await send({ type: 'VAULT_STORE', password, mnemonic });
          await send({ type: 'VAULT_LOAD', password });
          // CRITICAL: transition to 'complete' clears the mnemonic from
          // state via the discriminated union - subsequent code paths
          // cannot reference state.mnemonic because it does not exist.
          setState({ status: 'complete' });
          onVaultCreated();
        }}
      />
    );
  }

  // state.status === 'complete' - brief render before parent unmounts us.
  return <CompleteView />;
}

// ----------------------------------------------------------------------------
// Local helper components
// ----------------------------------------------------------------------------

function MnemonicDisplayStep(props: {
  readonly mnemonic: string;
  readonly onContinue: () => void;
  readonly onBack?: () => void;
}): JSX.Element {
  const { mnemonic, onContinue, onBack } = props;
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {onBack ? (
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
            padding: '12px 24px 0 24px',
            alignSelf: 'flex-start',
            opacity: 0.7,
            fontFamily: 'var(--font-body)',
          }}
        >
          {'\u2190'} Back
        </button>
      ) : null}
      <MnemonicDisplay
        mnemonic={mnemonic}
        onAcknowledged={setAcknowledged}
      />
      <div style={{ padding: '0 24px 24px 24px' }}>
        <Button
          onClick={onContinue}
          disabled={!acknowledged}
          style={{ width: '100%' }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function LoadingView(): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Generating recovery phrase"
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
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.72 }}>Setting up your wallet...</div>
    </div>
  );
}

function ErrorView(props: {
  readonly error: string;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
        Could not generate recovery phrase
      </h1>
      <p
        role="alert"
        style={{ margin: 0, fontSize: 12, color: 'var(--color-error, #EF4444)' }}
      >
        {props.error}
      </p>
      <Button onClick={props.onRetry}>Try again</Button>
    </div>
  );
}

function CompleteView(): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Wallet created"
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
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.72 }}>Wallet created!</div>
    </div>
  );
}