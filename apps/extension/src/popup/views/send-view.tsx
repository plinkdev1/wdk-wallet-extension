/**
 * SendView - a user-initiated native-asset transfer on the active chain.
 *
 * Handles both EVM (0x address, 18 decimals, ACCOUNT_SEND_TRANSACTION) and
 * Solana (base58 address, 9 decimals / lamports, ACCOUNT_SEND_SOLANA_TRANSACTION)
 * via the `kind` prop (defaults to 'evm'). Flow: enter recipient + amount ->
 * validate -> message the SW (which signs + broadcasts via WDK) -> show the hash.
 * The keys never leave the service worker; this view only collects intent.
 */

import { useCallback, useState } from 'react';
import { Button, Card, Input, Label } from '@wdk-starter/wdk-ui';
import type { BtcChainId, EvmChainId, SolanaChainId, TonChainId, TronChainId, ChainFamily } from '@wdk-starter/wdk-web-core/types';
import { validateAddress, parsePaymentUri } from '@wdk-starter/wdk-web-core/payments';
import { send } from '../lib/sw-client.js';
import { addTransaction } from '../hooks/use-transactions.js';
import { encodeErc20Transfer } from '../lib/erc20.js';

export interface SendViewProps {
  readonly chain: EvmChainId | SolanaChainId | BtcChainId | TonChainId | TronChainId;
  readonly symbol: string;
  /** The active account index to send from (BIP-44 derivation). */
  readonly accountIndex: number;
  /** Asset kind — selects address format, decimals, and the send message. Defaults to 'evm'. */
  readonly kind?: 'evm' | 'solana' | 'bitcoin' | 'ton' | 'tron';
  /** When set (EVM only), sends this ERC-20 token via transfer() calldata instead of native value. */
  readonly token?: { readonly address: string; readonly decimals: number } | null;
  readonly onBack: () => void;
  /** Called after a successful broadcast so the parent can refresh the balance. */
  readonly onSent?: () => void;
}

/** Formats a base-unit bigint back into a decimal string (for prefilling an amount from a payment URI). */
function formatBaseToDecimal(base: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = (base % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Parses a decimal amount into a base-unit bigint with the given decimals. */
function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Enter a valid amount.');
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) throw new Error('Too many decimals.');
  const padded = frac.padEnd(decimals, '0');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

type Phase =
  | { status: 'form' }
  | { status: 'sending' }
  | { status: 'sent'; hash: string };

export function SendView({ chain, symbol, accountIndex, kind = 'evm', token, onBack, onSent }: SendViewProps): JSX.Element {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });
  const isSolana = kind === 'solana';
  const isBitcoin = kind === 'bitcoin';
  const isTon = kind === 'ton';
  const isTron = kind === 'tron';
  const family: ChainFamily = isSolana ? 'solana' : isBitcoin ? 'bitcoin' : isTon ? 'ton' : isTron ? 'tron' : 'evm';

  // Paste-aware recipient: a BIP-21 (bitcoin:) or EIP-681 (ethereum:) payment URI
  // fills the address and, when present, the amount — a scanned/copied request "just works".
  const onRecipientChange = useCallback((raw: string): void => {
    const parsed = parsePaymentUri(raw.trim());
    if (parsed && parsed.scheme === 'bip21' && family === 'bitcoin') {
      setTo(parsed.address);
      if (parsed.satoshis !== undefined) setAmount(formatBaseToDecimal(parsed.satoshis, 8));
      return;
    }
    if (parsed && parsed.scheme === 'eip681' && family === 'evm' && !token) {
      setTo(parsed.address);
      if (parsed.wei !== undefined) setAmount(formatBaseToDecimal(parsed.wei, 18));
      return;
    }
    setTo(raw);
  }, [family, token]);

  const handleSend = useCallback(async (): Promise<void> => {
    setError(null);
    const decimals = token ? token.decimals : isSolana ? 9 : isBitcoin ? 8 : isTon ? 9 : isTron ? 6 : 18;
    const recipient = to.trim();
    const check = validateAddress(family, recipient);
    if (!check.valid) {
      setError(check.reason ? `Enter a valid recipient address — ${check.reason}.` : 'Enter a valid recipient address.');
      return;
    }
    let value: bigint;
    try {
      value = parseAmount(amount, decimals);
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
      let hash: string;
      if (isSolana) {
        hash = await send({ type: 'ACCOUNT_SEND_SOLANA_TRANSACTION', chain: chain as SolanaChainId, accountIndex, to: recipient, value: value.toString() });
      } else if (isBitcoin) {
        hash = await send({ type: 'ACCOUNT_SEND_BTC_TRANSACTION', chain: chain as BtcChainId, accountIndex, to: recipient, value: value.toString() });
      } else if (isTon) {
        hash = await send({ type: 'ACCOUNT_SEND_TON_TRANSACTION', chain: chain as TonChainId, accountIndex, to: recipient, value: value.toString() });
      } else if (isTron) {
        hash = await send({ type: 'ACCOUNT_SEND_TRON_TRANSACTION', chain: chain as TronChainId, accountIndex, to: recipient, value: value.toString() });
      } else if (token) {
        // ERC-20 transfer: call the token contract with transfer() calldata, value 0.
        hash = await send({ type: 'ACCOUNT_SEND_TRANSACTION', chain: chain as EvmChainId, accountIndex, to: token.address, value: '0', data: encodeErc20Transfer(recipient, value) });
      } else {
        hash = await send({ type: 'ACCOUNT_SEND_TRANSACTION', chain: chain as EvmChainId, accountIndex, to: recipient, value: value.toString() });
      }
      addTransaction({ hash, chain, to: recipient, value: value.toString(), symbol, decimals, ts: Date.now() });
      setPhase({ status: 'sent', hash });
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
      setPhase({ status: 'form' });
    }
  }, [to, amount, chain, accountIndex, family, isSolana, isBitcoin, isTon, isTron, token, symbol, onSent]);

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
              <Input value={to} onChange={(e) => onRecipientChange(e.target.value)} placeholder={isSolana ? 'Base58 address' : isBitcoin ? 'bc1… or legacy address' : isTon ? 'EQ… / UQ… address' : isTron ? 'T… address' : '0x…'} />
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
