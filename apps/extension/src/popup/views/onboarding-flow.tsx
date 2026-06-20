/**
 * OnboardingFlow (B5.4.3) - state machine routing for first-run onboarding.
 *
 * Wraps the OnboardingChoice screen + CreateVaultView + ImportVaultView into
 * a single component that handles the user's "create vs import" decision and
 * routes to the appropriate flow. App.tsx mounts this directly when vault
 * state is 'no-vault' instead of routing to CreateVaultView/ImportVaultView
 * itself - keeping app.tsx's outer routing focused purely on vault-lifecycle
 * state (loading / no-vault / locked / unlocked / error).
 *
 * State machine (3 modes):
 *   choice  - OnboardingChoice rendered; user picks create or import
 *   create  - CreateVaultView rendered; generates new mnemonic flow
 *   import  - ImportVaultView rendered; user pastes existing mnemonic
 *
 * Both 'create' and 'import' branches forward onVaultReady up to app.tsx via
 * the respective onVaultCreated / onVaultImported callbacks. The two view
 * callbacks have different names because they reflect different semantics
 * ("wallet just created" vs "wallet just imported") but here they collapse
 * to the same parent action: refresh vault state so app.tsx re-routes to
 * UnlockedRouter -> MainView.
 *
 * v0.1 limitation: no back-from-mid-flow navigation. If a user picks "Create"
 * then realises they meant "Import", they must reload the popup to start over.
 * Industry pattern (Phantom, MetaMask) allows back navigation - candidate for
 * B5.4.4 polish via optional onBack props on CreateVaultView + ImportVaultView.
 * Tracked in NOTES.md.
 */

import { useState } from 'react';
import { OnboardingChoice } from './onboarding-choice.js';
import { CreateVaultView } from './create-vault-view.js';
import { ImportVaultView } from './import-vault-view.js';

export interface OnboardingFlowProps {
  /** Called after the user successfully creates OR imports a vault. Parent
   *  should refresh vault state so the app routes to UnlockedRouter -> MainView. */
  readonly onVaultReady: () => void;
}

type OnboardingMode = 'choice' | 'create' | 'import';

export function OnboardingFlow({ onVaultReady }: OnboardingFlowProps): JSX.Element {
  const [mode, setMode] = useState<OnboardingMode>('choice');

  if (mode === 'choice') {
    return (
      <OnboardingChoice
        onCreateNew={() => setMode('create')}
        onImport={() => setMode('import')}
      />
    );
  }

  if (mode === 'create') {
    return <CreateVaultView onVaultCreated={onVaultReady} onBack={() => setMode('choice')} />;
  }

  // mode === 'import'
  return <ImportVaultView onVaultImported={onVaultReady} onBack={() => setMode('choice')} />;
}