/**
 * AppearanceSection - Settings sub-section for theme customization.
 *
 * Mounts the wdk-ui ThemePicker (7 swatches x 4 edges x 2 modes) and
 * adds a custom hex input below for arbitrary #RRGGBB primary color
 * override. The custom hex input is validated via isValidHexPrimary
 * (from wdk-ui) and only persisted on successful Apply.
 *
 * Source: B0b per user requirement that color toggles must include
 * an "any hex" surface, not just the swatches.
 */

import { useState, type ChangeEvent } from 'react';
import { Button, ThemePicker, isValidHexPrimary } from '@wdk-starter/wdk-ui';
import type { CustomColorKey } from '@wdk-starter/wdk-ui';
import { defaultTheme } from '@wdk-starter/wdk-ui';
import type { ThemeState } from '../types.js';

export interface AppearanceSectionProps {
  readonly themeState: ThemeState;
}

export function AppearanceSection({ themeState }: AppearanceSectionProps): JSX.Element {
  const { baseTheme, setBaseTheme, customPrimary, setCustomPrimary } = themeState;

  // B0c.per-color: optional customColors API (may be undefined in unit tests).
  // Use ?? to provide no-op defaults so the JSX can call these freely without
  // narrowing concerns; render-gate the section on advancedColorsEnabled instead.
  const customColors = themeState.customColors ?? {};
  const setCustomColor = themeState.setCustomColor ?? ((_k: CustomColorKey, _h: string | null) => { /* no-op */ });
  const clearAllCustomColors = themeState.clearAllCustomColors ?? (() => { /* no-op */ });
  const advancedColorsEnabled = themeState.setCustomColor !== undefined && themeState.clearAllCustomColors !== undefined;
  const [hexInput, setHexInput] = useState<string>(customPrimary ?? '');
  const [hexError, setHexError] = useState<string | null>(null);

  const handleHexInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setHexInput(e.target.value);
    if (hexError) setHexError(null);
  };

  const handleApplyHex = (): void => {
    if (hexInput.trim() === '') {
      setCustomPrimary(null);
      setHexError(null);
      return;
    }
    if (!isValidHexPrimary(hexInput.trim())) {
      setHexError('Expected #RRGGBB (e.g. #FF00FF)');
      return;
    }
    setCustomPrimary(hexInput.trim());
    setHexError(null);
  };

  const handleClearHex = (): void => {
    setHexInput('');
    setCustomPrimary(null);
    setHexError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ThemePicker
        value={baseTheme}
        onChange={(next) => {
          setBaseTheme(next);
          // Picking a swatch (or any picker dimension) clears any active
          // custom-hex primary - "last action wins": pick swatch -> custom
          // clears; set custom hex -> swatch primary is overridden. Either
          // way what the user just touched is what they see.
          if (customPrimary !== null) {
            setCustomPrimary(null);
            setHexInput('');
            setHexError(null);
          }
        }}
      />

      <div style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', paddingTop: 14 }}>
        <label htmlFor="custom-primary-hex-input" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, currentColor)', display: 'block', marginBottom: 6 }}>
          Custom primary color (pick visually or type any #RRGGBB hex - overrides the swatch above)
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="color"
            value={(customPrimary ?? baseTheme.colors.primary).toLowerCase()}
            onChange={(e) => {
              const picked = e.target.value.toUpperCase();
              setHexInput(picked);
              setCustomPrimary(picked);
              setHexError(null);
            }}
            aria-label="Visual color picker"
            title="Pick any color visually - applies immediately"
            style={{ width: 40, height: 32, padding: 2, border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 6px)', cursor: 'pointer', backgroundColor: 'var(--bg-elevated-1, transparent)' }}
          />
          <input
            id="custom-primary-hex-input"
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            placeholder="#FF00FF"
            style={{ flex: 1, padding: '6px 10px', fontSize: 13, border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 6px)', backgroundColor: 'var(--bg-elevated-1, transparent)', color: 'var(--text-primary, currentColor)', boxSizing: 'border-box', fontFamily: 'monospace' }}
          />
          <Button size="sm" onClick={handleApplyHex}>Apply</Button>
          {customPrimary !== null && (
            <Button size="sm" variant="ghost" onClick={handleClearHex}>Clear</Button>
          )}
        </div>
        {hexError !== null && (
          <div role="alert" style={{ marginTop: 4, fontSize: 11, color: 'var(--color-error, #EF4444)' }}>{hexError}</div>
        )}
        {customPrimary !== null && hexError === null && (
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>Active custom primary: <code>{customPrimary}</code></div>
        )}
      </div>

      {/* B0c.per-color: Advanced colors - only renders when SettingsView is given the customColors API */}
      {advancedColorsEnabled && (
        <details style={{ borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', paddingTop: 10 }}>
        <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, currentColor)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
          Advanced colors
        </summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          {([
            { key: 'bgBase',        label: 'Background',         desc: 'Page background',              fallback: baseTheme.colors.bgBase },
            { key: 'bgElevated1',   label: 'Surface',            desc: 'Buttons, inputs, cards',       fallback: baseTheme.colors.bgElevated1 },
            { key: 'bgElevated2',   label: 'Surface emphasis',   desc: 'Hover + focus states',         fallback: baseTheme.colors.bgElevated2 },
            { key: 'textPrimary',   label: 'Text',               desc: 'Primary text color',           fallback: baseTheme.colors.textPrimary },
            { key: 'textSecondary', label: 'Text secondary',     desc: 'Placeholders, labels',         fallback: baseTheme.colors.textSecondary ?? baseTheme.colors.textPrimary },
          ] as const).map((row) => {
            const current = customColors[row.key as CustomColorKey];
            return (
              <div key={row.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }} data-testid={`color-row-${row.key}`}>
                <input
                  type="color"
                  value={(current ?? row.fallback ?? '#000000').toLowerCase()}
                  onChange={(e) => { setCustomColor(row.key as CustomColorKey, e.target.value.toUpperCase()); }}
                  aria-label={`${row.label} color picker`}
                  style={{ width: 32, height: 28, padding: 1, border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md, 4px)', cursor: 'pointer', backgroundColor: 'var(--bg-elevated-1, transparent)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary, currentColor)' }}>{row.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.55, color: 'var(--text-secondary, currentColor)' }}>{row.desc}{current ? ` - ${current}` : ''}</div>
                </div>
                {current !== undefined && (
                  <Button size="sm" variant="ghost" onClick={() => { setCustomColor(row.key as CustomColorKey, null); }}>Clear</Button>
                )}
              </div>
            );
          })}
          {Object.keys(customColors).length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAllCustomColors} data-testid="clear-all-custom-colors">
              Reset all advanced colors
            </Button>
          )}
        </div>
      </details>
      )}

      {/* B0c.reset: Reset all appearance state (theme, customPrimary, customColors). Does NOT touch brand. */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="sm"
          variant="ghost"
          data-testid="appearance-reset-button"
          onClick={() => {
            setBaseTheme(defaultTheme);
            setCustomPrimary(null);
            setHexInput('');
            setHexError(null);
            clearAllCustomColors();
          }}
        >
          Reset appearance to defaults
        </Button>
      </div>
    </div>
  );
}