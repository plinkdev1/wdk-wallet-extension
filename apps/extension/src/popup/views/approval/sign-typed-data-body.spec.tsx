/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignTypedDataBody } from './sign-typed-data-body.js';
import type { ApprovalRequest } from '../../../background/approval-flow.js';

const sampleTypedData = JSON.stringify({
  types: {
    EIP712Domain: [{ name: 'name', type: 'string' }],
    Mail: [{ name: 'from', type: 'address' }, { name: 'contents', type: 'string' }],
  },
  primaryType: 'Mail',
  domain: { name: 'Ether Mail', version: '1', chainId: 1, verifyingContract: '0xCcCcccccccccccccccccccccccccccccccccccCC' },
  message: { from: '0xabc', contents: 'Hello' },
});

const baseRequest: ApprovalRequest = {
  id: 'r1',
  origin: 'https://uniswap.org',
  method: 'eth_signTypedData_v4',
  params: ['0xAa00000000000000000000000000000000000000', sampleTypedData],
  createdAt: 0,
};

describe('SignTypedDataBody', () => {
  it('renders the "Sign Typed Data" heading', () => {
    render(<SignTypedDataBody request={baseRequest} />);
    expect(screen.getByText('Sign Typed Data')).toBeInTheDocument();
  });

  it('renders the domain name, version, chainId, and verifyingContract', () => {
    render(<SignTypedDataBody request={baseRequest} />);
    expect(screen.getByText(/Ether Mail/)).toBeInTheDocument();
    expect(screen.getByText('Version:').closest('div')?.textContent ?? '').toContain('1');
    expect(screen.getByText('Chain ID:').closest('div')?.textContent ?? '').toContain('1');
    expect(screen.getByText('0xCcCcccccccccccccccccccccccccccccccccccCC')).toBeInTheDocument();
  });

  it('renders the primary type', () => {
    render(<SignTypedDataBody request={baseRequest} />);
    expect(screen.getByText('Mail')).toBeInTheDocument();
  });

  it('renders the message as formatted JSON', () => {
    render(<SignTypedDataBody request={baseRequest} />);
    // Formatted JSON contains the field names
    expect(screen.getByText(/"contents": "Hello"/)).toBeInTheDocument();
  });

  it('shows a parse error when the JSON is malformed', () => {
    const malformed: ApprovalRequest = {
      ...baseRequest,
      params: ['0xAa', '{ not valid'],
    };
    render(<SignTypedDataBody request={malformed} />);
    expect(screen.getByText(/Failed to parse typed data JSON/)).toBeInTheDocument();
  });
});