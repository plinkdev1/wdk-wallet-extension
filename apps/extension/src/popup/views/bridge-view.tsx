/**
 * BridgeView — USDT0 cross-chain transfer via LayerZero OFT (EVM only).
 *
 * Flow: source = the active chain, target = the paired USDT0 network ->
 * enter amount + recipient (defaults to your own address) -> quote the native
 * bridge fee -> execute (the SW approves the OFT spender, then bridges, on the
 * keyed account inside the worklet). Keys never leave the service worker.
 *
 * Wired for the Ethereum <-> Arbitrum USDT0 route on a plain EVM account over
 * the configured RPC — no bundler required. OFT contract addresses are from the
 * protocol package's deployment config.
 */

import { useCallback, useState } from 'react';
import { Button, Card, Input, Label } from '@wdk-starter/wdk-ui';
import type { EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { addTransaction } from '../hooks/use-transactions.js';
import { useGasless } from '../hooks/use-gasless.js';

export interface BridgeViewProps {
  readonly chain: EvmChainId;
  readonly chainName: string;
  readonly accountIndex: number;
  /** The user's EVM address — same on the target EVM chain; the default recipient. */
  readonly ownAddress: string;
  readonly onBack: () => void;
}

interface BridgeRoute {
  /** Target chain key as the USDT0 package expects it. */
  readonly targetChain: string;
  readonly targetName: string;
  /** USDT token address on the SOURCE chain. */
  readonly usdt: string;
  /** USDT0 OFT contract on the SOURCE chain (approval spender). */
  readonly oft: string;
}

/** USDT0 routes keyed by source chain (addresses from the package deployment config). */
const BRIDGE_ROUTES: Partial<Record<string, BridgeRoute>> = {
  ethereum: {
    targetChain: 'arbitrum',
    targetName: 'Arbitrum',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    oft: '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee',
  },
  'arbitrum-mainnet': {
    targetChain: 'ethereum',
    targetName: 'Ethereum',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    oft: '0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92',
  },
};

const USDT_DECIMALS = 6;

function parseAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') throw new Error('Enter a valid amount.');
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (frac.length > USDT_DECIMALS) throw new Error('Too many decimals.');
  return BigInt(whole || '0') * 10n ** BigInt(USDT_DECIMALS) + BigInt(frac.padEnd(USDT_DECIMALS, '0') || '0');
}

function fmtNative(base: string): string {
  try {
    return (Number(BigInt(base)) / 1e18).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  } catch {
    return '—';
  }
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

type Phase =
  | { status: 'form' }
  | { status: 'quoting' }
  | { status: 'quoted'; fee: string }
  | { status: 'bridging' }
  | { status: 'done'; hash: string };

export function BridgeView({ chain, chainName, accountIndex, ownAddress, onBack }: BridgeViewProps): JSX.Element {
  const route = BRIDGE_ROUTES[chain];
  const supported = Boolean(route);

  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(ownAddress);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });
  const { available: gaslessAvailable, gasless, setGasless } = useGasless();

  const validate = useCallback((): { amountBase: bigint; to: string } | null => {
    setError(null);
    if (!route) return null;
    const to = recipient.trim();
    if (!EVM_ADDRESS.test(to)) { setError('Enter a valid recipient address.'); return null; }
    let amountBase: bigint;
    try {
      amountBase = parseAmount(amount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid amount.'); return null;
    }
    if (amountBase <= 0n) { setError('Amount must be greater than zero.'); return null; }
    return { amountBase, to };
  }, [route, recipient, amount]);

  const handleQuote = useCallback(async (): Promise<void> => {
    const v = validate();
    if (!v || !route) return;
    setPhase({ status: 'quoting' });
    try {
      const q = await send({ type: 'USDT0_QUOTE_BRIDGE', chain, accountIndex, targetChain: route.targetChain, recipient: v.to, token: route.usdt, amount: v.amountBase.toString(), oftContractAddress: route.oft });
      setPhase({ status: 'quoted', fee: q.fee });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed.');
      setPhase({ status: 'form' });
    }
  }, [validate, route, chain, accountIndex]);

  const handleBridge = useCallback(async (): Promise<void> => {
    const v = validate();
    if (!v || !route) return;
    setPhase({ status: 'bridging' });
    try {
      const r = await send({ type: 'USDT0_BRIDGE', chain, accountIndex, targetChain: route.targetChain, recipient: v.to, token: route.usdt, amount: v.amountBase.toString(), oftContractAddress: route.oft, gasless });
      addTransaction({ hash: r.hash, chain, to: v.to, value: v.amountBase.toString(), symbol: `bridge USDT→${route.targetName}${gasless ? ' ⚡' : ''}`, decimals: USDT_DECIMALS, ts: Date.now() });
      setPhase({ status: 'done', hash: r.hash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bridge failed.');
      setPhase({ status: 'form' });
    }
  }, [validate, route, chain, accountIndex, gasless]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Bridge USDT0</h2>
      </header>

      {!supported && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            The USDT0 bridge is wired for the Ethereum ⇄ Arbitrum route. Switch to Ethereum or Arbitrum
            to bridge USDT.
          </div>
        </Card>
      )}

      {supported && route && phase.status !== 'done' && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
              <span>{chainName}</span>
              <span style={{ opacity: 0.6 }}>→</span>
              <span>{route.targetName}</span>
            </div>

            <label>
              <Label>Amount (USDT)</Label>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value); setPhase({ status: 'form' }); }} placeholder="0.0" inputMode="decimal" />
            </label>
            <label>
              <Label>Recipient (on {route.targetName})</Label>
              <Input value={recipient} onChange={(e) => { setRecipient(e.target.value); setPhase({ status: 'form' }); }} placeholder="0x…" />
            </label>

            {gaslessAvailable && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <input type="checkbox" checked={gasless} onChange={(e) => { setGasless(e.target.checked); setPhase({ status: 'form' }); }} />
                ⚡ Gasless (via smart account — pay no ETH)
              </label>
            )}

            {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{error}</div>}

            {phase.status === 'quoted' && (
              <div style={{ fontSize: 13, padding: '8px 10px', background: 'var(--bg-elevated-2, #241f1c)', borderRadius: 8 }}>
                Est. bridge fee: <strong>{fmtNative(phase.fee)} (native)</strong>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>Bridging approves the OFT spender, then sends cross-chain via LayerZero.</div>
              </div>
            )}

            {(phase.status === 'quoted' || phase.status === 'bridging') ? (
              <Button onClick={() => { void handleBridge(); }} disabled={phase.status === 'bridging'} style={{ width: '100%' }}>
                {phase.status === 'bridging' ? 'Bridging…' : 'Confirm bridge'}
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
            <div style={{ textAlign: 'center', fontSize: 14 }}>Bridge submitted.</div>
            <code style={{ fontSize: 11, wordBreak: 'break-all', textAlign: 'center', opacity: 0.8 }}>{phase.hash}</code>
            <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'center' }}>Cross-chain delivery settles on the target network shortly.</div>
            <Button onClick={onBack} style={{ width: '100%' }}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
