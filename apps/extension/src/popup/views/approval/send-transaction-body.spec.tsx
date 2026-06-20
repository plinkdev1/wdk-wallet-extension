/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SendTransactionBody } from './send-transaction-body.js';
import type { ApprovalRequest } from '../../../background/approval-flow.js';

function makeRequest(tx: Record<string, unknown>): ApprovalRequest {
  return {
    id: 'r1',
    origin: 'https://x',
    method: 'eth_sendTransaction',
    params: [tx],
    createdAt: 0,
  };
}

describe('SendTransactionBody', () => {
  it('renders the "Send Transaction" heading', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0' })} />);
    expect(screen.getByText('Send Transaction')).toBeInTheDocument();
  });

  it('renders the To address', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xff00000000000000000000000000000000000001', value: '0x0' })} />);
    expect(screen.getByText('0xff00000000000000000000000000000000000001')).toBeInTheDocument();
  });

  it('decodes hex wei to ETH decimal (1 ETH = 0xde0b6b3a7640000)', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0xde0b6b3a7640000' })} />);
    expect(screen.getByText('1 ETH')).toBeInTheDocument();
  });

  it('decodes fractional ETH values (0.5 ETH)', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x6f05b59d3b20000' })} />);
    expect(screen.getByText('0.5 ETH')).toBeInTheDocument();
  });

  it('renders 0 ETH for value 0x0', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0' })} />);
    expect(screen.getByText('0 ETH')).toBeInTheDocument();
  });

  it('renders data section when data is present', () => {
    const data = '0xa9059cbb000000000000000000000000abc';
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0', data })} />);
    expect(screen.getByText(/Data \(/)).toBeInTheDocument();
  });

  it('hides data section when no data', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0' })} />);
    expect(screen.queryByText(/Data \(/)).toBeNull();
  });

  it('renders gas when provided', () => {
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0', gas: '0x5208' })} />);
    expect(screen.getByText('0x5208')).toBeInTheDocument();
  });

  it('renders from address when provided', () => {
    const from = '0xAa00000000000000000000000000000000000000';
    render(<SendTransactionBody request={makeRequest({ to: '0xabc', value: '0x0', from })} />);
    expect(screen.getByText(from)).toBeInTheDocument();
  });
});