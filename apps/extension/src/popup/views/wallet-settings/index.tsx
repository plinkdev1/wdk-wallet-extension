/**
 * WalletSettingsView - Wallet operational settings shell.
 *
 * Sibling to SettingsView. SettingsView is reached via the App-level
 * corner gear and contains dev/brand customization (Appearance + Brand
 * sections). WalletSettingsView is reached via the MainView header gear
 * (post-unlock only) and contains the user-facing wallet operational
 * controls: account, security, network, advanced.
 *
 * This commit ships the shell + section headers as placeholders pointing
 * at the future phase that implements each. Subsequent phases (B0c.x,
 * B1) fill in the section bodies.
 *
 * Why two views: the corner gear is a one-time dev-configuration surface
 * that can be DISABLED for production builds (see VITE_WDK_CUSTOMIZATION_UI
 * - coming in the next commit). The header gear is the always-on user
 * surface for managing the wallet itself. Mixing the two means devs cant
 * cleanly turn off the customization UI without also hiding wallet
 * controls users need at runtime.
 */

import { type CSSProperties } from 'react';
import { AutoLockSelector, ChainSelector, NetworkIcon, useActiveChain } from '@wdk-starter/wdk-ui';
import { useAutoLockMinutes } from '../../hooks/use-auto-lock-minutes.js';
import type { ChainId, EvmChainId } from '@wdk-starter/wdk-web-core/types';

export interface WalletSettingsViewProps {
  readonly onBack: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100%',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
};

const backButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary, currentColor)',
  cursor: 'pointer',
  fontSize: 14,
  padding: 4,
  fontFamily: 'var(--font-body, inherit)',
};

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text-primary, currentColor)',
  margin: 0,
};

const contentStyle: CSSProperties = {
  flex: 1,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
};

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 'var(--radius-md, 6px)',
  backgroundColor: 'var(--bg-elevated-1, rgba(255,255,255,0.04))',
  border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
};

const sectionHeadingStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary, currentColor)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
};

const sectionBodyStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--text-tertiary, currentColor)',
  margin: 0,
  lineHeight: 1.5,
};

const phaseTagStyle: CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 700,
  padding: '2px 6px',
  borderRadius: 4,
  backgroundColor: 'var(--bg-elevated-2, rgba(255,255,255,0.08))',
  color: 'var(--text-secondary, currentColor)',
  marginLeft: 8,
  verticalAlign: 'middle',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

interface SectionDef {
  readonly heading: string;
  readonly phase: string;
  readonly body: string;
}

const SECTIONS: ReadonlyArray<SectionDef> = [
  {
    heading: 'Account',
    phase: 'B0c',
    body: 'List and switch between accounts. Set the active account used by signing requests.',
  },
  {
    heading: 'Security',
    phase: '',  // B1c: partially live - auto-lock picker mounted; password + recovery come later
    body: 'Configure the auto-lock timeout. Password change + recovery phrase land in B0c+.',
  },
  {
    heading: 'Network',
    phase: '',  // B1b: real section - phase tag dropped, body becomes the active chain hint
    body: 'Pick the active chain. Balance + address re-fetch on switch. RPC overrides land in a follow-up.',
  },
  {
    heading: 'Advanced',
    phase: 'B0c',
    body: 'Developer diagnostics, vault re-encryption tools, JSON-RPC inspector toggles.',
  },
];

const AUTO_LOCK_OPTIONS = [
  { value: 1,  label: '1 minute'   },
  { value: 5,  label: '5 minutes'  },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour'     },
  { value: 0,  label: 'Never'      },
];
// B1-2: bulk-add - same expansion as main-view CHAIN_OPTIONS.
const NETWORK_CHAIN_OPTIONS = [
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
export function WalletSettingsView({ onBack }: WalletSettingsViewProps): JSX.Element {
  // B1c: auto-lock minutes (popup writes chrome.storage; bg listens)
  const { minutes: autoLockMinutes, setMinutes: setAutoLockMinutes, loading: autoLockLoading } = useAutoLockMinutes();
  // B1b: real Network section - active chain comes from useActiveChain
  const [activeChain, setActiveChain] = useActiveChain<ChainId>({ supported: NETWORK_CHAIN_OPTIONS.map((o) => o.id) as ReadonlyArray<ChainId>, default: 'ethereum' });
  return (
    <div style={containerStyle} data-testid="wallet-settings-view">
      <header style={headerStyle}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          data-testid="wallet-settings-back"
          style={backButtonStyle}
        >
          {'\u2190'} Back
        </button>
        <h1 style={titleStyle}>Wallet</h1>
      </header>
      <div style={contentStyle}>
        {SECTIONS.map((s) => (
          <section key={s.heading} style={sectionStyle} data-testid={`wallet-section-${s.heading.toLowerCase()}`}>
            <h2 style={sectionHeadingStyle}>
              {s.heading}
              {s.phase && <span style={phaseTagStyle}>Coming in {s.phase}</span>}
            </h2>
            <p style={sectionBodyStyle}>{s.body}</p>
            {s.heading === 'Network' && (
              <div style={{ marginTop: 8 }} data-testid="wallet-network-selector-wrapper">
                <ChainSelector active={activeChain} options={NETWORK_CHAIN_OPTIONS} onChange={setActiveChain} />
              </div>
            )}
            {s.heading === 'Security' && (
              <div style={{ marginTop: 8 }} data-testid="wallet-security-autolock-wrapper">
                <label style={{ fontSize: 11, color: 'var(--text-secondary, currentColor)', display: 'block', marginBottom: 4 }}>
                  Auto-lock after
                </label>
                <AutoLockSelector
                  value={autoLockMinutes}
                  options={AUTO_LOCK_OPTIONS}
                  onChange={(n) => { void setAutoLockMinutes(n); }}
                  disabled={autoLockLoading}
                />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}