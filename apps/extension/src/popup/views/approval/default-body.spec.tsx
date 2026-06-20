/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultBody } from './default-body.js';
import type { ApprovalRequest } from '../../../background/approval-flow.js';

describe('DefaultBody', () => {
  it('renders friendly title for eth_requestAccounts', () => {
    const req: ApprovalRequest = {
      id: 'r1', origin: 'https://x', method: 'eth_requestAccounts', params: [], createdAt: 0,
    };
    render(<DefaultBody request={req} />);
    expect(screen.getByText('Connection Request')).toBeInTheDocument();
  });

  it('renders generic title for unknown methods', () => {
    const req: ApprovalRequest = {
      id: 'r1', origin: 'https://x', method: 'eth_sendTransaction', params: [], createdAt: 0,
    };
    render(<DefaultBody request={req} />);
    expect(screen.getByText(/Request: eth_sendTransaction/)).toBeInTheDocument();
  });

  it('renders the method name as code', () => {
    const req: ApprovalRequest = {
      id: 'r1', origin: 'https://x', method: 'eth_sendTransaction', params: [], createdAt: 0,
    };
    render(<DefaultBody request={req} />);
    expect(screen.getByText('eth_sendTransaction')).toBeInTheDocument();
  });

  it('renders params JSON when params are non-empty', () => {
    const req: ApprovalRequest = {
      id: 'r1', origin: 'https://x', method: 'eth_sendTransaction', params: [{ to: '0x1', value: '0x0' }], createdAt: 0,
    };
    render(<DefaultBody request={req} />);
    expect(screen.getByText(/"to": "0x1"/)).toBeInTheDocument();
  });

  it('hides params section when params are empty array', () => {
    const req: ApprovalRequest = {
      id: 'r1', origin: 'https://x', method: 'eth_requestAccounts', params: [], createdAt: 0,
    };
    render(<DefaultBody request={req} />);
    expect(screen.queryByText(/^\[/)).toBeNull();
  });
});