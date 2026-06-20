/**
 * @vitest-environment jsdom
 *
 * MnemonicGrid (B5.4.4) spec. Tests cover layout (correct number of boxes,
 * numbered correctly, accessible labels), typing behavior (lowercase, whitespace
 * stripped, joined phrase emitted), paste-anywhere-fills-all (the critical UX),
 * error + disabled states, privacy attributes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MnemonicGrid } from './mnemonic-grid.js';

const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('MnemonicGrid (B5.4.4)', () => {
  describe('layout', () => {
    it('renders 12 inputs by default', () => {
      render(<MnemonicGrid />);
      expect(screen.getAllByRole('textbox')).toHaveLength(12);
    });

    it('renders 24 inputs when wordCount=24', () => {
      render(<MnemonicGrid wordCount={24} />);
      expect(screen.getAllByRole('textbox')).toHaveLength(24);
    });

    it('each box has an accessible label with its position number', () => {
      render(<MnemonicGrid />);
      expect(screen.getByLabelText('Word 1')).toBeInTheDocument();
      expect(screen.getByLabelText('Word 6')).toBeInTheDocument();
      expect(screen.getByLabelText('Word 12')).toBeInTheDocument();
    });

    it('shows "0 of 12 filled" when all boxes empty', () => {
      render(<MnemonicGrid />);
      expect(screen.getByText('0 of 12 filled')).toBeInTheDocument();
    });

    it('shows "0 of 24 filled" when wordCount=24', () => {
      render(<MnemonicGrid wordCount={24} />);
      expect(screen.getByText('0 of 24 filled')).toBeInTheDocument();
    });
  });

  describe('typing in a box', () => {
    it('updates the word and emits joined phrase via onChange', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'abandon' } });
      expect(onChange).toHaveBeenLastCalledWith('abandon');
    });

    it('lowercases uppercase input', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'ABANDON' } });
      expect(onChange).toHaveBeenLastCalledWith('abandon');
    });

    it('strips inline whitespace from typed input (no spaces allowed within a box)', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'aba ndon' } });
      expect(onChange).toHaveBeenLastCalledWith('abandon');
    });

    it('joins multiple filled boxes with single spaces', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'abandon' } });
      fireEvent.change(screen.getByLabelText('Word 2'), { target: { value: 'about' } });
      expect(onChange).toHaveBeenLastCalledWith('abandon about');
    });

    it('skips empty boxes when joining (boxes 1+3 filled yields 2 words, not 3)', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'first' } });
      fireEvent.change(screen.getByLabelText('Word 3'), { target: { value: 'third' } });
      expect(onChange).toHaveBeenLastCalledWith('first third');
    });

    it('updates filled count badge live', () => {
      render(<MnemonicGrid />);
      expect(screen.getByText('0 of 12 filled')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'one' } });
      expect(screen.getByText('1 of 12 filled')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Word 5'), { target: { value: 'five' } });
      expect(screen.getByText('2 of 12 filled')).toBeInTheDocument();
    });
  });

  describe('paste-anywhere-fills-all', () => {
    it('pasting a 12-word phrase into box 1 fills all 12 boxes', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => TEST_MNEMONIC },
      });
      expect(onChange).toHaveBeenLastCalledWith(TEST_MNEMONIC);
      expect((screen.getByLabelText('Word 1') as HTMLInputElement).value).toBe('abandon');
      expect((screen.getByLabelText('Word 12') as HTMLInputElement).value).toBe('about');
    });

    it('pasting into ANY box (not just box 1) still fills from position 1', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 5'), {
        clipboardData: { getData: () => TEST_MNEMONIC },
      });
      expect((screen.getByLabelText('Word 1') as HTMLInputElement).value).toBe('abandon');
      expect((screen.getByLabelText('Word 12') as HTMLInputElement).value).toBe('about');
    });

    it('pasting with extra whitespace normalizes', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => '   abandon   abandon   about   ' },
      });
      expect(onChange).toHaveBeenLastCalledWith('abandon abandon about');
    });

    it('pasting with newlines normalizes', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => 'abandon\nabandon\nabout' },
      });
      expect(onChange).toHaveBeenLastCalledWith('abandon abandon about');
    });

    it('pasting lowercases uppercase pasted words', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => 'ABANDON About Cherry' },
      });
      expect(onChange).toHaveBeenLastCalledWith('abandon about cherry');
    });

    it('pasting 24 words into a 12-wordCount grid truncates to first 12', () => {
      const onChange = vi.fn();
      const twentyFour = Array.from({ length: 24 }, (_, i) => `word${i + 1}`).join(' ');
      render(<MnemonicGrid wordCount={12} onChange={onChange} />);
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => twentyFour },
      });
      expect((screen.getByLabelText('Word 12') as HTMLInputElement).value).toBe('word12');
      // word13 should NOT have leaked anywhere
      expect(onChange).toHaveBeenLastCalledWith(
        Array.from({ length: 12 }, (_, i) => `word${i + 1}`).join(' '),
      );
    });

    it('multi-word paste overwrites existing box contents (not append)', () => {
      const onChange = vi.fn();
      render(<MnemonicGrid onChange={onChange} />);
      // Pre-fill box 1 with something
      fireEvent.change(screen.getByLabelText('Word 1'), { target: { value: 'oldword' } });
      // Paste full phrase
      fireEvent.paste(screen.getByLabelText('Word 1'), {
        clipboardData: { getData: () => TEST_MNEMONIC },
      });
      // Box 1 should be the FIRST word of the pasted phrase, not 'oldword'
      expect((screen.getByLabelText('Word 1') as HTMLInputElement).value).toBe('abandon');
    });
  });

  describe('error + disabled', () => {
    it('renders the error message with role="alert"', () => {
      render(<MnemonicGrid error="Not a valid recovery phrase" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Not a valid recovery phrase');
    });

    it('does not render alert element when error is null', () => {
      render(<MnemonicGrid />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('disables all inputs when disabled=true', () => {
      render(<MnemonicGrid disabled />);
      screen.getAllByRole('textbox').forEach((input) => {
        expect(input).toBeDisabled();
      });
    });
  });

  describe('privacy attributes (recovery phrase must not hit autofill/spellcheck)', () => {
    it('all inputs have autoComplete=off', () => {
      render(<MnemonicGrid />);
      screen.getAllByRole('textbox').forEach((input) => {
        expect(input).toHaveAttribute('autocomplete', 'off');
      });
    });

    it('all inputs have spellCheck=false', () => {
      render(<MnemonicGrid />);
      screen.getAllByRole('textbox').forEach((input) => {
        expect(input).toHaveAttribute('spellcheck', 'false');
      });
    });

    it('all inputs have autoCorrect=off + autoCapitalize=none', () => {
      render(<MnemonicGrid />);
      screen.getAllByRole('textbox').forEach((input) => {
        expect(input).toHaveAttribute('autocorrect', 'off');
        expect(input).toHaveAttribute('autocapitalize', 'none');
      });
    });
  });

  it('does NOT call onChange on initial mount', () => {
    const onChange = vi.fn();
    render(<MnemonicGrid onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});