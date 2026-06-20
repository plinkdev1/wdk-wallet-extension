/**
 * PasswordSetupScreen - vault password creation with strength meter and confirm.
 *
 * Per ADR-002 the vault is AES-GCM with PBKDF2-SHA256 at 600k iterations -
 * a strong password is the primary defense against offline brute-force.
 * This screen enforces:
 *   - Minimum length (default 8; configurable per-product)
 *   - Confirm-matches-password
 *   - Strength gate: rejects "weak" passwords (length < min OR low diversity)
 *     even if length-only check passes
 *
 * Reuses the PasswordInput from components/unlock/ (B5.0a) for the
 * show/hide toggle and Enter-to-submit. Two PasswordInputs side by side
 * for new password + confirm.
 *
 * Strength scoring is intentionally simple - 4 tiers based on length +
 * character-class diversity. Industry zxcvbn-style dictionary scoring is
 * more accurate but adds ~30KB of JS to the wallet bundle. v0.2 may swap
 * if the wallet ships a separate "advanced strength check" toggle.
 *
 * Source: ADR-002 (vault), Doc 32 Part II inventory.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../primitives/button.js';
import { Label } from '../../primitives/label.js';
import { PasswordInput } from '../unlock/password-input.js';

export type PasswordStrength = 'none' | 'weak' | 'fair' | 'strong';

export interface PasswordSetupScreenProps {
  readonly onSubmit: (password: string) => Promise<void> | void;
  readonly minLength?: number;
  readonly title?: string;
  readonly subtitle?: string;
}

/** Exported for test parity. Simple 4-tier scorer. */
export function evaluatePasswordStrength(password: string, minLength: number): PasswordStrength {
  if (password.length === 0) return 'none';
  if (password.length < minLength) return 'weak';
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const diversity = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (password.length >= 12 && diversity >= 3) return 'strong';
  if (password.length >= minLength && diversity >= 2) return 'fair';
  return 'weak';
}

function StrengthMeter({ strength }: { readonly strength: PasswordStrength }): JSX.Element {
  const colors: Record<PasswordStrength, string> = {
    none: 'var(--bg-elevated-2)',
    weak: 'var(--color-error, #EF4444)',
    fair: 'var(--warning, #F59E0B)',
    strong: 'var(--success, #10B981)',
  };
  const filled: Record<PasswordStrength, number> = {
    none: 0, weak: 1, fair: 2, strong: 3,
  };
  const labels: Record<PasswordStrength, string> = {
    none: '', weak: 'Weak', fair: 'Fair', strong: 'Strong',
  };
  const filledCount = filled[strength];

  return (
    <div
      role="status"
      aria-label={`Password strength: ${strength}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid={`strength-bar-${i}`}
            style={{
              flex: 1,
              height: 4,
              backgroundColor: i <= filledCount ? colors[strength] : 'var(--bg-elevated-2)',
              borderRadius: 2,
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </div>
      {labels[strength] && (
        <span style={{ fontSize: 11, opacity: 0.7, minWidth: 44, textAlign: 'right' }}>
          {labels[strength]}
        </span>
      )}
    </div>
  );
}

export function PasswordSetupScreen(props: PasswordSetupScreenProps): JSX.Element {
  const {
    onSubmit,
    minLength = 8,
    title = 'Set Your Password',
    subtitle = 'This password encrypts your wallet on this device. You will need it every time you open the wallet. There is no recovery if you forget it - your recovery phrase is your only backup.',
  } = props;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => evaluatePasswordStrength(password, minLength), [password, minLength]);

  async function handleSubmit(): Promise<void> {
    if (pending) return;
    setError(null);
    if (password.length < minLength) {
      setError(`Password must be at least ${minLength} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (strength === 'weak') {
      setError('Password is too weak. Use a longer phrase with mixed character types.');
      return;
    }
    setPending(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed.');
    } finally {
      setPending(false);
    }
  }

  const onFormSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    void handleSubmit();
  };

  const submitDisabled = pending || password.length === 0 || confirm.length === 0;

  return (
    <form
      onSubmit={onFormSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '28px 32px',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
        <p
          style={{
            margin: '8px 0 0 0',
            paddingRight: 4,
            fontSize: 12,
            opacity: 0.72,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label htmlFor="password-new" style={{ fontSize: 12, opacity: 0.72 }}>
          Password
        </Label>
        <PasswordInput
          id="password-new"
          value={password}
          onChange={setPassword}
          autoFocus
          disabled={pending}
          placeholder="At least 8 characters"
        />
        <StrengthMeter strength={strength} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label htmlFor="password-confirm" style={{ fontSize: 12, opacity: 0.72 }}>
          Confirm Password
        </Label>
        <PasswordInput
          id="password-confirm"
          value={confirm}
          onChange={setConfirm}
          onSubmit={() => { void handleSubmit(); }}
          disabled={pending}
          placeholder="Re-enter your password"
        />
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-error, #EF4444)' }}>
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitDisabled} style={{ width: '100%' }}>
        {pending ? 'Setting...' : 'Continue'}
      </Button>
    </form>
  );
}