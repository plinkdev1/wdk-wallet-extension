/**
 * SwapView — token swaps via the Velora (ParaSwap) DEX aggregator (EVM only).
 *
 * Flow: pick sell/buy tokens + an input amount -> quote (expected output + fee)
 * -> execute. The SW runs the protocol on the keyed account inside the worklet
 * (Velora's public aggregator API; plain EVM account over the configured RPC —
 * no bundler required). Keys never leave the service worker.
 */

import { useCallback, useState } from 'react';
import { Button, Card, Input, Label, TokenChip } from '@wdk-starter/wdk-ui';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { addTransaction } from '../hooks/use-transactions.js';
import { useGasless } from '../hooks/use-gasless.js';

export interface SwapViewProps {
  readonly chain: EvmChainId;
  readonly chainName: string;
  readonly accountIndex: number;
  readonly onBack: () => void;
  /** Rendered inside the tab shell — hide the back chevron (the TabBar owns nav). */
  readonly embedded?: boolean;
}

interface SwapToken {
  readonly symbol: string;
  readonly address: string;
  readonly decimals: number;
}

/** Common Velora-routable tokens per chain (sell/buy universe for the demo UI). */
const SWAP_TOKENS: Partial<Record<string, readonly SwapToken[]>> = {
  ethereum: [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  ],
  'polygon-mainnet': [
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  ],
  'arbitrum-mainnet': [
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18 },
  ],
};

function parseAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') throw new Error('Enter a valid amount.');
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > decimals) throw new Error('Too many decimals.');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
}

function fmtAmount(base: string, decimals: number): string {
  try {
    const v = BigInt(base);
    const div = 10n ** BigInt(decimals);
    const whole = v / div;
    const frac = (v % div).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch {
    return '—';
  }
}

type Phase =
  | { status: 'form' }
  | { status: 'quoting' }
  | { status: 'quoted'; out: string; fee: string }
  | { status: 'swapping' }
  | { status: 'done'; hash: string };

export function SwapView({ chain, chainName, accountIndex, onBack, embedded = false }: SwapViewProps): JSX.Element {
  const tokens = SWAP_TOKENS[chain];
  const supported = Boolean(tokens && tokens.length >= 2);

  const [inIdx, setInIdx] = useState(0);
  const [outIdx, setOutIdx] = useState(1);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });
  const { available: gaslessAvailable, gasless, setGasless } = useGasless();

  const tokenIn = tokens?.[inIdx];
  const tokenOut = tokens?.[outIdx];

  const resetQuote = useCallback(() => { setPhase({ status: 'form' }); }, []);

  const handleQuote = useCallback(async (): Promise<void> => {
    setError(null);
    if (!tokenIn || !tokenOut) return;
    if (tokenIn.address === tokenOut.address) { setError('Choose two different tokens.'); return; }
    let amountBase: bigint;
    try {
      amountBase = parseAmount(amount, tokenIn.decimals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount.'); return;
    }
    if (amountBase <= 0n) { setError('Amount must be greater than zero.'); return; }

    setPhase({ status: 'quoting' });
    try {
      const q = await send({ type: 'VELORA_QUOTE_SWAP', chain, accountIndex, tokenIn: tokenIn.address, tokenOut: tokenOut.address, tokenInAmount: amountBase.toString() });
      setPhase({ status: 'quoted', out: q.tokenOutAmount, fee: q.fee });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed.');
      setPhase({ status: 'form' });
    }
  }, [tokenIn, tokenOut, amount, chain, accountIndex]);

  const handleSwap = useCallback(async (): Promise<void> => {
    setError(null);
    if (!tokenIn || !tokenOut) return;
    let amountBase: bigint;
    try {
      amountBase = parseAmount(amount, tokenIn.decimals);
    } catch {
      setError('Invalid amount.'); return;
    }
    setPhase({ status: 'swapping' });
    try {
      const r = await send({ type: 'VELORA_SWAP', chain, accountIndex, tokenIn: tokenIn.address, tokenOut: tokenOut.address, tokenInAmount: amountBase.toString(), gasless });
      addTransaction({ hash: r.hash, chain, to: tokenOut.address, value: amountBase.toString(), symbol: `swap ${tokenIn.symbol}→${tokenOut.symbol}${gasless ? ' ⚡' : ''}`, decimals: tokenIn.decimals, ts: Date.now() });
      setPhase({ status: 'done', hash: r.hash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Swap failed.');
      setPhase({ status: 'form' });
    }
  }, [tokenIn, tokenOut, amount, chain, accountIndex, gasless]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!embedded && <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>}
        <h2 style={{ margin: 0, fontSize: 18 }}>Swap · {chainName}</h2>
      </header>

      {!supported && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Swaps via Velora are wired for Ethereum, Polygon, and Arbitrum. Switch networks to trade.
          </div>
        </Card>
      )}

      {supported && phase.status !== 'done' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            <div>
              <Label>Sell</Label>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {tokens!.map((t, i) => (
                  <Button key={t.address} size="sm" variant={inIdx === i ? 'primary' : 'secondary'} onClick={() => { setInIdx(i); resetQuote(); }} style={{ flex: 1 }}><TokenChip symbol={t.symbol} /></Button>
                ))}
              </div>
            </div>
            <div>
              <Label>Buy</Label>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {tokens!.map((t, i) => (
                  <Button key={t.address} size="sm" variant={outIdx === i ? 'primary' : 'secondary'} onClick={() => { setOutIdx(i); resetQuote(); }} style={{ flex: 1 }}><TokenChip symbol={t.symbol} /></Button>
                ))}
              </div>
            </div>
            <label>
              <Label>Amount ({tokenIn?.symbol ?? ''})</Label>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value); resetQuote(); }} placeholder="0.0" inputMode="decimal" />
            </label>

            {gaslessAvailable && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={gasless} onChange={(e) => { setGasless(e.target.checked); resetQuote(); }} />
                ⚡ Gasless (via smart account — pay no ETH)
              </label>
            )}

            {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{error}</div>}

            {phase.status === 'quoted' && (
              <div style={{ fontSize: 13, padding: '8px 10px', background: 'var(--bg-elevated-2, #241f1c)', borderRadius: 8 }}>
                Expected: <strong>{fmtAmount(phase.out, tokenOut?.decimals ?? 18)} {tokenOut?.symbol}</strong>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>Est. network fee: {fmtAmount(phase.fee, 18)} (native)</div>
              </div>
            )}

            {(phase.status === 'quoted' || phase.status === 'swapping') ? (
              <Button onClick={() => { void handleSwap(); }} disabled={phase.status === 'swapping'} style={{ width: '100%' }}>
                {phase.status === 'swapping' ? 'Swapping…' : 'Confirm swap'}
              </Button>
            ) : (
              <Button onClick={() => { void handleQuote(); }} disabled={phase.status === 'quoting'} style={{ width: '100%' }}>
                {phase.status === 'quoting' ? 'Quoting…' : 'Get quote'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {phase.status === 'done' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, alignItems: 'center' }}>
            <div style={{ fontSize: 36 }}>✅</div>
            <div style={{ textAlign: 'center', fontSize: 14 }}>Swap submitted.</div>
            <code style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'center', opacity: 0.8 }}>{phase.hash}</code>
            <Button onClick={onBack} style={{ width: '100%' }}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
