/**
 * SmartAccountView — ERC-4337 account abstraction (gasless sends).
 *
 * Template-grade integration: activates from the host app's own bundler
 * (VITE_BUNDLER_URL) and optional paymaster (VITE_PAYMASTER_URL). With no
 * bundler it shows a clear "configure" notice — the integration is fully
 * present. With a bundler: shows the counterfactual smart-account address +
 * native balance, and sends gasless UserOperations (pay gas in an ERC-20 via
 * the paymaster, or have the smart account pay its own gas).
 *
 * The SW builds the smart account from the seed inside the worklet; the popup
 * only collects intent. Keys never leave the service worker.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Label } from '@wdk-starter/wdk-ui';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { addTransaction } from '../hooks/use-transactions.js';

export interface SmartAccountViewProps {
  readonly chain: EvmChainId;
  readonly chainName: string;
  readonly symbol: string;
  readonly accountIndex: number;
  readonly onBack: () => void;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

function parseEther(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') throw new Error('Enter a valid amount.');
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > 18) throw new Error('Too many decimals.');
  return BigInt(whole || '0') * 10n ** 18n + BigInt(frac.padEnd(18, '0') || '0');
}

function fmtEther(wei: string): string {
  try {
    const v = BigInt(wei);
    const whole = v / 10n ** 18n;
    const frac = (v % 10n ** 18n).toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch {
    return '—';
  }
}

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

type Config = 'checking' | 'configured' | 'unconfigured';
type Phase = { status: 'form' } | { status: 'sending' } | { status: 'sent'; hash: string };

export function SmartAccountView({ chain, chainName, symbol, accountIndex, onBack }: SmartAccountViewProps): JSX.Element {
  const [config, setConfig] = useState<Config>('checking');
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [payWithToken, setPayWithToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ok = await send({ type: 'ERC4337_IS_CONFIGURED' });
        if (cancelled) return;
        if (!ok) { setConfig('unconfigured'); return; }
        setConfig('configured');
        try {
          const addr = await send({ type: 'ERC4337_GET_ADDRESS', chain, accountIndex });
          if (!cancelled) setAddress(addr);
          const bal = await send({ type: 'ERC4337_GET_BALANCE', chain, accountIndex });
          if (!cancelled) setBalance(bal);
        } catch (e) {
          if (!cancelled) setLoadErr(e instanceof Error ? e.message : 'Failed to load smart account.');
        }
      } catch {
        if (!cancelled) setConfig('unconfigured');
      }
    })();
    return () => { cancelled = true; };
  }, [chain, accountIndex]);

  const handleSend = useCallback(async (): Promise<void> => {
    setError(null);
    const recipient = to.trim();
    if (!EVM_ADDRESS.test(recipient)) { setError('Enter a valid recipient address.'); return; }
    let value: bigint;
    try {
      value = parseEther(amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount.'); return;
    }
    setPhase({ status: 'sending' });
    try {
      const r = await send({ type: 'ERC4337_SEND', chain, accountIndex, to: recipient, value: value.toString(), ...(payWithToken ? { paymasterToken: 'USDT' } : {}) });
      addTransaction({ hash: r.hash, chain, to: recipient, value: value.toString(), symbol: `${symbol} (gasless)`, decimals: 18, ts: Date.now() });
      setPhase({ status: 'sent', hash: r.hash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
      setPhase({ status: 'form' });
    }
  }, [to, amount, payWithToken, chain, accountIndex, symbol]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Smart Account · {chainName}</h2>
      </header>

      {config === 'checking' && <div style={{ fontSize: 12, opacity: 0.6 }}>Checking…</div>}

      {config === 'unconfigured' && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <strong>Gasless smart accounts are ready to enable.</strong>
            <p style={{ margin: '8px 0 0' }}>
              Set <code>VITE_BUNDLER_URL</code> (an ERC-4337 bundler) — and optionally
              <code>VITE_PAYMASTER_URL</code> for sponsored / pay-gas-in-token transactions. The
              integration is fully wired and activates the moment a bundler is configured.
            </p>
          </div>
        </Card>
      )}

      {config === 'configured' && (
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
              <Label>Smart-account address (ERC-4337)</Label>
              {loadErr && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{loadErr}</div>}
              {!address && !loadErr && <div style={{ fontSize: 12, opacity: 0.6 }}>Deriving…</div>}
              {address && <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{short(address)}</code>}
              {balance !== null && <div style={{ fontSize: 13 }}>Balance: <strong>{fmtEther(balance)} {symbol}</strong></div>}
            </div>
          </Card>

          {phase.status !== 'sent' && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
                <Label>Gasless send</Label>
                <label>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Recipient</span>
                  <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" />
                </label>
                <label>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Amount ({symbol})</span>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal" />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={payWithToken} onChange={(e) => setPayWithToken(e.target.checked)} />
                  Pay gas in USDT (requires a configured paymaster)
                </label>

                {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{error}</div>}

                <Button onClick={() => { void handleSend(); }} disabled={phase.status === 'sending'} style={{ width: '100%' }}>
                  {phase.status === 'sending' ? 'Submitting…' : 'Send gasless'}
                </Button>
                <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
                  Sends a UserOperation via your bundler. Without a paymaster the smart account pays its own
                  gas; with one, gas can be sponsored or paid in an ERC-20.
                </div>
              </div>
            </Card>
          )}

          {phase.status === 'sent' && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, alignItems: 'center' }}>
                <div style={{ fontSize: 36 }}>✅</div>
                <div style={{ textAlign: 'center', fontSize: 14 }}>UserOperation submitted.</div>
                <code style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'center', opacity: 0.8 }}>{phase.hash}</code>
                <Button onClick={onBack} style={{ width: '100%' }}>Done</Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
