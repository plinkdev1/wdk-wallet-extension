/**
 * SendView - a user-initiated native-asset transfer on the active EVM chain.
 *
 * Flow: enter recipient + amount -> validate -> ACCOUNT_SEND_TRANSACTION to the
 * SW (which signs + broadcasts via WDK) -> show the transaction hash. The keys
 * never leave the service worker; this view only collects intent.
 */

import { useCallback, useState } from 'react';
import { Button, Card, Input, Label } from '@wdk-starter/wdk-ui';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';

export interface SendViewProps {
  readonly chain: EvmChainId;
  readonly symbol: string;
  /** The active account index to send from (BIP-44 derivation). */
  readonly accountIndex: number;
  readonly onBack: () => void;
  /** Called after a successful broadcast so the parent can refresh the balance. */
  readonly onSent?: () => void;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Parses a decimal token amount into an 18-decimal base-unit string. */
function parseToWei(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Enter a valid amount.');
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > 18) throw new Error('Too many decimals.');
  const padded = frac.padEnd(18, '0');
  return BigInt(whole || '0') * 10n ** 18n + BigInt(padded || '0');
}

type Phase =
  | { status: 'form' }
  | { status: 'sending' }
  | { status: 'sent'; hash: string };

export function SendView({ chain, symbol, accountIndex, onBack, onSent }: SendViewProps): JSX.Element {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });

  const handleSend = useCallback(async (): Promise<void> => {
    setError(null);
    if (!EVM_ADDRESS.test(to.trim())) {
      setError('Enter a valid recipient address (0x…40 hex).');
      return;
    }
    let value: bigint;
    try {
      value = parseToWei(amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount.');
      return;
    }
    if (value <= 0n) {
      setError('Amount must be greater than zero.');
      return;
    }

    setPhase({ status: 'sending' });
    try {
      const hash = await send({
        type: 'ACCOUNT_SEND_TRANSACTION',
        chain,
        accountIndex,
        to: to.trim(),
        value: value.toString(),
      });
      setPhase({ status: 'sent', hash });
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
      setPhase({ status: 'form' });
    }
  }, [to, amount, chain, accountIndex, onSent]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">←</Button>
        <strong style={{ fontSize: 15 }}>Send {symbol}</strong>
      </header>

      {phase.status !== 'sent' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Recipient address</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Amount ({symbol})</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal" />
            </div>
            {error !== null && (
              <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4 }}>{error}</div>
            )}
            <Button onClick={() => { void handleSend(); }} disabled={phase.status === 'sending'} style={{ width: '100%' }}>
              {phase.status === 'sending' ? 'Sending…' : 'Review & send'}
            </Button>
          </div>
        </Card>
      )}

      {phase.status === 'sent' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 20 }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ fontSize: 14 }}>Transaction submitted.</div>
            <Label>Transaction hash</Label>
            <code style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'center', padding: '8px 10px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 6, width: '100%' }}>
              {phase.hash}
            </code>
            <Button onClick={onBack} style={{ width: '100%' }}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
