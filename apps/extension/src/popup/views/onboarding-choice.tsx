/**
 * OnboardingChoice (B5.4.3, B5.4.5 hierarchy fix) - first-run decision screen.
 *
 * Two-button choice for brand-new users:
 *   - Primary CTA (orange filled): "Create a new wallet"
 *   - Secondary CTA (ghost - transparent bg + subtle border): "I already have a recovery phrase"
 *
 * B5.4.5 fixes the B5.4.3 issue where both buttons rendered the same orange,
 * giving no visual hierarchy. Now the primary is the obvious default, secondary
 * is clearly opt-in. Pattern matches Phantom/MetaMask first-run conventions.
 */

import { Button, LogoMark, useBrand } from '@wdk-starter/wdk-ui';

export interface OnboardingChoiceProps {
  readonly onCreateNew: () => void;
  readonly onImport: () => void;
}

export function OnboardingChoice({ onCreateNew, onImport }: OnboardingChoiceProps): JSX.Element {
  const brand = useBrand();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: 24,
        minHeight: 400,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {brand.wordmarkSrc && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <LogoMark src={brand.wordmarkSrc} alt={brand.wordmarkAlt ?? brand.name} size="xl" fluid />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>
          Welcome to WDK
        </h1>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.72, lineHeight: 1.5 }}>
          Get started by creating a new wallet, or import one you already have.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginTop: 'auto',
        }}
      >
        {/* Primary: orange filled via wdk-ui Button */}
        <Button onClick={onCreateNew} style={{ width: '100%' }}>
          Create a new wallet
        </Button>

        {/* Secondary: ghost (transparent bg + subtle border), inline-styled raw button
            so it's visually distinct from the primary without needing a Button variant prop */}
        <button
          type="button"
          onClick={onImport}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.18))',
            color: 'var(--text-primary, #FAF6F0)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            boxSizing: 'border-box',
          }}
        >
          I already have a recovery phrase
        </button>
      </div>
    </div>
  );
}