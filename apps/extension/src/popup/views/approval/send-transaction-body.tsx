/**
 * Per-method body for eth_sendTransaction approval popup.
 * Per PRD 01 Addendum S12.5.
 */

import type { ApprovalRequest } from '../../../background/approval-flow.js';

function hexWeiToEth(hexWei: string | undefined): string {
  if (!hexWei || typeof hexWei !== 'string') return '0';
  try {
    const clean = hexWei.startsWith('0x') ? hexWei.slice(2) : hexWei;
    const wei = BigInt('0x' + (clean || '0'));
    const whole = wei / 10n ** 18n;
    const frac = wei % 10n ** 18n;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : whole.toString();
  } catch {
    return hexWei;
  }
}

function truncateMiddle(s: string, head = 10, tail = 8): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

export interface SendTransactionBodyProps {
  readonly request: ApprovalRequest;
}

export function SendTransactionBody({ request }: SendTransactionBodyProps): JSX.Element {
  const params = request.params as readonly [Record<string, unknown>] | undefined;
  const tx = params?.[0] ?? {};

  const to = typeof tx.to === 'string' ? tx.to : '(missing)';
  const value = typeof tx.value === 'string' ? tx.value : '0x0';
  const data = typeof tx.data === 'string' ? tx.data : undefined;
  const from = typeof tx.from === 'string' ? tx.from : undefined;
  const gas = typeof tx.gas === 'string' ? tx.gas : (typeof tx.gasLimit === 'string' ? tx.gasLimit : undefined);

  const ethValue = hexWeiToEth(value);
  const dataLen = data && data.startsWith('0x') ? (data.length - 2) / 2 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Send Transaction</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.72, lineHeight: 1.5 }}>
        Review and approve. Once broadcast, the transaction cannot be cancelled.
      </p>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>To</div>
        <code style={{ fontSize: 12, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
          {to}
        </code>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Value</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{ethValue} ETH</div>
      </div>

      {dataLen > 0 && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Data ({dataLen} bytes)</div>
          <code style={{ fontSize: 10, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
            {data && (data.length > 80 ? truncateMiddle(data, 40, 8) : data)}
          </code>
        </div>
      )}

      {gas && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Gas Limit</div>
          <code style={{ fontSize: 12, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block' }}>
            {gas}
          </code>
        </div>
      )}

      {from && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>From</div>
          <code style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
            {from}
          </code>
        </div>
      )}
    </div>
  );
}