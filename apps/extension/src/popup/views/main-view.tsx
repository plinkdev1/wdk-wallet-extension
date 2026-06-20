/**
 * MainView - the default unlocked-and-no-pending-approval view.
 *
 * v0.1 scope (B5.3): minimum useful wallet surface.
 *   - Network badge (hardcoded "Ethereum Mainnet" for v0.1 - chain picker is v0.2+)
 *   - Account address with truncated display + copy-to-clipboard
 *   - Lock button (fires LOCK to the SW, triggers vault state refresh)
 *   - Future-work placeholder card for balances/send/receive/history
 *
 * Per ADR-006 the Lock button is always visible from MainView - one-click
 * lock from any unlocked surface is a security UX expectation.
 *
 * Routing context: this view is only mounted when
 *   App vault-state == 'unlocked' AND UnlockedRouter approval-queue == 'empty'.
 * After the user clicks Lock, the SW transitions to locked, onLockRequested()
 * triggers App's vault-state refresh, App re-routes to UnlockView.
 *
 * v0.2+ adds:
 *   - Multi-account switcher (account index selector)
 *   - Chain picker (changes the active chain context)
 *   - Real balance display via worker.rpc_getBalance
 *   - Send / Receive primary actions
 *   - Transaction history
 *   - Settings entry point (opens SettingsView with theme picker)
 */

