/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MnemonicVerify } from './mnemonic-verify.js';

// Deterministic 12-word mnemonic for assertions
const WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent',
  'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
];
const TEST_MNEMONIC = WORDS.join(' ');

describe('MnemonicVerify (B5.1, Pattern A)', () => {
  it('renders default title', () => {
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={vi.fn()} />);
    expect(screen.getByText('Verify Your Recovery Phrase')).toBeInTheDocument();
  });

  it('renders 3 inputs at the specified positions', () => {
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={vi.fn()} />);
    expect(screen.getByLabelText('Word #1')).toBeInTheDocument();
    expect(screen.getByLabelText('Word #5')).toBeInTheDocument();
    expect(screen.getByLabelText('Word #12')).toBeInTheDocument();
  });

  it('Verify button is disabled until all fields have content', async () => {
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Word #1'), 'abandon');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Word #5'), 'above');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Word #12'), 'accident');
    expect(screen.getByRole('button', { name: 'Verify' })).toBeEnabled();
  });

  it('fires onVerified when all words match', async () => {
    const onVerified = vi.fn();
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText('Word #1'), 'abandon');
    await userEvent.type(screen.getByLabelText('Word #5'), 'above');
    await userEvent.type(screen.getByLabelText('Word #12'), 'accident');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('shows error when any word is wrong, does NOT fire onVerified', async () => {
    const onVerified = vi.fn();
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText('Word #1'), 'abandon');
    await userEvent.type(screen.getByLabelText('Word #5'), 'wrong');
    await userEvent.type(screen.getByLabelText('Word #12'), 'accident');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('accepts case-insensitive matches', async () => {
    const onVerified = vi.fn();
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText('Word #1'), 'ABANDON');
    await userEvent.type(screen.getByLabelText('Word #5'), 'Above');
    await userEvent.type(screen.getByLabelText('Word #12'), 'aCCIDENT');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('trims whitespace from user input', async () => {
    const onVerified = vi.fn();
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText('Word #1'), '  abandon  ');
    await userEvent.type(screen.getByLabelText('Word #5'), 'above ');
    await userEvent.type(screen.getByLabelText('Word #12'), ' accident');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('error clears on next submit attempt with correct words', async () => {
    const onVerified = vi.fn();
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} positions={[1, 5, 12]} onVerified={onVerified} />);
    await userEvent.type(screen.getByLabelText('Word #1'), 'wrong');
    await userEvent.type(screen.getByLabelText('Word #5'), 'wrong');
    await userEvent.type(screen.getByLabelText('Word #12'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // clear and retype correct
    await userEvent.clear(screen.getByLabelText('Word #1'));
    await userEvent.clear(screen.getByLabelText('Word #5'));
    await userEvent.clear(screen.getByLabelText('Word #12'));
    await userEvent.type(screen.getByLabelText('Word #1'), 'abandon');
    await userEvent.type(screen.getByLabelText('Word #5'), 'above');
    await userEvent.type(screen.getByLabelText('Word #12'), 'accident');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it('falls back to 3 random positions when positions prop is omitted', () => {
    render(<MnemonicVerify mnemonic={TEST_MNEMONIC} onVerified={vi.fn()} />);
    // Just confirm 3 Word # inputs were rendered (positions are non-deterministic)
    const labels = screen.getAllByText(/^Word #\d+$/);
    expect(labels.length).toBe(3);
  });
});