/**
 * LendingView — supply / withdraw / borrow / repay against Aave V3 (EVM only).
 *
 * Flow: read the user's Aave account snapshot (collateral, debt, borrow
 * capacity, health factor) -> pick an action + reserve token + amount ->
 * message the SW (which runs the protocol on the keyed account inside the
 * worklet) -> show the tx hash. Keys never leave the service worker.
 *
 * Uses a plain WalletAccountEvm over the configured RPC — no bundler/paymaster
 * required (the ERC-4337 gasless path is a config away; see ROADMAP).
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Label, TokenChip } from '@wdk-starter/wdk-ui';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import type { WalletMessage } from '../../types/messages.js';
import { send } from '../lib/sw-client.js';
import { addTransaction } from '../hooks/use-transactions.js';
import { useGasless } from '../hooks/use-gasless.js';

export interface LendingViewProps {
  readonly chain: EvmChainId;
  readonly chainName: string;
  readonly accountIndex: number;
  readonly onBack: () => void;
}

interface ReserveToken {
  readonly symbol: string;
  readonly address: string;
  readonly decimals: number;
}

/** Aave V3 reserve tokens by chain. Aave V3 is live on these EVM networks. */
const AAVE_TOKENS: Partial<Record<string, readonly ReserveToken[]>> = {
  ethereum: [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  ],
  'polygon-mainnet': [
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
  ],
  'arbitrum-mainnet': [
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  ],
};

const ACTIONS = ['supply', 'withdraw', 'borrow', 'repay'] as const;
type Action = (typeof ACTIONS)[number];

const ACTION_MSG: Record<Action, 'AAVE_SUPPLY' | 'AAVE_WITHDRAW' | 'AAVE_BORROW' | 'AAVE_REPAY'> = {
  supply: 'AAVE_SUPPLY',
  withdraw: 'AAVE_WITHDRAW',
  borrow: 'AAVE_BORROW',
  repay: 'AAVE_REPAY',
};

function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Enter a valid amount.');
  }
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) throw new Error('Too many decimals.');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

/** Aave USD-base values carry 8 decimals; format as a dollar figure. */
function fmtUsd(base8: string): string {
  try {
    const n = Number(BigInt(base8)) / 1e8;
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  } catch {
    return '—';
  }
}

/** Health factor is a 1e18 wad; ≥ very-large means "no debt". */
function fmtHealth(hf: string, debt: string): string {
  try {
    if (BigInt(debt) === 0n) return '∞ (no debt)';
    return (Number(BigInt(hf)) / 1e18).toFixed(2);
  } catch {
    return '—';
  }
}

type Phase = { status: 'form' } | { status: 'sending' } | { status: 'sent'; hash: string };

interface AccountSnapshot {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
  healthFactor: string;
}

export function LendingView({ chain, chainName, accountIndex, onBack }: LendingViewProps): JSX.Element {
  const tokens = AAVE_TOKENS[chain];
  const supported = Boolean(tokens && tokens.length > 0);

  const [action, setAction] = useState<Action>('supply');
  const [tokenIdx, setTokenIdx] = useState(0);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [snapErr, setSnapErr] = useState<string | null>(null);
  const { available: gaslessAvailable, gasless, setGasless } = useGasless();
  const activeSymbol = tokens?.[tokenIdx]?.symbol ?? '';

  const refreshSnapshot = useCallback(async () => {
    if (!supported) return;
    setSnapErr(null);
    try {
      const data = await send({ type: 'AAVE_GET_ACCOUNT_DATA', chain, accountIndex });
      setSnapshot(data as AccountSnapshot);
    } catch (e) {
      setSnapErr(e instanceof Error ? e.message : 'Failed to load Aave position.');
    }
  }, [supported, chain, accountIndex]);

  useEffect(() => { void refreshSnapshot(); }, [refreshSnapshot]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(null);
    const token = tokens?.[tokenIdx];
    if (!token) return;
    let amountBase: bigint;
    try {
      amountBase = parseAmount(amount, token.decimals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount.');
      return;
    }
    if (amountBase <= 0n) { setError('Amount must be greater than zero.'); return; }

    setPhase({ status: 'sending' });
    try {
      const result = await send({ type: ACTION_MSG[action], chain, accountIndex, token: token.address, amount: amountBase.toString(), gasless } as Extract<WalletMessage, { type: 'AAVE_SUPPLY' }>);
      const hash = result.hash;
      addTransaction({ hash, chain, to: token.address, value: amountBase.toString(), symbol: `${action} ${token.symbol}${gasless ? ' ⚡' : ''}`, decimals: token.decimals, ts: Date.now() });
      setPhase({ status: 'sent', hash });
      void refreshSnapshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed.');
      setPhase({ status: 'form' });
    }
  }, [tokens, tokenIdx, amount, action, chain, accountIndex, gasless, refreshSnapshot]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Aave V3 · {chainName}</h2>
      </header>

      {!supported && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Aave V3 isn’t deployed on {chainName}. Switch to Ethereum, Polygon, or Arbitrum to supply,
            borrow, and earn.
          </div>
        </Card>
      )}

      {supported && (
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
              <Label>Your position</Label>
              {snapErr && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{snapErr}</div>}
              {!snapshot && !snapErr && <div style={{ fontSize: 12, opacity: 0.6 }}>Loading position…</div>}
              {snapshot && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                  <Stat label="Collateral" value={fmtUsd(snapshot.totalCollateralBase)} />
                  <Stat label="Debt" value={fmtUsd(snapshot.totalDebtBase)} />
                  <Stat label="Available to borrow" value={fmtUsd(snapshot.availableBorrowsBase)} />
                  <Stat label="Health factor" value={fmtHealth(snapshot.healthFactor, snapshot.totalDebtBase)} />
                </div>
              )}
            </div>
          </Card>

          {phase.status !== 'sent' && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
                <div>
                  <Label>Action</Label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {ACTIONS.map((a) => (
                      <Button key={a} size="sm" variant={action === a ? 'primary' : 'secondary'} onClick={() => setAction(a)} style={{ flex: 1, textTransform: 'capitalize' }}>
                        {a}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Token</Label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {tokens!.map((t, i) => (
                      <Button key={t.address} size="sm" variant={tokenIdx === i ? 'primary' : 'secondary'} onClick={() => setTokenIdx(i)} style={{ flex: 1 }}>
                        <TokenChip symbol={t.symbol} />
                      </Button>
                    ))}
                  </div>
                </div>

                <label>
                  <Label>Amount ({activeSymbol})</Label>
                  <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" inputMode="decimal" />
                </label>

                {gaslessAvailable && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <input type="checkbox" checked={gasless} onChange={(e) => setGasless(e.target.checked)} />
                    ⚡ Gasless (via smart account — pay no ETH)
                  </label>
                )}

                {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{error}</div>}

                <Button onClick={() => { void handleSubmit(); }} disabled={phase.status === 'sending'} style={{ width: '100%', textTransform: 'capitalize' }}>
                  {phase.status === 'sending' ? 'Submitting…' : `${action} ${activeSymbol}`}
                </Button>
                <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
                  Supplying earns yield and enables borrowing. Borrow only against supplied collateral —
                  keep your health factor above 1.0 to avoid liquidation.
                </div>
              </div>
            </Card>
          )}

          {phase.status === 'sent' && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, alignItems: 'center' }}>
                <div style={{ fontSize: 36 }}>✅</div>
                <div style={{ textAlign: 'center', fontSize: 14, textTransform: 'capitalize' }}>{action} submitted.</div>
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

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.6 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
