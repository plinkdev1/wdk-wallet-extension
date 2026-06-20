/**
 * MnemonicVerify - Pattern A from Doc 33 (mandatory verification).
 *
 * Forces the user to confirm they actually saved the mnemonic by typing
 * three randomly-selected words from specific positions. If the user
 * skips the previous step (MnemonicDisplay) without saving the phrase,
 * they cannot pass this gate.
 *
 * Why position-typing instead of click-the-words-in-order:
 *   - Popup-tight surface; a 12-word selection grid is dense
 *   - Position typing forces lookup against the user's actual backup
 *     (paper or password manager), not just re-reading the on-screen
 *     phrase right after seeing it
 *   - Industry standard (Coinbase Wallet uses this pattern)
 *
 * Positions can be passed in for deterministic tests; production caller
 * generates them with Math.random in CreateWalletScreen (B5.2). The
 * default in this component (when no positions prop) picks 3 distinct
 * positions in ascending order from the mnemonic length.
 *
 * Source: Doc 33 Part III Pattern A (onboarding mandatory verification).
 */

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '../../primitives/button.js';
import { Input } from '../../primitives/input.js';
import { Label } from '../../primitives/label.js';

export interface MnemonicVerifyProps {
  readonly mnemonic: string;
  /** 1-indexed positions to challenge. Defaults to 3 random positions. */
  readonly positions?: readonly number[];
  /** Fired with true when all challenges are answered correctly. */
  readonly onVerified: () => void;
  readonly title?: string;
}

function pickRandomPositions(wordCount: number, n: number): readonly number[] {
  const candidates = Array.from({ length: wordCount }, (_, i) => i + 1);
  // Fisher-Yates partial shuffle to pick n distinct positions
  for (let i = candidates.length - 1; i > 0 && i > candidates.length - 1 - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = candidates[i]!;
    candidates[i] = candidates[j]!;
    candidates[j] = tmp;
  }
  return candidates.slice(candidates.length - n).sort((a, b) => a - b);
}

export function MnemonicVerify(props: MnemonicVerifyProps): JSX.Element {
  const {
    mnemonic,
    positions: positionsProp,
    onVerified,
    title = 'Verify Your Recovery Phrase',
  } = props;

  const words = useMemo(() => mnemonic.trim().split(/\s+/), [mnemonic]);

  const positions = useMemo(() => {
    if (positionsProp) return positionsProp;
    return pickRandomPositions(words.length, 3);
  }, [positionsProp, words.length]);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    const allCorrect = positions.every((pos) => {
      const expected = words[pos - 1];
      if (expected === undefined) return false;
      const provided = (answers[pos] ?? '').trim().toLowerCase();
      return provided === expected.toLowerCase();
    });
    if (allCorrect) {
      onVerified();
    } else {
      setError('One or more words do not match. Check your backup and try again.');
    }
  }

  const isComplete = positions.every((pos) => (answers[pos] ?? '').trim().length > 0);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 24,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{title}</h1>
        <p style={{ margin: '8px 0 0 0', fontSize: 12, opacity: 0.72, lineHeight: 1.5 }}>
          Confirm you saved your recovery phrase by typing the following words.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {positions.map((pos) => (
          <div key={pos} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label htmlFor={`word-${pos}`} style={{ fontSize: 12, opacity: 0.72 }}>
              Word #{pos}
            </Label>
            <Input
              id={`word-${pos}`}
              value={answers[pos] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [pos]: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--color-error, #EF4444)' }}>
          {error}
        </p>
      )}

      <Button type="submit" disabled={!isComplete}>
        Verify
      </Button>
    </form>
  );
}