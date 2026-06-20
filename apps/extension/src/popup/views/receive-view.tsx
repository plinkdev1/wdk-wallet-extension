/**
 * ReceiveView - shows the active account's address as a QR code plus a
 * copyable string, so funds can be received on the active chain.
 *
 * Self-contained: it needs only the address + display labels, passed down
 * from MainView (which owns the account/chain context). No SW round-trip.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button, Card, Label } from '@wdk-starter/wdk-ui';
import { qrDataUrl } from '../lib/qr.js';

export interface ReceiveViewProps {
  readonly address: string;
  readonly chainName: string;
  readonly symbol: string;
  readonly onBack: () => void;
}

export function ReceiveView({ address, chainName, symbol, onBack }: ReceiveViewProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const qr = useMemo(() => qrDataUrl(address), [address]);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ReceiveView] clipboard write failed:', err);
    }
  }, [address]);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">←</Button>
        <strong style={{ fontSize: 15 }}>Receive {symbol}</strong>
      </header>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', lineHeight: 1.4 }}>
            Send only <strong>{chainName}</strong> assets to this address.
          </div>
          <img src={qr} alt="Address QR code" width={180} height={180} style={{ borderRadius: 10 }} />
          <Label>Your address</Label>
          <code style={{ fontSize: 12, wordBreak: 'break-all', textAlign: 'center', padding: '8px 10px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 6, width: '100%' }}>
            {address}
          </code>
          <Button variant="outline" onClick={() => { void handleCopy(); }} style={{ width: '100%' }}>
            {copied ? 'Copied!' : 'Copy address'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
