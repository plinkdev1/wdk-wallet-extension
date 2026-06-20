/**
 * MnemonicGrid (B5.4.4) - 12 or 24 numbered word-input boxes with paste-anywhere-fills-all.
 *
 * The upgraded UX over the textarea-based MnemonicInput (B5.4.1). Used by
 * ImportVaultView for first-run wallet import. Matches the Phantom + MetaMask
 * production pattern: individual numbered boxes per word + paste in ANY box
 * distributes the full phrase across all boxes from position 1.
 *
 * Why boxes over a textarea:
 *   - Visual cue for "this is a 12-word thing" - user knows how many to type
 *   - Per-word feedback (filled count) gives immediate progress signal
 *   - Reduces typo-by-misalignment (e.g., user typed "abandon abadon" with
 *     two missing letters - in a textarea this just looks like one word
 *     missed; in boxes the misspelled word is clearly its own item)
 *   - Industry-standard - users recognise the pattern from other wallets
 *
 * Paste behavior:
 *   When user pastes into ANY box (1, 5, 12, doesn't matter):
 *     - If pasted text is 2+ tokens (space/newline split): preventDefault,
 *       fill ALL boxes from position 1, lowercase everything. Overwrites any
 *       prior input. Focus lands on the last filled box.
 *     - If pasted text is 1 token: default browser behavior (insert into
 *       focused box). User experience matches typing one word.
 *   This is critical for fast onboarding - users paste from password
 *   managers / PDFs / encrypted backups, and the phrase comes as a single
 *   blob of text. The component handles distribution.
 *
 * Inline styles, NOT Tailwind. The wdk-ui package is consumed by both
 * Tailwind-processing hosts (planned Next.js template wallet) and non-
 * processing hosts (current Chrome extension popup). Inline styles work
 * in both. CSS variables (--text-primary, --color-error, --font-body) are
 * still used for theme adaptation, with hex fallbacks for hosts that don't
 * provide them.
 *
 * Privacy attributes on every input: autoComplete=off, autoCorrect=off,
 * autoCapitalize=none, spellCheck=false. Recovery phrases must never hit
 * browser autofill databases or OS spellcheck cloud services.
 */

import { useRef, useState, type ClipboardEvent } from 'react';

export interface MnemonicGridProps {
  /** Number of word boxes to render. Default 12. */
  readonly wordCount?: 12 | 24;
  /**
   * Called whenever the joined phrase changes. The string is already
   * normalized (lowercase, single-spaced, no leading/trailing whitespace,
   * empty boxes skipped). Parent uses this for validation / SW calls.
   */
  readonly onChange?: (joinedPhrase: string) => void;
  /**
   * Optional error message. When provided, all boxes get a red-tinted
   * border and the message renders below with role="alert".
   */
  readonly error?: string | null;
  /** Disables all inputs (e.g., while a validation SW call is in flight). */
  readonly disabled?: boolean;
}

export function MnemonicGrid({
  wordCount = 12,
  onChange,
  error,
  disabled,
}: MnemonicGridProps): JSX.Element {
  const [words, setWords] = useState<string[]>(() => Array(wordCount).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const emit = (next: string[]): void => {
    setWords(next);
    const joined = next
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0)
      .join(' ');
    onChange?.(joined);
  };

  const handleChange = (i: number, raw: string): void => {
    // Per-box edit: strip ALL whitespace from the input (no spaces in a single
    // word box) + lowercase. If the user wants to enter multiple words, they
    // should paste - the paste handler distributes correctly. Typing a space
    // here just silently drops it.
    const cleaned = raw.replace(/\s+/g, '').toLowerCase();
    const next = [...words];
    next[i] = cleaned;
    emit(next);
  };

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = e.clipboardData.getData('text');
    const tokens = pasted.trim().split(/\s+/).filter((t) => t.length > 0);
    if (tokens.length <= 1) {
      // Single-word paste: let the browser handle it - default insert into focused box.
      // The subsequent onChange will normalize via handleChange.
      return;
    }
    // Multi-word paste: fill ALL boxes from position 1 (overwrite prior contents).
    e.preventDefault();
    const next: string[] = Array(wordCount).fill('');
    tokens.slice(0, wordCount).forEach((tok, idx) => {
      next[idx] = tok.toLowerCase();
    });
    emit(next);
    // Focus the last filled box so user can immediately tab/click to verify.
    const focusIdx = Math.min(tokens.length, wordCount) - 1;
    setTimeout(() => {
      inputRefs.current[focusIdx]?.focus();
    }, 0);
  };

  const filledCount = words.filter((w) => w.trim().length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
        }}
      >
        {words.map((word, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              background: 'rgba(255, 255, 255, 0.04)',
              border: error
                ? '1px solid rgba(239, 68, 68, 0.5)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              padding: '4px 6px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 4,
                left: 6,
                fontSize: 9,
                opacity: 0.45,
                fontFamily: 'var(--font-body)',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {i + 1}
            </span>
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              value={word}
              onChange={(e) => handleChange(i, e.target.value)}
              onPaste={(e) => handlePaste(i, e)}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label={`Word ${i + 1}`}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary, #FAF6F0)',
                fontSize: 13,
                fontFamily: 'var(--font-body)',
                padding: '14px 0 2px 0',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minHeight: 18,
        }}
      >
        <span
          aria-live="polite"
          style={{
            fontSize: 11,
            opacity: 0.6,
            fontFamily: 'var(--font-body)',
            color: 'var(--text-primary)',
          }}
        >
          {filledCount} of {wordCount} filled
        </span>
        {error ? (
          <span
            role="alert"
            style={{
              fontSize: 11,
              color: 'var(--color-error, #EF4444)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}