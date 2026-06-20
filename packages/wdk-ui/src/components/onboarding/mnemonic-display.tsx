/**
 * MnemonicDisplay - Pattern B from Doc 33 (hidden-default, ack-gated copy).
 *
 * Security UX:
 *   - Words are blurred by default (CSS filter + pointer-events:none).
 *     User must click "Click to reveal" to see them. This prevents shoulder-
 *     surfing in coffee-shop / open-office scenarios where the user opens
 *     the popup and the mnemonic immediately renders visible to onlookers.
 *
 *   - Copy button is DISABLED until the user checks the acknowledgment
 *     box "I have saved my recovery phrase". Forces an active confirmation
 *     before the words touch the clipboard. Clipboards persist across apps
 *     and history; a stray Cmd+V into a chat window has lost real money.
 *
 *   - BIP-44 portability message per ADR-009 framing. Users coming from
 *     MetaMask / Phantom / Coinbase Wallet are familiar with the concept;
 *     the message reinforces "this is the same standard, your recovery
 *     phrase works elsewhere" - which is a comfort signal, not just a
 *     marketing claim.
 *
 * Props are mostly test hooks (defaultRevealed / defaultAcknowledged) -
 * production code controls behavior via state. onAcknowledged fires
 * whenever the checkbox toggles so the parent (CreateWalletScreen in
 * B5.2) can gate Continue on it.
 *
 * Source: Doc 33 Part III Pattern B (mnemonic display hidden-default with
 * checkbox-gated copy). Doc 32 Part II inventory.
 */

import { useMemo, useState } from 'react';
import { Button } from '../../primitives/button.js';

export interface MnemonicDisplayProps {
  readonly mnemonic: string;
  readonly onAcknowledged?: (acknowledged: boolean) => void;
  /** Test hook: start with words visible. Production always starts hidden. */
  readonly defaultRevealed?: boolean;
  /** Test hook: start with acknowledgment pre-checked. */
  readonly defaultAcknowledged?: boolean;
  readonly title?: string;
}

export function MnemonicDisplay(props: MnemonicDisplayProps): JSX.Element {
  const {
    mnemonic,
    onAcknowledged,
    defaultRevealed = false,
    defaultAcknowledged = false,
    title = 'Backup Your Recovery Phrase',
  } = props;

  const [revealed, setRevealed] = useState(defaultRevealed);
  const [acknowledged, setAcknowledged] = useState(defaultAcknowledged);
  const [copied, setCopied] = useState(false);

  const words = useMemo(() => mnemonic.trim().split(/\s+/), [mnemonic]);

  function toggleAcknowledged(): void {
    const next = !acknowledged;
    setAcknowledged(next);
    onAcknowledged?.(next);
  }

  async function handleCopy(): Promise<void> {
    if (!acknowledged) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MnemonicDisplay] clipboard write failed:', err);
    }
  }

  return (
    <div
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
          Save these words somewhere safe. Anyone with this phrase has full
          access to your wallet. We cannot recover it for you if you lose it.
        </p>
      </div>

      <div
        style={{
          padding: '10px 12px',
          backgroundColor: 'var(--bg-elevated-2)',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.5,
          opacity: 0.85,
        }}
      >
        <strong>Portable:</strong> this recovery phrase follows the BIP-44
        standard and works in any compatible wallet (MetaMask, Phantom,
        Coinbase Wallet, hardware wallets, and more).
      </div>

      <div style={{ position: 'relative' }}>
        <div
          data-testid="mnemonic-grid"
          aria-hidden={!revealed}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            padding: 12,
            backgroundColor: 'var(--bg-elevated-1)',
            borderRadius: 8,
            filter: revealed ? 'none' : 'blur(6px)',
            pointerEvents: revealed ? 'auto' : 'none',
            userSelect: revealed ? 'text' : 'none',
            transition: 'filter 0.2s',
          }}
        >
          {words.map((word, i) => (
            <div
              key={`${i}-${word}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '6px 8px',
                backgroundColor: 'var(--bg-elevated-2)',
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 10, opacity: 0.5, minWidth: 16 }}>{i + 1}.</span>
              <span style={{ fontWeight: 500 }}>{word}</span>
            </div>
          ))}
        </div>

        {!revealed && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Button onClick={() => setRevealed(true)}>Click to reveal</Button>
          </div>
        )}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 12,
          lineHeight: 1.4,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={toggleAcknowledged}
          style={{ marginTop: 2 }}
        />
        <span>I have saved my recovery phrase in a safe place.</span>
      </label>

      <Button
        variant="outline"
        onClick={() => { void handleCopy(); }}
        disabled={!acknowledged}
      >
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </Button>
    </div>
  );
}