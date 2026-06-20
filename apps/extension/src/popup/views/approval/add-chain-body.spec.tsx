/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddChainBody } from './add-chain-body.js';
import type { ApprovalRequest } from '../../../background/approval-flow.js';

function makeRequest(payload: Record<string, unknown>): ApprovalRequest {
  return {
    id: 'r1',
    origin: 'https://x',
    method: 'wallet_addEthereumChain',
    params: [payload],
    createdAt: 0,
  };
}

const fullPayload = {
  chainId: '0x144',
  chainName: 'zkSync Era',
  rpcUrls: ['https://mainnet.era.zksync.io'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://explorer.zksync.io'],
};

describe('AddChainBody', () => {
  it('renders the "Add Network" heading', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('Add Network')).toBeInTheDocument();
  });

  it('renders the chainName', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('zkSync Era')).toBeInTheDocument();
  });

  it('renders chainId in hex and decimal (0x144 -> 324)', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('0x144')).toBeInTheDocument();
    expect(screen.getByText('(324)')).toBeInTheDocument();
  });

  it('renders the native currency symbol', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('renders the primary RPC URL', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('https://mainnet.era.zksync.io')).toBeInTheDocument();
  });

  it('shows "+N more" when multiple rpcUrls', () => {
    const multi = { ...fullPayload, rpcUrls: ['https://a.example', 'https://b.example', 'https://c.example'] };
    render(<AddChainBody request={makeRequest(multi)} />);
    expect(screen.getByText(/RPC URL.*\+2 more/)).toBeInTheDocument();
  });

  it('renders the block explorer when present', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText('https://explorer.zksync.io')).toBeInTheDocument();
  });

  it('hides block explorer section when blockExplorerUrls is absent', () => {
    const noExplorer = { ...fullPayload, blockExplorerUrls: undefined };
    delete (noExplorer as Record<string, unknown>).blockExplorerUrls;
    render(<AddChainBody request={makeRequest(noExplorer)} />);
    expect(screen.queryByText(/Block Explorer/)).toBeNull();
  });

  it('renders the security warning', () => {
    render(<AddChainBody request={makeRequest(fullPayload)} />);
    expect(screen.getByText(/Be cautious/)).toBeInTheDocument();
  });
});