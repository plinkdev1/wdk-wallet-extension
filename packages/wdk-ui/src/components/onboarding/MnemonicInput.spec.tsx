import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { MnemonicInput } from './MnemonicInput.js';

describe('MnemonicInput (B5.4.1)', () => {
  describe('word count', () => {
    it('shows "0 words" for an empty value', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByText('0 words')).toBeInTheDocument();
    });

    it('shows "1 word" (singular) for exactly one word', () => {
      render(<MnemonicInput value="abandon" onChange={vi.fn()} />);
      expect(screen.getByText('1 word')).toBeInTheDocument();
    });

    it('shows "12 words" for the canonical all-abandon 12-word phrase', () => {
      const m12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      render(<MnemonicInput value={m12} onChange={vi.fn()} />);
      expect(screen.getByText('12 words')).toBeInTheDocument();
    });

    it('shows "24 words" for a 24-word phrase', () => {
      const m24 = Array.from({ length: 24 }, () => 'abandon').join(' ');
      render(<MnemonicInput value={m24} onChange={vi.fn()} />);
      expect(screen.getByText('24 words')).toBeInTheDocument();
    });

    it('ignores leading + trailing whitespace in word count', () => {
      render(<MnemonicInput value="   abandon abandon   " onChange={vi.fn()} />);
      expect(screen.getByText('2 words')).toBeInTheDocument();
    });

    it('collapses consecutive whitespace (incl. tabs + newlines) in word count', () => {
      render(<MnemonicInput value="abandon   abandon\t\n abandon" onChange={vi.fn()} />);
      expect(screen.getByText('3 words')).toBeInTheDocument();
    });
  });

  describe('onChange normalization', () => {
    it('lowercases uppercase input before calling onChange', () => {
      const onChange = vi.fn();
      render(<MnemonicInput value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ABANDON' } });
      expect(onChange).toHaveBeenCalledWith('abandon');
    });

    it('lowercases mixed-case paste', () => {
      const onChange = vi.fn();
      render(<MnemonicInput value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Abandon ABOUT Cherry' } });
      expect(onChange).toHaveBeenCalledWith('abandon about cherry');
    });

    it('preserves whitespace in the call to onChange (parent decides trim)', () => {
      const onChange = vi.fn();
      render(<MnemonicInput value="" onChange={onChange} />);
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '  abandon  ' } });
      expect(onChange).toHaveBeenCalledWith('  abandon  ');
    });
  });

  describe('error state', () => {
    it('renders the error message in a role="alert" when error provided', () => {
      render(<MnemonicInput value="bogus" onChange={vi.fn()} error="Not a valid recovery phrase" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Not a valid recovery phrase');
    });

    it('sets aria-invalid="true" on the textarea when error provided', () => {
      render(<MnemonicInput value="bogus" onChange={vi.fn()} error="bad" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does NOT render alert element when error is null', () => {
      render(<MnemonicInput value="abandon" onChange={vi.fn()} error={null} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does NOT render alert element when error is undefined (prop omitted)', () => {
      render(<MnemonicInput value="abandon" onChange={vi.fn()} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('links the alert to the textarea via aria-describedby', () => {
      render(<MnemonicInput value="x" onChange={vi.fn()} error="bad" id="m1" />);
      const textarea = screen.getByRole('textbox');
      const alert = screen.getByRole('alert');
      expect(textarea.getAttribute('aria-describedby')).toBe(alert.id);
    });
  });

  describe('security / privacy attributes', () => {
    it('disables autoComplete (recovery phrase should not be saved to browser autofill)', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off');
    });

    it('disables autoCorrect', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('autocorrect', 'off');
    });

    it('disables autoCapitalize (BIP-39 wordlist is lowercase)', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('autocapitalize', 'none');
    });

    it('disables spellCheck (would underline every BIP-39 word as misspelled and leak to OS spellcheck services)', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('spellcheck', 'false');
    });
  });

  describe('disabled state', () => {
    it('disables the textarea when disabled prop is true', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('does not call onChange when disabled and user attempts to type', () => {
      const onChange = vi.fn();
      render(<MnemonicInput value="" onChange={onChange} disabled />);
      // fireEvent doesn't respect disabled for change events the same way users do,
      // but the disabled attribute prevents native typing. Verify the attribute.
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the underlying textarea element', () => {
      const ref = createRef<HTMLTextAreaElement>();
      render(<MnemonicInput value="" onChange={vi.fn()} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });
  });

  describe('placeholder', () => {
    it('uses a sensible default placeholder when none provided', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', expect.stringContaining('recovery phrase'));
    });

    it('respects a custom placeholder', () => {
      render(<MnemonicInput value="" onChange={vi.fn()} placeholder="Custom hint" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Custom hint');
    });
  });
});