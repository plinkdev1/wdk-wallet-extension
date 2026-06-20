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
import type { BtcChainId, ChainId, EvmChainId, SolanaChainId, TonChainId, TronChainId } from '@wdk-starter/wdk-web-core/types';
import { send } from '../lib/sw-client.js';
import { useMainAccount } from '../hooks/use-main-account.js';
import { useSolanaAccount } from '../hooks/use-solana-account.js';
import { useBtcAccount } from '../hooks/use-btc-account.js';
import { useTonAccount } from '../hooks/use-ton-account.js';
import { useTronAccount } from '../hooks/use-tron-account.js';
import { useUsdValue } from '../hooks/use-usd-value.js';
import { useBalance, formatEthFromWei } from '../hooks/use-balance.js';
import { useTokenBalances } from '../hooks/use-token-balances.js';
import type { TokenInfo } from '../lib/tokens.js';
import { ReceiveView } from './receive-view.js';
import { SendView } from './send-view.js';
import { LendingView } from './lending-view.js';
import { SwapView } from './swap-view.js';
import { BridgeView } from './bridge-view.js';
import { BuyView } from './buy-view.js';
import { SmartAccountView } from './smart-account-view.js';
import { ActivityView } from './activity-view.js';

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

/** Formats a token base-unit bigint to a human string (up to 4 decimals). */
function formatTokenAmount(base: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = (base % divisor).toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function MainView({ onLockRequested, onOpenSettings }: MainViewProps): JSX.Element {
  // B1b: active chain state (localStorage-persisted via useActiveChain)
  // B1-icons: ChainId-typed picker. Solana entries exist in registry + picker;
  // the EVM hooks below short-circuit to ethereum sentinel when a Solana
  // chain is active so we don't fire a useMainAccount/useBalance call that
  // would throw. Real Solana hooks land in a future phase.
  const [activeChain, setActiveChain] = useActiveChain<ChainId>({ supported: CHAIN_OPTIONS.map((o) => o.id) as ReadonlyArray<ChainId>, default: 'ethereum' });
  const isSolanaChain = activeChain === 'solana-mainnet' || activeChain === 'solana-devnet' || activeChain === 'solana-testnet';
  const isBitcoinChain = activeChain === 'bitcoin-mainnet' || activeChain === 'bitcoin-testnet';
  const isTonChain = activeChain === 'ton-mainnet';
  const isTronChain = activeChain === 'tron-mainnet';
  const isEvmChain = !isSolanaChain && !isBitcoinChain && !isTonChain && !isTronChain;
  const evmChain: EvmChainId = isEvmChain ? (activeChain as EvmChainId) : 'ethereum';
  // B1-2 polish: derive currency symbol from active chain so the balance label
  // shows the right unit (ETH on L1/L2 ETH chains, MATIC on Polygon, BNB on BSC,
  // SOL on Solana once those chains land in the picker, etc.).
  const activeSymbol = CHAIN_OPTIONS.find((o) => o.id === activeChain)?.symbol ?? 'ETH';
  const activeName = CHAIN_OPTIONS.find((o) => o.id === activeChain)?.name ?? 'this network';
  const [subView, setSubView] = useState<'main' | 'receive' | 'send' | 'activity' | 'lending' | 'swap' | 'bridge' | 'buy' | 'smart'>('main');
  /** When set, the Send view sends this ERC-20 token instead of the native asset. */
  const [sendToken, setSendToken] = useState<TokenInfo | null>(null);
  const [accountIndex, setAccountIndex] = useState(0);
  const { state: accountState } = useMainAccount({ chain: evmChain, accountIndex });
  const { state: balanceState } = useBalance(
    isEvmChain && accountState.status === 'ready' ? { address: accountState.address, chain: evmChain } : {},
  );
  const { state: tokenBalancesState } = useTokenBalances(
    isEvmChain && accountState.status === 'ready' ? { chain: evmChain, address: accountState.address } : {},
  );
  const { state: solanaAccountState } = useSolanaAccount(
    isSolanaChain
      ? { chain: activeChain as SolanaChainId, accountIndex, enabled: true }
      : { enabled: false },
  );
  const { state: btcAccountState } = useBtcAccount(
    isBitcoinChain
      ? { chain: activeChain as BtcChainId, accountIndex, enabled: true }
      : { enabled: false },
  );
  const { state: tonAccountState } = useTonAccount(
    isTonChain
      ? { chain: activeChain as TonChainId, accountIndex, enabled: true }
      : { enabled: false },
  );
  const { state: tronAccountState } = useTronAccount(
    isTronChain
      ? { chain: activeChain as TronChainId, accountIndex, enabled: true }
      : { enabled: false },
  );
  // Native-asset USD value for whichever chain is active (fiat display).
  const activeNativeBase: bigint | null = isEvmChain
    ? (balanceState.status === 'ready' ? balanceState.balance : null)
    : isBitcoinChain
      ? (btcAccountState.status === 'ready' ? btcAccountState.balanceSats : null)
      : isTonChain
        ? (tonAccountState.status === 'ready' ? tonAccountState.balanceNano : null)
        : isTronChain
          ? (tronAccountState.status === 'ready' ? tronAccountState.balanceSun : null)
          : null;
  const activeNativeDecimals = isBitcoinChain ? 8 : isTonChain ? 9 : isTronChain ? 6 : 18;
  const usdValue = useUsdValue(activeSymbol, activeNativeBase, activeNativeDecimals);
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
  const activeAddress = isSolanaChain
    ? (solanaAccountState.status === 'ready' ? solanaAccountState.address : null)
    : isBitcoinChain
      ? (btcAccountState.status === 'ready' ? btcAccountState.address : null)
      : isTonChain
        ? (tonAccountState.status === 'ready' ? tonAccountState.address : null)
        : isTronChain
          ? (tronAccountState.status === 'ready' ? tronAccountState.address : null)
          : (accountState.status === 'ready' ? accountState.address : null);

  if (subView === 'receive' && activeAddress) {
    return (
      <ReceiveView
        address={activeAddress}
        chainName={activeName}
        symbol={activeSymbol}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'send') {
    return (
      <SendView
        chain={isSolanaChain ? (activeChain as SolanaChainId) : isBitcoinChain ? (activeChain as BtcChainId) : isTonChain ? (activeChain as TonChainId) : isTronChain ? (activeChain as TronChainId) : evmChain}
        kind={isSolanaChain ? 'solana' : isBitcoinChain ? 'bitcoin' : isTonChain ? 'ton' : isTronChain ? 'tron' : 'evm'}
        symbol={sendToken ? sendToken.symbol : activeSymbol}
        token={isEvmChain && sendToken ? { address: sendToken.address, decimals: sendToken.decimals } : null}
        accountIndex={accountIndex}
        onBack={() => { setSendToken(null); setSubView('main'); }}
      />
    );
  }
  if (subView === 'activity') {
    return (
      <ActivityView
        onBack={() => setSubView('main')}
        chainName={(c) => CHAIN_OPTIONS.find((o) => o.id === c)?.name ?? c}
      />
    );
  }
  if (subView === 'lending' && isEvmChain) {
    return (
      <LendingView
        chain={evmChain}
        chainName={activeName}
        accountIndex={accountIndex}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'swap' && isEvmChain) {
    return (
      <SwapView
        chain={evmChain}
        chainName={activeName}
        accountIndex={accountIndex}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'bridge' && isEvmChain) {
    return (
      <BridgeView
        chain={evmChain}
        chainName={activeName}
        accountIndex={accountIndex}
        ownAddress={accountState.status === 'ready' ? accountState.address : ''}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'buy' && activeAddress) {
    return (
      <BuyView
        chain={activeChain}
        chainName={activeName}
        address={activeAddress}
        onBack={() => setSubView('main')}
      />
    );
  }
  if (subView === 'smart' && isEvmChain) {
    return (
      <SmartAccountView
        chain={evmChain}
        chainName={activeName}
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
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <Label>Solana address</Label>
              {solanaAccountState.status === 'loading' && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Loading address…</div>
              )}
              {solanaAccountState.status === 'error' && (
                <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  Failed to load address: {solanaAccountState.error}
                </div>
              )}
              {solanaAccountState.status === 'ready' && (
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{solanaAccountState.address}</code>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.4 }}>
                Native SOL send & receive are live. On-chain balance display uses a dedicated Solana RPC adapter (next).
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => { setSendToken(null); setSubView('send'); }} disabled={solanaAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => setSubView('receive')} disabled={solanaAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Receive
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSubView('activity')} style={{ alignSelf: 'center' }}>
            Activity ›
          </Button>
        </>
      )}

      {isBitcoinChain && (
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <Label>Bitcoin address (BIP-84)</Label>
              {btcAccountState.status === 'loading' && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Loading address…</div>
              )}
              {btcAccountState.status === 'error' && (
                <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  Failed to load address: {btcAccountState.error}
                </div>
              )}
              {btcAccountState.status === 'ready' && (
                <>
                  <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{btcAccountState.address}</code>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 600 }}>
                      {btcAccountState.balanceSats === null ? '—' : formatTokenAmount(btcAccountState.balanceSats, 8)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TokenIcon symbol={activeSymbol} size={14} /><span style={{ fontSize: 13, opacity: 0.6 }}>{activeSymbol}</span></span>
                  </div>
                  {usdValue && <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {usdValue}</span>}
                </>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.4 }}>
                Native segwit · balance &amp; send via Blockbook (Trezor public endpoint; set your own for production).
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => { setSendToken(null); setSubView('send'); }} disabled={btcAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => setSubView('receive')} disabled={btcAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Receive
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSubView('activity')} style={{ alignSelf: 'center' }}>
            Activity ›
          </Button>
        </>
      )}
      {isTonChain && (
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <Label>TON address (v5r1)</Label>
              {tonAccountState.status === 'loading' && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Loading address…</div>
              )}
              {tonAccountState.status === 'error' && (
                <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  Failed to load address: {tonAccountState.error}
                </div>
              )}
              {tonAccountState.status === 'ready' && (
                <>
                  <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{tonAccountState.address}</code>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 600 }}>
                      {tonAccountState.balanceNano === null ? '—' : formatTokenAmount(tonAccountState.balanceNano, 9)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TokenIcon symbol={activeSymbol} size={14} /><span style={{ fontSize: 13, opacity: 0.6 }}>{activeSymbol}</span></span>
                  </div>
                  {usdValue && <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {usdValue}</span>}
                </>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.4 }}>
                v5r1 wallet · balance &amp; send via TonCenter (public endpoint; set your own for production).
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => { setSendToken(null); setSubView('send'); }} disabled={tonAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => setSubView('receive')} disabled={tonAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Receive
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSubView('activity')} style={{ alignSelf: 'center' }}>
            Activity ›
          </Button>
        </>
      )}

      {isTronChain && (
        <>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
              <Label>Tron address</Label>
              {tronAccountState.status === 'loading' && (
                <div style={{ fontSize: 12, opacity: 0.6 }}>Loading address…</div>
              )}
              {tronAccountState.status === 'error' && (
                <div role="alert" style={{ fontSize: 12, color: 'var(--color-error, #EF4444)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  Failed to load address: {tronAccountState.error}
                </div>
              )}
              {tronAccountState.status === 'ready' && (
                <>
                  <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{tronAccountState.address}</code>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 600 }}>
                      {tronAccountState.balanceSun === null ? '—' : formatTokenAmount(tronAccountState.balanceSun, 6)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TokenIcon symbol={activeSymbol} size={14} /><span style={{ fontSize: 13, opacity: 0.6 }}>{activeSymbol}</span></span>
                  </div>
                  {usdValue && <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {usdValue}</span>}
                </>
              )}
              <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.4 }}>
                Balance &amp; send via TronGrid (public endpoint; set your own for production).
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => { setSendToken(null); setSubView('send'); }} disabled={tronAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => setSubView('receive')} disabled={tronAccountState.status !== 'ready'} style={{ flex: 1 }}>
              Receive
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setSubView('activity')} style={{ alignSelf: 'center' }}>
            Activity ›
          </Button>
        </>
      )}

      {isEvmChain && (<>
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
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 600 }}>
                  {formatEthFromWei(balanceState.balance)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><TokenIcon symbol={activeSymbol} size={14} /><span style={{ fontSize: 13, opacity: 0.6 }}>{activeSymbol}</span></span>
              </div>
              {usdValue && <span style={{ fontSize: 12, opacity: 0.6 }}>≈ {usdValue}</span>}
            </>
          )}
        </div>
      </Card>

      {tokenBalancesState.status === 'ready' && tokenBalancesState.balances.length > 0 && (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
            <Label>Tokens</Label>
            {tokenBalancesState.balances.map(({ token, balance }) => (
              <button
                key={token.address}
                onClick={() => { setSendToken(token); setSubView('send'); }}
                title={`Send ${token.symbol}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <TokenIcon symbol={token.symbol} size={16} />{token.symbol}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {balance === null ? '—' : formatTokenAmount(balance, token.decimals)}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>Send ›</span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

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
          onClick={() => { setSendToken(null); setSubView('send'); }}
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

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={() => setSubView('swap')} disabled={accountState.status !== 'ready'} style={{ flex: 1 }}>
          Swap
        </Button>
        <Button variant="secondary" onClick={() => setSubView('lending')} disabled={accountState.status !== 'ready'} style={{ flex: 1 }}>
          Earn (Aave)
        </Button>
        <Button variant="secondary" onClick={() => setSubView('bridge')} disabled={accountState.status !== 'ready'} style={{ flex: 1 }}>
          Bridge
        </Button>
      </div>

      <Button variant="secondary" onClick={() => setSubView('smart')} disabled={accountState.status !== 'ready'} style={{ width: '100%' }}>
        Smart Account (gasless)
      </Button>

      <Button variant="ghost" size="sm" onClick={() => setSubView('activity')} style={{ alignSelf: 'center' }}>
        Activity ›
      </Button>
      </>)}

      {activeAddress && (
        <Button variant="ghost" size="sm" onClick={() => setSubView('buy')} style={{ alignSelf: 'center' }}>
          Buy crypto ↗
        </Button>
      )}

    </div>
  );
}