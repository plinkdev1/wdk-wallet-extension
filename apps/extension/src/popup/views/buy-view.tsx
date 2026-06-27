/**
 * BuyView — fiat on-ramp via MoonPay.
 *
 * Template-grade integration: it activates from the host app's own MoonPay
 * publishable key (VITE_MOONPAY_API_KEY). With no key it renders a clear
 * "configure" notice — the integration is fully present, only the dev's key is
 * absent. With a key: pick an asset + fiat amount -> quote -> open the MoonPay
 * buy widget (signed by the app's backend in production, unsigned in sandbox).
 *
 * The SW generates the widget URL (no private key needed); the popup opens it.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Label, TokenChip } from '@wdk-starter/wdk-ui';
import { send } from '../lib/sw-client.js';

export interface BuyViewProps {
  readonly chain: string;
  readonly chainName: string;
  /** Recipient address on the active chain (where purchased crypto is delivered). */
  readonly address: string;
  readonly onBack: () => void;
}

interface BuyAsset {
  /** MoonPay currency code. */
  readonly code: string;
  readonly label: string;
}

/** Buyable MoonPay assets per chain (native + common stablecoins). */
const BUY_ASSETS: Partial<Record<string, readonly BuyAsset[]>> = {
  ethereum: [{ code: 'eth', label: 'ETH' }, { code: 'usdt', label: 'USDT' }, { code: 'usdc', label: 'USDC' }],
  'polygon-mainnet': [{ code: 'matic_polygon', label: 'POL' }, { code: 'usdt_polygon', label: 'USDT' }, { code: 'usdc_polygon', label: 'USDC' }],
  'arbitrum-mainnet': [{ code: 'eth_arbitrum', label: 'ETH' }, { code: 'usdt_arbitrum', label: 'USDT' }, { code: 'usdc_arbitrum', label: 'USDC' }],
  'bitcoin-mainnet': [{ code: 'btc', label: 'BTC' }],
  'solana-mainnet': [{ code: 'sol', label: 'SOL' }, { code: 'usdc_sol', label: 'USDC' }],
  'ton-mainnet': [{ code: 'ton', label: 'TON' }],
  'tron-mainnet': [{ code: 'trx', label: 'TRX' }, { code: 'usdt_tron', label: 'USDT' }],
};

const FIAT = 'usd';

type Config = 'checking' | 'configured' | 'unconfigured';
type Phase =
  | { status: 'form' }
  | { status: 'quoting' }
  | { status: 'quoted'; crypto: number; fee: number; total: number }
  | { status: 'opening' };

export function BuyView({ chain, chainName, address, onBack }: BuyViewProps): JSX.Element {
  const assets = BUY_ASSETS[chain];
  const [config, setConfig] = useState<Config>('checking');
  const [assetIdx, setAssetIdx] = useState(0);
  const [amount, setAmount] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: 'form' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ok = await send({ type: 'MOONPAY_IS_CONFIGURED' });
        if (!cancelled) setConfig(ok ? 'configured' : 'unconfigured');
      } catch {
        if (!cancelled) setConfig('unconfigured');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const asset = assets?.[assetIdx];

  const handleQuote = useCallback(async (): Promise<void> => {
    setError(null);
    if (!asset) return;
    const fiatAmount = Number(amount);
    if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) { setError('Enter a valid amount.'); return; }
    setPhase({ status: 'quoting' });
    try {
      const q = await send({ type: 'MOONPAY_QUOTE_BUY', fiatCurrency: FIAT, cryptoAsset: asset.code, fiatAmount });
      if (!q) { setError('MoonPay is not configured.'); setPhase({ status: 'form' }); return; }
      setPhase({ status: 'quoted', crypto: q.cryptoAmount, fee: q.feeAmount, total: q.totalAmount });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quote failed.');
      setPhase({ status: 'form' });
    }
  }, [asset, amount]);

  const handleBuy = useCallback(async (): Promise<void> => {
    setError(null);
    if (!asset) return;
    const fiatAmount = Number(amount);
    setPhase({ status: 'opening' });
    try {
      const url = await send({ type: 'MOONPAY_BUY', fiatCurrency: FIAT, cryptoAsset: asset.code, fiatAmount, recipient: address });
      window.open(url, '_blank', 'noopener,noreferrer');
      setPhase({ status: 'form' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open MoonPay.');
      setPhase({ status: 'form' });
    }
  }, [asset, amount, address]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">‹</Button>
        <h2 style={{ margin: 0, fontSize: 18 }}>Buy crypto</h2>
      </header>

      {config === 'checking' && <div style={{ fontSize: 12, opacity: 0.6 }}>Checking MoonPay…</div>}

      {config === 'unconfigured' && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            <strong>MoonPay on-ramp is ready to enable.</strong>
            <p style={{ margin: '8px 0 0' }}>
              Set <code>VITE_MOONPAY_API_KEY</code> (your publishable MoonPay key) — and, for production,
              <code>VITE_MOONPAY_SIGN_URL</code> (a backend that signs widget URLs). The integration is
              fully wired; it activates the moment a key is configured. Defaults to MoonPay <em>sandbox</em>.
            </p>
          </div>
        </Card>
      )}

      {config === 'configured' && !assets && (
        <Card>
          <div style={{ padding: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
            No MoonPay assets are mapped for {chainName} yet.
          </div>
        </Card>
      )}

      {config === 'configured' && assets && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            <div>
              <Label>Asset</Label>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                {assets.map((a, i) => (
                  <Button key={a.code} size="sm" variant={assetIdx === i ? 'primary' : 'secondary'} onClick={() => { setAssetIdx(i); setPhase({ status: 'form' }); }} style={{ flex: 1 }}><TokenChip symbol={a.label} /></Button>
                ))}
              </div>
            </div>
            <label>
              <Label>Amount (USD)</Label>
              <Input value={amount} onChange={(e) => { setAmount(e.target.value); setPhase({ status: 'form' }); }} placeholder="100" inputMode="decimal" />
            </label>

            {error && <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)' }}>{error}</div>}

            {phase.status === 'quoted' && (
              <div style={{ fontSize: 13, padding: '8px 10px', background: 'var(--bg-elevated-2, #241f1c)', borderRadius: 8 }}>
                You receive ≈ <strong>{phase.crypto} {asset?.label}</strong>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>Fee ${phase.fee.toFixed(2)} · total ${phase.total.toFixed(2)}</div>
              </div>
            )}

            {(phase.status === 'quoted' || phase.status === 'opening') ? (
              <Button onClick={() => { void handleBuy(); }} disabled={phase.status === 'opening'} style={{ width: '100%' }}>
                {phase.status === 'opening' ? 'Opening…' : 'Continue to MoonPay ↗'}
              </Button>
            ) : (
              <Button onClick={() => { void handleQuote(); }} disabled={phase.status === 'quoting'} style={{ width: '100%' }}>
                {phase.status === 'quoting' ? 'Quoting…' : 'Get quote'}
              </Button>
            )}
            <div style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.4 }}>
              Purchased {asset?.label} is delivered to your {chainName} address. MoonPay opens in a new tab.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
