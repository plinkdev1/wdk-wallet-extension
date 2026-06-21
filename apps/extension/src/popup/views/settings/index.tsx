/**
 * SettingsView - the Settings page mounted by UnlockedRouter when the user
 * clicks the gear icon on MainView.
 *
 * Shell pattern: this component is a section CONTAINER. Each settings
 * concern (appearance, brand, future: security/network/account/advanced)
 * is a self-contained component under ./sections/. Adding a new section
 * is a one-file addition + one import here.
 *
 * Layout:
 *   - Header: back button + "Settings" title
 *   - Scrollable column: each section is a <section data-testid="section-*">
 *     with an uppercase letter-spaced heading + the section component
 *
 * State threading: themeState + brandState are hoisted at App.tsx (so the
 * Providers consume them live) and prop-drilled through UnlockedRouter
 * to here. Pure presentation layer - no localStorage access in this file.
 *
 * Source: B0b per user requirement that Settings UI be "organized so that
 * future sections also get there organized."
 */

import { Button } from '@wdk-starter/wdk-ui';
import { AppearanceSection } from './sections/appearance-section.js';
import { BrandSection } from './sections/brand-section.js';
import { ConnectionsSection } from './sections/connections-section.js';
import type { ThemeState, BrandState } from './types.js';

export interface SettingsViewProps {
  readonly themeState: ThemeState;
  readonly brandState: BrandState;
  readonly onBack: () => void;
}

const sectionHeadingStyle = {
  margin: '0 0 8px 0',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary, currentColor)',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};

export function SettingsView({ themeState, brandState, onBack }: SettingsViewProps): JSX.Element {
  return (
    <div
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: 1,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button variant="ghost" onClick={onBack} aria-label="Back to wallet">{'\u2190 Back'}</Button>
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Settings</h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', flex: 1 }}>
        <section data-testid="section-appearance">
          <h2 style={sectionHeadingStyle}>Appearance</h2>
          <AppearanceSection themeState={themeState} />
        </section>

        <section data-testid="section-brand">
          <h2 style={sectionHeadingStyle}>Brand identity</h2>
          <BrandSection brandState={brandState} />
        </section>

        <section data-testid="section-connections">
          <h2 style={sectionHeadingStyle}>Connections</h2>
          <ConnectionsSection />
        </section>
      </div>
    </div>
  );
}