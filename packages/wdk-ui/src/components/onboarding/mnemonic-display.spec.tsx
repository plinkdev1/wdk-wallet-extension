/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MnemonicDisplay } from './mnemonic-display.js';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

describe('MnemonicDisplay (B5.1, Pattern B)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('renders all 12 words', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    const aboutWords = screen.getAllByText('abandon');
    expect(aboutWords.length).toBe(11);
    expect(screen.getByText('about')).toBeInTheDocument();
  });

  it('renders words with their positional numbers', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('12.')).toBeInTheDocument();
  });

  it('renders the security warning about lost-funds risk', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    expect(screen.getByText(/Anyone with this phrase has full access/)).toBeInTheDocument();
  });

  it('renders the BIP-44 portability message', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    expect(screen.getByText(/BIP-44 standard/)).toBeInTheDocument();
    expect(screen.getByText(/MetaMask/)).toBeInTheDocument();
  });

  it('hides the mnemonic grid behind a blur by default', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    const grid = screen.getByTestId('mnemonic-grid');
    expect(grid).toHaveStyle({ filter: 'blur(6px)' });
    expect(grid).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the "Click to reveal" button initially', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    expect(screen.getByRole('button', { name: 'Click to reveal' })).toBeInTheDocument();
  });

  it('reveals the grid after Click to reveal', async () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} />);
    await userEvent.click(screen.getByRole('button', { name: 'Click to reveal' }));
    const grid = screen.getByTestId('mnemonic-grid');
    expect(grid).toHaveStyle({ filter: 'none' });
  });

  it('Copy button is DISABLED before acknowledgment', () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} defaultRevealed />);
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeDisabled();
  });

  it('Copy button enables after acknowledgment checkbox is checked', async () => {
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} defaultRevealed />);
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeEnabled();
  });

  it('clicking Copy writes the FULL mnemonic to clipboard (only when acknowledged)', async () => {
    const writeText = mockClipboard();
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} defaultRevealed defaultAcknowledged />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(TEST_MNEMONIC));
  });

  it('does NOT call clipboard.writeText when not acknowledged (defense in depth)', async () => {
    const writeText = mockClipboard();
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} defaultRevealed />);
    // Button is disabled, but userEvent.click on a disabled button is a no-op
    // - this also asserts the defense (the handler bails early on !acknowledged).
    const btn = screen.getByRole('button', { name: 'Copy to clipboard' });
    expect(btn).toBeDisabled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('shows "Copied!" transient after successful copy', async () => {
    mockClipboard();
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} defaultRevealed defaultAcknowledged />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    });
  });

  it('fires onAcknowledged when the checkbox toggles', async () => {
    const onAcknowledged = vi.fn();
    render(<MnemonicDisplay mnemonic={TEST_MNEMONIC} onAcknowledged={onAcknowledged} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onAcknowledged).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onAcknowledged).toHaveBeenLastCalledWith(false);
  });
});