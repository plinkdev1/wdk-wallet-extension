/**
 * UnlockedRouter - routes between the post-unlock screens.
 *
 * Two views internally:
 *   - 'main': MainView (the actual wallet UI - balance, address, send/receive)
 *   - 'wallet-settings': WalletSettingsView (account/security/network/advanced)
 *
 * The header gear in MainView toggles between these two via onOpenSettings.
 *
 * NOTE on naming: the MainView prop is still called `onOpenSettings` for
 * backwards-compatibility with main-view.spec.tsx (which we did not have
 * to update for this commit). Semantically it opens the WALLET settings
 * view now, not the dev/brand customization view - that one lives at the
 * App level behind the corner gear.
 *
 * UnlockedRouter no longer takes themeState/brandState props because the
 * SettingsView (dev customization) is no longer reached through this
 * router - it is mounted directly by App.tsx as a full-screen overlay
 * when the corner gear is clicked.
 */

import { useState } from 'react';
import { MainView } from './main-view.js';
import { WalletSettingsView } from './wallet-settings/index.js';

export interface UnlockedRouterProps {
  readonly onLockRequested: () => void;
}

export function UnlockedRouter({ onLockRequested }: UnlockedRouterProps): JSX.Element {
  const [view, setView] = useState<'main' | 'wallet-settings'>('main');

  if (view === 'wallet-settings') {
    return <WalletSettingsView onBack={() => setView('main')} />;
  }

  return (
    <MainView
      onLockRequested={onLockRequested}
      onOpenSettings={() => setView('wallet-settings')}
    />
  );
}