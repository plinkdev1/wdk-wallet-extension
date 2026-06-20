/**
 * @wdk-starter/wdk-ui - BrandPicker component
 *
 * In-app brand-identity customization picker. Sibling to ThemePicker (which
 * handles colors/edges/modes) - this picker handles the brand-identity
 * surface: wordmark image, master mark image, brand display name.
 *
 * Controlled component: takes `value: BrandConfig` + `onChange: (next) => void`.
 * Files are read via FileReader.readAsDataURL and the resulting data URI is
 * stored in the BrandConfig (so the entire brand survives a popup reopen
 * via localStorage in the companion useBrandPicker hook).
 *
 * Testability: the `readFile` prop is injectable. Default impl uses FileReader;
 * tests inject a synchronous fake that returns a known data URI.
 *
 * Layout: form-style stacked rows for popup width (~380px). Live preview row
 * at the top shows the currently-selected wordmark + mark.
 *
 * Reset: caller passes `defaults` (typically DEFAULT_WDK_BRAND); clicking
 * Reset fires onChange(defaults).
 *
 * Source: B0a per user requirement that brand swap must be a first-class
 * UI toggle in Settings, not just a code-level API.
 */

import { useRef, type ChangeEvent, type CSSProperties } from 'react';
import { type BrandConfig } from './brand-config.js';

export interface BrandPickerProps {
  readonly value: BrandConfig;
  readonly onChange: (next: BrandConfig) => void;
  /**
   * Defaults to reset to when the user clicks the Reset button. Typically
   * DEFAULT_WDK_BRAND from the consumer.
   */
  readonly defaults: BrandConfig;
  /**
   * Injectable file reader. Defaults to FileReader.readAsDataURL. Tests
   * can pass a fake that returns a known data URI synchronously.
   */
  readonly readFile?: (file: File) => Promise<string>;
}

/** Default file reader: FileReader.readAsDataURL -> data URI string. */
function defaultReadFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader returned non-string result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary, currentColor)',
  marginBottom: 4,
  display: 'block',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
  borderRadius: 'var(--radius-md, 6px)',
  backgroundColor: 'var(--bg-elevated-1, transparent)',
  color: 'var(--text-primary, currentColor)',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-body, inherit)',
};

const previewBoxStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 10,
  borderRadius: 'var(--radius-md, 6px)',
  backgroundColor: 'var(--bg-elevated-2, rgba(255,255,255,0.04))',
  marginBottom: 14,
};

export function BrandPicker({ value, onChange, defaults, readFile }: BrandPickerProps): JSX.Element {
  const wordmarkInputRef = useRef<HTMLInputElement>(null);
  const markInputRef = useRef<HTMLInputElement>(null);
  const reader = readFile ?? defaultReadFile;

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...value, name: e.target.value });
  };

  const handleWordmarkAltChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...value, wordmarkAlt: e.target.value });
  };

  const handleMarkAltChange = (e: ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...value, markAlt: e.target.value });
  };

  const handleWordmarkFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await reader(file);
      onChange({ ...value, wordmarkSrc: dataUri, wordmarkAlt: value.wordmarkAlt ?? file.name });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[BrandPicker] failed to read wordmark file:', err);
    }
  };

  const handleMarkFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await reader(file);
      onChange({ ...value, markSrc: dataUri, markAlt: value.markAlt ?? file.name });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[BrandPicker] failed to read mark file:', err);
    }
  };

  const handleClearWordmark = (): void => {
    onChange({ ...value, wordmarkSrc: undefined });
    if (wordmarkInputRef.current) wordmarkInputRef.current.value = '';
  };

  const handleClearMark = (): void => {
    onChange({ ...value, markSrc: undefined });
    if (markInputRef.current) markInputRef.current.value = '';
  };

  const handleReset = (): void => {
    onChange(defaults);
    if (wordmarkInputRef.current) wordmarkInputRef.current.value = '';
    if (markInputRef.current) markInputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Live preview row */}
      <div style={previewBoxStyle} data-testid="brand-preview">
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 }}>
          {value.markSrc ? (
            <img src={value.markSrc} alt={value.markAlt ?? value.name} style={{ width: 40, height: 40, objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 11, opacity: 0.5 }}>(no mark)</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {value.wordmarkSrc ? (
            <img src={value.wordmarkSrc} alt={value.wordmarkAlt ?? value.name} style={{ height: 32, width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>{value.name}</span>
          )}
        </div>
      </div>

      {/* Brand name */}
      <div style={rowStyle}>
        <label htmlFor="brand-name-input" style={labelStyle}>Brand name</label>
        <input
          id="brand-name-input"
          type="text"
          value={value.name}
          onChange={handleNameChange}
          placeholder="WDK"
          style={inputStyle}
        />
      </div>

      {/* Wordmark file */}
      <div style={rowStyle}>
        <label htmlFor="brand-wordmark-input" style={labelStyle}>Wordmark image (replaces the welcome-screen logo)</label>
        <input
          id="brand-wordmark-input"
          ref={wordmarkInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { void handleWordmarkFile(e); }}
          style={{ ...inputStyle, padding: '6px 8px' }}
        />
        {value.wordmarkSrc && (
          <button
            type="button"
            onClick={handleClearWordmark}
            style={{ alignSelf: 'flex-start', fontSize: 11, marginTop: 2, padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--text-secondary, currentColor)', textDecoration: 'underline', cursor: 'pointer' }}
          >Clear wordmark</button>
        )}
      </div>

      {/* Wordmark alt */}
      <div style={rowStyle}>
        <label htmlFor="brand-wordmark-alt-input" style={labelStyle}>Wordmark alt text</label>
        <input
          id="brand-wordmark-alt-input"
          type="text"
          value={value.wordmarkAlt ?? ''}
          onChange={handleWordmarkAltChange}
          placeholder={value.name}
          style={inputStyle}
        />
      </div>

      {/* Mark file */}
      <div style={rowStyle}>
        <label htmlFor="brand-mark-input" style={labelStyle}>Master mark image (replaces the unlock-screen icon)</label>
        <input
          id="brand-mark-input"
          ref={markInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { void handleMarkFile(e); }}
          style={{ ...inputStyle, padding: '6px 8px' }}
        />
        {value.markSrc && (
          <button
            type="button"
            onClick={handleClearMark}
            style={{ alignSelf: 'flex-start', fontSize: 11, marginTop: 2, padding: '2px 6px', background: 'transparent', border: 'none', color: 'var(--text-secondary, currentColor)', textDecoration: 'underline', cursor: 'pointer' }}
          >Clear mark</button>
        )}
      </div>

      {/* Mark alt */}
      <div style={rowStyle}>
        <label htmlFor="brand-mark-alt-input" style={labelStyle}>Master mark alt text</label>
        <input
          id="brand-mark-alt-input"
          type="text"
          value={value.markAlt ?? ''}
          onChange={handleMarkAltChange}
          placeholder={value.name}
          style={inputStyle}
        />
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={handleReset}
        style={{
          marginTop: 4,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          backgroundColor: 'transparent',
          color: 'var(--text-secondary, currentColor)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
          borderRadius: 'var(--radius-md, 6px)',
          cursor: 'pointer',
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}