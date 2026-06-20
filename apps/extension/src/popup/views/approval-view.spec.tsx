/**
 * @vitest-environment jsdom
 *
 * ApprovalView routing tests (B4.7 update).
 *
 * Verifies the shared header + footer behavior and that per-method bodies
 * are selected by request.method. Body-internal rendering is tested in each
 * body's own spec (personal-sign-body.spec.tsx, sign-typed-data-body.spec.tsx,
 * default-body.spec.tsx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalView } from './approval-view.js';
import * as swClient from '../lib/sw-client.js';
import type { ApprovalRequest } from '../../background/approval-flow.js';

vi.mock('../lib/sw-client.js', () => ({
  send: vi.fn(),
}));

const sendMock = vi.mocked(swClient.send);

const baseRequest: ApprovalRequest = {
  id: 'req-xyz',
  origin: 'https://uniswap.org',
  method: 'eth_requestAccounts',
  params: [],
  createdAt: 1234567890,
};

describe('ApprovalView (B4.7 routing)', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ ok: true });
  });

  it('renders the host portion of the origin (not the full URL)', () => {
    render(<ApprovalView request={baseRequest} />);
    expect(screen.getByText('uniswap.org')).toBeInTheDocument();
    expect(screen.queryByText('https://uniswap.org')).toBeNull();
  });

  it('routes to DefaultBody for eth_requestAccounts (Connection Request title)', () => {
    render(<ApprovalView request={baseRequest} />);
    expect(screen.getByText('Connection Request')).toBeInTheDocument();
  });

  it('routes to PersonalSignBody for personal_sign (Sign Message title + decoded text)', () => {
    const req: ApprovalRequest = {
      ...baseRequest,
      method: 'personal_sign',
      params: ['0x48656c6c6f', '0xAa00000000000000000000000000000000000000'],
    };
    render(<ApprovalView request={req} />);
    expect(screen.getByText('Sign Message')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('routes to SignTypedDataBody for eth_signTypedData_v4', () => {
    const typedData = JSON.stringify({
      primaryType: 'Mail',
      domain: { name: 'Ether Mail' },
      message: { contents: 'Hi' },
    });
    const req: ApprovalRequest = {
      ...baseRequest,
      method: 'eth_signTypedData_v4',
      params: ['0xAa00000000000000000000000000000000000000', typedData],
    };
    render(<ApprovalView request={req} />);
    expect(screen.getByText('Sign Typed Data')).toBeInTheDocument();
    expect(screen.getByText(/Ether Mail/)).toBeInTheDocument();
  });

  it('routes to DefaultBody for unknown methods (generic title)', () => {
    const req: ApprovalRequest = {
      ...baseRequest,
      method: 'unknown_method_for_test',
      params: [{ to: '0x1' }],
    };
    render(<ApprovalView request={req} />);
    expect(screen.getByText(/Request: unknown_method_for_test/)).toBeInTheDocument();
  });

  it('routes to AddChainBody for wallet_addEthereumChain', () => {
    const req: ApprovalRequest = {
      ...baseRequest,
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x144',
        chainName: 'zkSync Era',
        rpcUrls: ['https://mainnet.era.zksync.io'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      }],
    };
    render(<ApprovalView request={req} />);
    expect(screen.getByText('Add Network')).toBeInTheDocument();
    expect(screen.getByText('zkSync Era')).toBeInTheDocument();
  });

  it('routes to SendTransactionBody for eth_sendTransaction', () => {
    const req: ApprovalRequest = {
      ...baseRequest,
      method: 'eth_sendTransaction',
      params: [{ to: '0xff00000000000000000000000000000000000001', value: '0xde0b6b3a7640000' }],
    };
    render(<ApprovalView request={req} />);
    expect(screen.getByText('Send Transaction')).toBeInTheDocument();
    expect(screen.getByText('1 ETH')).toBeInTheDocument();
  });

  it('clicking Approve sends APPROVAL_RESPOND with approved:true and calls onResponded', async () => {
    const onResponded = vi.fn();
    render(<ApprovalView request={baseRequest} onResponded={onResponded} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        type: 'APPROVAL_RESPOND',
        id: 'req-xyz',
        approved: true,
      });
      expect(onResponded).toHaveBeenCalledTimes(1);
    });
  });

  it('clicking Reject sends APPROVAL_RESPOND with approved:false and calls onResponded', async () => {
    const onResponded = vi.fn();
    render(<ApprovalView request={baseRequest} onResponded={onResponded} />);
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith({
        type: 'APPROVAL_RESPOND',
        id: 'req-xyz',
        approved: false,
      });
      expect(onResponded).toHaveBeenCalledTimes(1);
    });
  });

  it('does not crash when onResponded is not provided', async () => {
    render(<ApprovalView request={baseRequest} />);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(sendMock).toHaveBeenCalled();
    });
  });
});