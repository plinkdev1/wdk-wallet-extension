/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityView } from './activity-view.js';
import { addTransaction } from '../hooks/use-transactions.js';

describe('ActivityView', () => {
  beforeEach(() => localStorage.clear());

  it('shows the empty state with no history', () => {
    render(<ActivityView onBack={() => {}} />);
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
  });

  it('lists a recorded transaction with a formatted amount and explorer link', () => {
    addTransaction({ hash: '0xdeadbeef', chain: 'ethereum', to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', value: '500000000000000000', symbol: 'ETH', decimals: 18, ts: Date.now() });
    render(<ActivityView onBack={() => {}} chainName={() => 'Ethereum'} />);
    expect(screen.getByText(/Sent to 0x7099/)).toBeInTheDocument();
    expect(screen.getByText(/0\.5 ETH/)).toBeInTheDocument();
    const link = screen.getByText('view ↗');
    expect(link.getAttribute('href')).toContain('etherscan.io/tx/0xdeadbeef');
  });

  it('calls onBack from the back control', () => {
    const onBack = vi.fn();
    render(<ActivityView onBack={onBack} />);
    screen.getByLabelText('Back').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
