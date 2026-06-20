/**
 * Per-method body for wallet_addEthereumChain approval (EIP-3085).
 *
 * Shows the chain config in a clear, scannable layout with a security warning
 * about the risks of adding networks suggested by websites. The user can see:
 *   - Network Name (chainName)
 *   - Chain ID (hex + decimal)
 *   - Native Currency (symbol)
 *   - RPC URL (first of rpcUrls, with "+N more" if applicable)
 *   - Block Explorer (if blockExplorerUrls present)
 *
 * v0.1 limitation: even after the user approves, the chain is NOT registered
 * for subsequent switching (see dapp-handlers.ts wallet_addEthereumChain JSDoc).
 * The popup is informational; a follow-up commit in v0.2 wires the chain
 * registry + switching.
 */

import type { ApprovalRequest } from '../../../background/approval-flow.js';

interface AddChainPayload {
  readonly chainId?: string;
  readonly chainName?: string;
  readonly rpcUrls?: readonly string[];
  readonly nativeCurrency?: { readonly name?: string; readonly symbol?: string; readonly decimals?: number };
  readonly blockExplorerUrls?: readonly string[];
}

function hexToDecimal(hex: string | undefined): string {
  if (!hex || typeof hex !== 'string') return '?';
  try { return BigInt(hex).toString(10); } catch { return hex; }
}

export interface AddChainBodyProps {
  readonly request: ApprovalRequest;
}

export function AddChainBody({ request }: AddChainBodyProps): JSX.Element {
  const params = request.params as readonly [AddChainPayload] | undefined;
  const p = params?.[0] ?? {};

  const chainName = p.chainName ?? '(unnamed)';
  const chainIdHex = p.chainId ?? '?';
  const chainIdDec = hexToDecimal(p.chainId);
  const currencySymbol = p.nativeCurrency?.symbol ?? '?';
  const rpcPrimary = p.rpcUrls && p.rpcUrls.length > 0 ? p.rpcUrls[0] : '(no RPC URL)';
  const rpcMore = p.rpcUrls && p.rpcUrls.length > 1 ? p.rpcUrls.length - 1 : 0;
  const explorerPrimary = p.blockExplorerUrls && p.blockExplorerUrls.length > 0 ? p.blockExplorerUrls[0] : null;
  const explorerMore = p.blockExplorerUrls && p.blockExplorerUrls.length > 1 ? p.blockExplorerUrls.length - 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add Network</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.72, lineHeight: 1.5 }}>
        A website wants to add this network to your wallet.
      </p>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Network Name</div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{chainName}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Chain ID</div>
        <div style={{ fontSize: 13 }}>
          <code style={{ padding: '2px 6px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4 }}>{chainIdHex}</code>
          <span style={{ marginLeft: 8, opacity: 0.7 }}>({chainIdDec})</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Currency Symbol</div>
        <div style={{ fontSize: 13 }}>{currencySymbol}</div>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>RPC URL{rpcMore > 0 ? ` (+${rpcMore} more)` : ''}</div>
        <code style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
          {rpcPrimary}
        </code>
      </div>

      {explorerPrimary && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Block Explorer{explorerMore > 0 ? ` (+${explorerMore} more)` : ''}</div>
          <code style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
            {explorerPrimary}
          </code>
        </div>
      )}

      <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 6, fontSize: 12, lineHeight: 1.5 }}>
        <strong>Be cautious.</strong> Adding a malicious network can expose you to scams and loss of funds. Only approve networks you recognize. (v0.1: custom chains are shown but not yet activated for switching.)
      </div>
    </div>
  );
}