import { useCallback, useState } from 'react';
import { Badge, Button, Card, ChainSelector, Label, NetworkIcon, TokenIcon, useActiveChain } from '@wdk-starter/wdk-ui';
import type { ChainId, EvmChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { useMainAccount } from '../hooks/use-main-account.js';
import { useBalance, formatEthFromWei } from '../hooks/use-balance.js';
import { ReceiveView } from './receive-view.js';
import { SendView } from './send-view.js';

export interface MainViewProps {
  /**
   * Called after a successful LOCK call so the parent can refresh vault state
   * and re-route to UnlockView. Prop-drilled from App -> UnlockedRouter -> here.
   */
  readonly onLockRequested: () => void;
  /**
   * B0b: opens the Settings view. Fired by the gear button in the header.
   * UnlockedRouter switches its local view state to 'settings' on this call.
   */
  readonly onOpenSettings: () => void;
}

// B1-2: bulk-add - CHAIN_OPTIONS now covers all 48 EVM chains (mainnets first,
// alphabetical by name; testnets second, alphabetical). Solana chains are in the
// registry but not in the picker yet - useMainAccount/useBalance are EVM-only and
// would error if a Solana chain were selected. Future phase adds Solana hooks.
const CHAIN_OPTIONS = [
  { id: 'abstract-mainnet' as const, name: 'Abstract', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="abstract-mainnet" size={14} /> },
  { id: 'arbitrum-mainnet' as const, name: 'Arbitrum One', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="arbitrum-mainnet" size={14} /> },
  { id: 'avalanche-mainnet' as const, name: 'Avalanche C-Chain', testnet: false, symbol: 'AVAX', icon: <NetworkIcon chain="avalanche-mainnet" size={14} /> },
  { id: 'bsc-mainnet' as const, name: 'BNB Smart Chain', testnet: false, symbol: 'BNB', icon: <NetworkIcon chain="bsc-mainnet" size={14} /> },
  { id: 'base-mainnet' as const, name: 'Base', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="base-mainnet" size={14} /> },
  { id: 'berachain-mainnet' as const, name: 'Berachain', testnet: false, symbol: 'BERA', icon: <NetworkIcon chain="berachain-mainnet" size={14} /> },
  { id: 'blast-mainnet' as const, name: 'Blast', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="blast-mainnet" size={14} /> },
  { id: 'boba-mainnet' as const, name: 'Boba Network', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="boba-mainnet" size={14} /> },
  { id: 'celo-mainnet' as const, name: 'Celo', testnet: false, symbol: 'CELO', icon: <NetworkIcon chain="celo-mainnet" size={14} /> },
  { id: 'cronos-mainnet' as const, name: 'Cronos', testnet: false, symbol: 'CRO', icon: <NetworkIcon chain="cronos-mainnet" size={14} /> },
  { id: 'ethereum' as const, name: 'Ethereum Mainnet', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="ethereum" size={14} /> },
  { id: 'gnosis-mainnet' as const, name: 'Gnosis Chain', testnet: false, symbol: 'XDAI', icon: <NetworkIcon chain="gnosis-mainnet" size={14} /> },
  { id: 'ink-mainnet' as const, name: 'Ink', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="ink-mainnet" size={14} /> },
  { id: 'linea-mainnet' as const, name: 'Linea', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="linea-mainnet" size={14} /> },
  { id: 'manta-pacific-mainnet' as const, name: 'Manta Pacific', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="manta-pacific-mainnet" size={14} /> },
  { id: 'mantle-mainnet' as const, name: 'Mantle', testnet: false, symbol: 'MNT', icon: <NetworkIcon chain="mantle-mainnet" size={14} /> },
  { id: 'metis-mainnet' as const, name: 'Metis Andromeda', testnet: false, symbol: 'METIS', icon: <NetworkIcon chain="metis-mainnet" size={14} /> },
  { id: 'mode-mainnet' as const, name: 'Mode', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="mode-mainnet" size={14} /> },
  { id: 'moonbeam-mainnet' as const, name: 'Moonbeam', testnet: false, symbol: 'GLMR', icon: <NetworkIcon chain="moonbeam-mainnet" size={14} /> },
  { id: 'moonriver-mainnet' as const, name: 'Moonriver', testnet: false, symbol: 'MOVR', icon: <NetworkIcon chain="moonriver-mainnet" size={14} /> },
  { id: 'optimism-mainnet' as const, name: 'Optimism', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="optimism-mainnet" size={14} /> },
  { id: 'plasma-mainnet' as const, name: 'Plasma Mainnet', testnet: false, symbol: 'XPL', icon: <NetworkIcon chain="plasma-mainnet" size={14} /> },
  { id: 'polygon-mainnet' as const, name: 'Polygon', testnet: false, symbol: 'MATIC', icon: <NetworkIcon chain="polygon-mainnet" size={14} /> },
  { id: 'polygon-zkevm-mainnet' as const, name: 'Polygon zkEVM', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="polygon-zkevm-mainnet" size={14} /> },
  { id: 'scroll-mainnet' as const, name: 'Scroll', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="scroll-mainnet" size={14} /> },
  { id: 'soneium-mainnet' as const, name: 'Soneium', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="soneium-mainnet" size={14} /> },
  { id: 'sonic-mainnet' as const, name: 'Sonic', testnet: false, symbol: 'S', icon: <NetworkIcon chain="sonic-mainnet" size={14} /> },
  { id: 'taiko-mainnet' as const, name: 'Taiko Alethia', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="taiko-mainnet" size={14} /> },
  { id: 'unichain-mainnet' as const, name: 'Unichain', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="unichain-mainnet" size={14} /> },
  { id: 'worldchain-mainnet' as const, name: 'World Chain', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="worldchain-mainnet" size={14} /> },
  { id: 'zora-mainnet' as const, name: 'Zora', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="zora-mainnet" size={14} /> },
  { id: 'zksync-mainnet' as const, name: 'zkSync Era', testnet: false, symbol: 'ETH', icon: <NetworkIcon chain="zksync-mainnet" size={14} /> },
  { id: 'solana-mainnet' as const, name: 'Solana', testnet: false, symbol: 'SOL', icon: <NetworkIcon chain="solana-mainnet" size={14} /> },
  { id: 'arbitrum-sepolia-testnet' as const, name: 'Arbitrum Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="arbitrum-sepolia-testnet" size={14} /> },
  { id: 'avalanche-fuji-testnet' as const, name: 'Avalanche Fuji', testnet: true, symbol: 'AVAX', icon: <NetworkIcon chain="avalanche-fuji-testnet" size={14} /> },
  { id: 'bsc-testnet' as const, name: 'BNB Smart Chain Testnet', testnet: true, symbol: 'BNB', icon: <NetworkIcon chain="bsc-testnet" size={14} /> },
  { id: 'base-sepolia-testnet' as const, name: 'Base Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="base-sepolia-testnet" size={14} /> },
  { id: 'blast-sepolia-testnet' as const, name: 'Blast Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="blast-sepolia-testnet" size={14} /> },
  { id: 'holesky-testnet' as const, name: 'Ethereum Holesky', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="holesky-testnet" size={14} /> },
  { id: 'hoodi-testnet' as const, name: 'Ethereum Hoodi', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="hoodi-testnet" size={14} /> },
  { id: 'sepolia-testnet' as const, name: 'Ethereum Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="sepolia-testnet" size={14} /> },
  { id: 'linea-sepolia-testnet' as const, name: 'Linea Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="linea-sepolia-testnet" size={14} /> },
  { id: 'mantle-sepolia-testnet' as const, name: 'Mantle Sepolia', testnet: true, symbol: 'MNT', icon: <NetworkIcon chain="mantle-sepolia-testnet" size={14} /> },
  { id: 'moonbase-alpha-testnet' as const, name: 'Moonbase Alpha', testnet: true, symbol: 'DEV', icon: <NetworkIcon chain="moonbase-alpha-testnet" size={14} /> },
  { id: 'optimism-sepolia-testnet' as const, name: 'Optimism Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="optimism-sepolia-testnet" size={14} /> },
  { id: 'plasma-testnet' as const, name: 'Plasma Testnet', testnet: true, symbol: 'XPL', icon: <NetworkIcon chain="plasma-testnet" size={14} /> },
  { id: 'polygon-amoy-testnet' as const, name: 'Polygon Amoy', testnet: true, symbol: 'MATIC', icon: <NetworkIcon chain="polygon-amoy-testnet" size={14} /> },
  { id: 'scroll-sepolia-testnet' as const, name: 'Scroll Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="scroll-sepolia-testnet" size={14} /> },
  { id: 'zksync-sepolia-testnet' as const, name: 'zkSync Era Sepolia', testnet: true, symbol: 'ETH', icon: <NetworkIcon chain="zksync-sepolia-testnet" size={14} /> },
  { id: 'solana-devnet' as const, name: 'Solana Devnet', testnet: true, symbol: 'SOL', icon: <NetworkIcon chain="solana-devnet" size={14} /> },
  { id: 'solana-testnet' as const, name: 'Solana Testnet', testnet: true, symbol: 'SOL', icon: <NetworkIcon chain="solana-testnet" size={14} /> },
];
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function MainView({ onLockRequested, onOpenSettings }: MainViewProps): JSX.Element {
  // B1b: active chain state (localStorage-persisted via useActiveChain)
  // B1-icons: ChainId-typed picker. Solana entries exist in registry + picker;
  // the EVM hooks below short-circuit to ethereum sentinel when a Solana
  // chain is active so we don't fire a useMainAccount/useBalance call that
  // would throw. Real Solana hooks land in a future phase.
  const [activeChain, setActiveChain] = useActiveChain<ChainId>({ supported: CHAIN_OPTIONS.map((o) => o.id) as ReadonlyArray<ChainId>, default: 'ethereum' });
  const isSolanaChain = activeChain === 'solana-mainnet' || activeChain === 'solana-devnet' || activeChain === 'solana-testnet';
  const evmChain: EvmChainId = isSolanaChain ? 'ethereum' : (activeChain as EvmChainId);
  // B1-2 polish: derive currency symbol from active chain so the balance label
  // shows the right unit (ETH on L1/L2 ETH chains, MATIC on Polygon, BNB on BSC,
  // SOL on Solana once those chains land in the picker, etc.).
  const activeSymbol = CHAIN_OPTIONS.find((o) => o.id === activeChain)?.symbol ?? 'ETH';
  const activeName = CHAIN_OPTIONS.find((o) => o.id === activeChain)?.name ?? 'this network';
  const [subView, setSubView] = useState<'main' | 'receive' | 'send'>('main');
  const [accountIndex, setAccountIndex] = useState(0);
  const { state: accountState } = useMainAccount({ chain: evmChain, accountIndex });
  const { state: balanceState } = useBalance(
    !isSolanaChain && accountState.status === 'ready' ? { address: accountState.address, chain: evmChain } : {},
  );
  const [locking, setLocking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLock = useCallback(async (): Promise<void> => {
    if (locking) return;
    setLocking(true);
    try {
      await send({ type: 'LOCK' });
      onLockRequested();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MainView] lock failed:', err);
    } finally {
      setLocking(false);
    }
  }, [locking, onLockRequested]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (accountState.status !== 'ready') return;
    try {
      await navigator.clipboard.writeText(accountState.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MainView] clipboard write failed:', err);
    }
  }, [accountState]);

  // Sub-views own the full surface; they're reached from the Send/Receive
  // actions and only available on EVM chains with a derived address.
  if (subView === 'receive' && accountState.status === 'ready') {
    return (
      <ReceiveView
        address={accountState.address}
        chainName={activeName}
        symbol={activeSymbol}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'send') {
    return (
      <SendView
        chain={evmChain}
        symbol={activeSymbol}
        accountIndex={accountIndex}
        onBack={() => setSubView('main')}
      />
    );
  }

  return (
    <div
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: 1,
        fontFamily: 'var(--font-body)',
        color: 'var(--text-primary)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <ChainSelector active={activeChain} options={CHAIN_OPTIONS} onChange={setActiveChain} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            onClick={() => { void handleLock(); }}
            disabled={locking}
          >
            {locking ? 'Locking...' : 'Lock'}
          </Button>
        </div>
      </header>

      {isSolanaChain && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
            <Label>Solana</Label>
            <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
              <strong>{activeChain}</strong> is registered in the wallet. Account address + balance for Solana chains land in a future phase (the EVM hooks don&apos;t apply here; a dedicated useSolanaAccount + Solana RPC adapter come next).
            </div>
          </div>
        </Card>
      )}
      {!isSolanaChain && (<>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
          <Label>Balance</Label>
          {balanceState.status === 'loading' && (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Loading balance...</div>
          )}
          {balanceState.status === 'error' && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 6,
                borderLeft: '3px solid var(--color-error, #EF4444)',
                fontSize: 12,
                color: 'var(--color-error, #EF4444)',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              Failed to load balance: {balanceState.error}
            </div>
          )}
          {balanceState.status === 'ready' && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 600 }}>
                {formatEthFromWei(balanceState.balance)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TokenIcon symbol={activeSymbol} size={14} /><span style={{ fontSize: 13, opacity: 0.6 }}>{activeSymbol}</span></span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Account {accountIndex + 1}</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button variant="ghost" size="sm" onClick={() => setAccountIndex((i) => Math.max(0, i - 1))} disabled={accountIndex === 0} aria-label="Previous account">◀</Button>
              <Button variant="ghost" size="sm" onClick={() => setAccountIndex((i) => i + 1)} aria-label="Next account">▶</Button>
            </div>
          </div>
          {accountState.status === 'loading' && (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Loading address...</div>
          )}
          {accountState.status === 'error' && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 6,
                borderLeft: '3px solid var(--color-error, #EF4444)',
                fontSize: 12,
                color: 'var(--color-error, #EF4444)',
                lineHeight: 1.4,
                wordBreak: 'break-word',
              }}
            >
              Failed to load address: {accountState.error}
            </div>
          )}
          {accountState.status === 'ready' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code
                title={accountState.address}
                style={{
                  fontSize: 13,
                  padding: '6px 10px',
                  backgroundColor: 'var(--bg-elevated-2)',
                  borderRadius: 4,
                  flex: 1,
                  wordBreak: 'break-all',
                }}
              >
                {truncateAddress(accountState.address)}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleCopy(); }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button
          onClick={() => setSubView('send')}
          disabled={accountState.status !== 'ready'}
          style={{ flex: 1 }}
        >
          Send
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSubView('receive')}
          disabled={accountState.status !== 'ready'}
          style={{ flex: 1 }}
        >
          Receive
        </Button>
      </div>
      </>)}

    </div>
  );
}