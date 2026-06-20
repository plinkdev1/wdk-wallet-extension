/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordSetupScreen, evaluatePasswordStrength } from './password-setup-screen.js';

describe('evaluatePasswordStrength (pure helper)', () => {
  it('returns "none" for empty string', () => {
    expect(evaluatePasswordStrength('', 8)).toBe('none');
  });

  it('returns "weak" for short passwords', () => {
    expect(evaluatePasswordStrength('abc', 8)).toBe('weak');
    expect(evaluatePasswordStrength('1234567', 8)).toBe('weak');
  });

  it('returns "weak" for long-but-low-diversity passwords', () => {
    expect(evaluatePasswordStrength('aaaaaaaa', 8)).toBe('weak'); // 1 class
    expect(evaluatePasswordStrength('12345678', 8)).toBe('weak'); // 1 class
  });

  it('returns "fair" for >= minLength with 2 character classes', () => {
    expect(evaluatePasswordStrength('abcdefg1', 8)).toBe('fair'); // letters + digits
    expect(evaluatePasswordStrength('Abcdefgh', 8)).toBe('fair'); // mixed case
  });

  it('returns "strong" for >= 12 chars with 3+ classes', () => {
    expect(evaluatePasswordStrength('Abcdefghij12', 8)).toBe('strong'); // upper + lower + digits
    expect(evaluatePasswordStrength('correcthorse!23', 8)).toBe('strong');
  });
});

describe('PasswordSetupScreen (B5.1)', () => {
  it('renders default title and subtitle', () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    expect(screen.getByText('Set Your Password')).toBeInTheDocument();
    expect(screen.getByText(/recovery phrase is your only backup/)).toBeInTheDocument();
  });

  it('renders two password inputs (new + confirm)', () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('Continue button starts disabled (empty fields)', () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('strength meter starts in "none" state', () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    const meter = screen.getByRole('status');
    expect(meter).toHaveAttribute('aria-label', 'Password strength: none');
  });

  it('strength meter updates as user types', () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } });
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Password strength: weak');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Abcdefgh1234' } });
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Password strength: strong');
  });

  it('shows "Passwords do not match" error', async () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Different123' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('rejects passwords shorter than minLength', async () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} minLength={10} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 10 characters/);
  });

  it('rejects "weak" passwords (length OK but low diversity)', async () => {
    render(<PasswordSetupScreen onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'aaaaaaaa' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'aaaaaaaa' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/too weak/);
  });

  it('calls onSubmit with the password on valid input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PasswordSetupScreen onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'StrongPass123' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('StrongPass123'));
  });

  it('disables button while pending', async () => {
    let resolveIt: (() => void) | null = null;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveIt = r; }));
    render(<PasswordSetupScreen onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'StrongPass123' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Setting...' })).toBeDisabled();
    resolveIt!();
  });

  it('surfaces onSubmit errors via the alert region', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('VAULT_STORE failed'));
    render(<PasswordSetupScreen onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'StrongPass123' } });
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('VAULT_STORE failed'));
  });
});