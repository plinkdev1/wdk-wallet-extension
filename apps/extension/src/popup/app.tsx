/**
 * Popup root component.
 *
 * B5.0b: routing shifts from approval-queue-driven (B4.5b) to vault-state-driven.
 * The approval queue still drives the inner routing (UnlockedRouter) but only
 * inside the 'unlocked' branch.
 *
 * Branches:
 *   loading    - useVaultState resolving VAULT_HAS_STORED + GET_LOCK_STATE
 *   no-vault   - first-run state, shows CreateVaultView (placeholder until B5.1)
 *   locked     - vault exists but lock state is 'locked', shows UnlockView
 *   unlocked   - vault loaded, defers to UnlockedRouter for approval vs main routing
 *   error      - vault state fetch failed
 *
 * Per ADR-006 the popup re-enters 'locked' on every fresh session - users
 * see UnlockView on first open after browser restart or SW termination.
 *
 * The WdkThemeProvider stays at the outer level so every branch (including
 * the dev placeholder CreateVaultView) gets the WDK Warm theme tokens.
 */

import { useEffect, useState } from 'react';
import {
  WdkThemeProvider, BrandProvider,
  defaultTheme, composeTheme,
  useThemePicker, useCustomPrimary, useCustomColors,
  useBrandPicker, DEFAULT_WDK_BRAND,
} from '@wdk-starter/wdk-ui';
import { useVaultState } from './hooks/use-vault-state.js';
import { UnlockView } from './views/unlock-view.js';
import { OnboardingFlow } from './views/onboarding-flow.js';
import { UnlockedRouter } from './views/unlocked-router.js';
import { SettingsView } from './views/settings/index.js';

export function App(): JSX.Element {
  const { state, refresh } = useVaultState();

  // B0b: picker state hoisted at the App root so SettingsView toggles
  // flow live into the WdkThemeProvider + BrandProvider below.
  const [baseTheme, setBaseTheme] = useThemePicker(defaultTheme);
  const [customPrimary, setCustomPrimary] = useCustomPrimary();
  const [brand, setBrand] = useBrandPicker(DEFAULT_WDK_BRAND);
  // B0c.per-color: optional bg/text/surface hex overrides (5 named slots)
  const [customColors, setCustomColor, clearAllCustomColors] = useCustomColors();

  // App-level Settings overlay: reachable from ANY vault state (locked,
  // no-vault, unlocked, approval). Replaces the routed view tree when
  // open. ADR-006 means the popup re-locks every session, so gating
  // Settings behind unlock would block end-users from customizing the
  // wallet on first sight. Theme + brand are app-level preferences, not
  // wallet-secret operations.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // B0c.customization-flag: gate Customize UI behind build-time env var.
  // Default ON in dev (env undefined or 'true'); set VITE_WDK_CUSTOMIZATION_UI=false
  // in .env.production to ship a wallet without the picker UI.
  const customizationEnabled = import.meta.env.VITE_WDK_CUSTOMIZATION_UI !== 'false';

  // Custom hex overrides the swatch primary when set; otherwise use the
  // base theme as-is. composeTheme(base, primary, radius, mode) is the
  // canonical compose helper exported from wdk-ui's theme barrel.
  const effectiveTheme = customPrimary !== null
    ? composeTheme(baseTheme, customPrimary, baseTheme.radius, baseTheme.mode)
    : baseTheme;

  // B0c.per-color: layer customColors on top of the mode-aware theme so
  // user-set bg/text/surface hexes ALWAYS win over swatch base + mode preset
  const finalTheme = Object.keys(customColors).length > 0
    ? { ...effectiveTheme, colors: { ...effectiveTheme.colors, ...customColors } }
    : effectiveTheme;

  const themeState = { baseTheme, setBaseTheme, customPrimary, setCustomPrimary };
  const brandState = { brand, setBrand };

  // B5.4.5: set body + html bg to dark to fix the "white stripes" visible behind
  // <main> when child content doesn't fill the popup width. Without this, the
  // popup HTML body's default white shows through gaps. CSS variables resolve
  // against html, so we set there too.
  useEffect(() => {
    const dark = 'var(--bg-base, #0F0B08)';
    document.documentElement.style.backgroundColor = dark;
    document.body.style.backgroundColor = dark;
    document.body.style.margin = '0';
  }, []);

  return (
    <WdkThemeProvider theme={finalTheme}>
      <BrandProvider brand={brand}>
      <main
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-base)',
          minHeight: '100vh',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {customizationEnabled && settingsOpen ? (
          <SettingsView
            themeState={{ ...themeState, customColors, setCustomColor, clearAllCustomColors }}
            brandState={brandState}
            onBack={() => setSettingsOpen(false)}
          />
        ) : (
          <>
            {/* Persistent corner gear - always visible when not in Settings */}
            {customizationEnabled && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Settings"
                data-testid="corner-settings-button"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 100,
                  width: 30,
                  height: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-elevated-1, rgba(255,255,255,0.05))',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                  borderRadius: 'var(--radius-md, 6px)',
                  color: 'var(--text-secondary, currentColor)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}

            {state.status === 'loading' && (
              <div style={{ padding: 24, fontSize: 13, opacity: 0.6 }}>Loading...</div>
            )}
            {state.status === 'no-vault' && <OnboardingFlow onVaultReady={refresh} />}
            {state.status === 'locked' && <UnlockView onUnlocked={refresh} />}
            {state.status === 'unlocked' && (
              <UnlockedRouter onLockRequested={refresh} />
            )}
            {state.status === 'error' && (
              <div style={{ padding: 24, fontSize: 13, color: 'var(--color-error)' }}>
                Error: {state.error}
              </div>
            )}
          </>
        )}
      </main>
    </BrandProvider>
    </WdkThemeProvider>
  );
}