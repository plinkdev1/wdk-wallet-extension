/**
 * AssetDetailView — a per-asset page (PRD pro-wallet hallmark) in the popup,
 * mirroring the template's AssetDetail: the asset's mark + balance + USD value,
 * Send / Receive for that asset, and the recent activity filtered to it (each
 * row a shared StatusPill). Balance is passed in by MainView (already fetched);
 * the USD value and history come from the existing hooks. A pushed view with a
 * back chevron.
 */

import { Button, Card, TokenIcon, StatusPill } from '@wdk-starter/wdk-ui';
import type { TokenInfo } from '../lib/tokens.js';
import { useTransactions, type TxRecord } from '../hooks/use-transactions.js';
import { useTransactionStatuses, type LiveStatus } from '../hooks/use-transaction-statuses.js';
import { useUsdValue } from '../hooks/use-usd-value.js';
import { explorerTxUrl } from '../lib/explorers.js';

function formatBaseUnits(base: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = (base % divisor).toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

function truncate(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Resolves the status shown for a row: live poll result first, then stored. */
function effectiveStatus(tx: TxRecord, live: Record<string, LiveStatus>): LiveStatus {
  const polled = live[tx.hash];
  if (polled) return polled;
  if (tx.status === 'success' || tx.status === 'failed') return tx.status;
  return 'pending';
}

export interface AssetDetailViewProps {
  readonly token: TokenInfo;
  readonly chain: string;
  readonly chainName: string;
  /** The held balance in base units (passed by MainView; null while unknown). */
  readonly balance: bigint | null;
  readonly onSend: () => void;
  readonly onReceive: () => void;
  readonly onBack: () => void;
}

export function AssetDetailView({ token, chain, chainName, balance, onSend, onReceive, onBack }: AssetDetailViewProps): JSX.Element {
  const usd = useUsdValue(token.symbol, balance, token.decimals);
  const { transactions } = useTransactions();
  const live = useTransactionStatuses(transactions);
  const txs = transactions.filter((t) => t.symbol === token.symbol && t.chain === chain);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">←</Button>
        <strong style={{ fontSize: 15 }}>{token.symbol}</strong>
      </header>

      <Card>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <TokenIcon symbol={token.symbol} size={44} />
          <div style={{ fontSize: 26, fontWeight: 700 }}>
            {balance === null ? '—' : formatBaseUnits(balance, token.decimals)} <span style={{ fontSize: 14, opacity: 0.6 }}>{token.symbol}</span>
          </div>
          {usd && <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {usd}</span>}
          <span style={{ fontSize: 11, opacity: 0.55 }}>{chainName}</span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button onClick={onSend} style={{ flex: 1 }}>Send</Button>
        <Button variant="secondary" onClick={onReceive} style={{ flex: 1 }}>Receive</Button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.6 }}>Recent {token.symbol} activity</div>
      {txs.length === 0 ? (
        <Card>
          <div style={{ padding: 14, fontSize: 12, opacity: 0.6, lineHeight: 1.5 }}>
            No {token.symbol} transactions yet. Sends you make appear here with live status.
          </div>
        </Card>
      ) : (
        txs.map((tx) => {
          const status = effectiveStatus(tx, live);
          const url = explorerTxUrl(tx.chain, tx.hash);
          return (
            <Card key={tx.hash + tx.ts}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13 }}>Sent to {truncate(tx.to)}</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{new Date(tx.ts).toLocaleTimeString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>-{formatBaseUnits(BigInt(tx.value), tx.decimals)} {tx.symbol}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <StatusPill status={status} size="sm" />
                    {url && <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>view ↗</a>}
                  </span>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
