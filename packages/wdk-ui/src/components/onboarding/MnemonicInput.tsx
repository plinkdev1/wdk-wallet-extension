import { forwardRef, useId, type ChangeEvent, type TextareaHTMLAttributes } from 'react';

/**
 * MnemonicInput - multi-line text input for a BIP-39 recovery phrase.
 *
 * Used by the import-mnemonic flow (B5.4) as the inverse counterpart to
 * MnemonicDisplay (B5.1). User pastes or types their 12- or 24-word phrase;
 * component normalizes to lowercase as they type and shows live word count.
 *
 * SECURITY / PRIVACY:
 *   autoComplete, autoCorrect, autoCapitalize, spellCheck all disabled. We
 *   never want a recovery phrase mid-typing to be sent to OS spellcheck
 *   services, browser autocomplete suggestion engines, or autofill databases.
 *   The phrase is the user's wallet root secret - it must not leave the page
 *   process until they explicitly choose to submit.
 *
 * VALIDATION:
 *   This component does NOT validate the phrase itself. Validation (BIP-39
 *   wordlist + checksum) is the parent's responsibility - it calls the SW's
 *   BIP39_VALIDATE_MNEMONIC method (wired in B5.4.0 + B5.4.0b) and passes
 *   the result back via the `error` prop. Keeping validation in the parent
 *   means this component stays free of SW dependencies and is trivially
 *   testable in isolation.
 *
 * STYLING:
 *   Uses CSS variables for theme colors with hard-coded fallbacks. If a host
 *   page provides `--wdk-border`, `--wdk-accent`, etc., the component picks
 *   them up; otherwise it renders with sensible defaults.
 */

export interface MnemonicInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'rows'> {
  /** Controlled value. Component lower-cases user input on the fly. */
  value: string;
  /** Called with the new (lowercased) value on every keystroke / paste. */
  onChange: (next: string) => void;
  /**
   * Optional error message. When present:
   *   - Shown below the input as role="alert"
   *   - Adds an error-colored border
   *   - Sets aria-invalid="true" on the textarea
   */
  error?: string | null;
}

export const MnemonicInput = forwardRef<HTMLTextAreaElement, MnemonicInputProps>(
  function MnemonicInput(
    { value, onChange, error, placeholder, disabled, id, className, ...rest },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;

    const trimmed = value.trim();
    const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
      // Normalize on the way in - BIP-39 wordlist is exclusively lowercase.
      // Doing it here means downstream validation never has to second-guess.
      onChange(e.target.value.toLowerCase());
    };

    const baseClasses = [
      'w-full px-3 py-2 rounded-md border resize-none box-border',
      'font-mono text-sm leading-relaxed',
      'bg-[color:var(--wdk-input-bg,#ffffff)]',
      'text-[color:var(--wdk-input-fg,#0F0B08)]',
      'placeholder:text-[color:var(--wdk-muted,#9ca3af)]',
      'focus:outline-none focus:ring-2 focus:ring-[color:var(--wdk-accent,#F4642F)]/40',
      error
        ? 'border-[color:var(--wdk-error,#ef4444)]'
        : 'border-[color:var(--wdk-border,#e5e7eb)]',
      disabled ? 'opacity-60 cursor-not-allowed' : '',
      className ?? '',
    ].filter(Boolean).join(' ');

    return (
      <div className="w-full">
        <textarea
          {...rest}
          id={inputId}
          ref={ref}
          value={value}
          onChange={handleChange}
          placeholder={placeholder ?? 'Paste or type your 12- or 24-word recovery phrase'}
          disabled={disabled}
          rows={4}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={baseClasses}
        />
        <div className="flex items-center justify-between mt-1.5 min-h-[1.25rem]">
          <span
            className="text-xs text-[color:var(--wdk-muted,#9ca3af)] tabular-nums"
            aria-live="polite"
          >
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          {error ? (
            <span
              id={errorId}
              role="alert"
              className="text-xs text-[color:var(--wdk-error,#ef4444)] ml-3 text-right"
            >
              {error}
            </span>
          ) : null}
        </div>
      </div>
    );
  },
);