/**
 * PasswordInput - text input specialized for password entry.
 *
 * Wraps the base Input primitive and adds a show/hide toggle. Used inside
 * UnlockScreen (B5.0a) and PasswordSetupScreen (B5.1). Lives in
 * components/unlock/ per Doc 32 Part II inventory; if PasswordSetupScreen
 * grows distinct needs we can promote a separate variant under
 * components/onboarding/ later.
 *
 * Controlled component: parent owns the password string. Show/hide toggle
 * is local state - the displayed text vs masked dots is a UI-only concern
 * that doesn't need to live in the parent's state tree.
 *
 * No icon dependency (lucide-react is not a wdk-ui dep). Toggle button
 * uses the strings "Show" / "Hide" for v0.1. A future polish commit can
 * swap to an Eye/EyeOff icon once we add an icon primitive.
 *
 * Accessibility: the toggle button has an aria-label so screen readers
 * understand what's being toggled. The input has htmlFor association with
 * an optional <Label> rendered by the parent (UnlockScreen does this).
 */

import { useState } from 'react';
import { Input } from '../../primitives/input.js';

export interface PasswordInputProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly disabled?: boolean;
  /** Test hook: render in show mode without user interaction. */
  readonly defaultShow?: boolean;
}

export function PasswordInput(props: PasswordInputProps): JSX.Element {
  const {
    id,
    value,
    onChange,
    onSubmit,
    placeholder = 'Password',
    autoFocus = false,
    disabled = false,
    defaultShow = false,
  } = props;
  const [shown, setShown] = useState(defaultShow);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit && !disabled) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="current-password"
        spellCheck={false}
        style={{ paddingRight: 56, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        disabled={disabled}
        aria-label={shown ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          opacity: disabled ? 0.4 : 0.72,
          fontSize: 11,
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '4px 8px',
          fontFamily: 'inherit',
        }}
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}