/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../hooks/use-transactions.js', () => ({ useTransactions: () => ({ transactions: [] }) }));
vi.mock('../hooks/use-transaction-statuses.js', () => ({ useTransactionStatuses: () => ({}) }));
vi.mock('../hooks/use-usd-value.js', () => ({ useUsdValue: () => '$125.00' }));

import { AssetDetailView } from './asset-detail-view.js';

const TOKEN = { symbol: 'USDt', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 };

describe('AssetDetailView', () => {
  it('shows the USD value and Send / Receive actions', () => {
    render(<AssetDetailView token={TOKEN} chain="ethereum" chainName="Ethereum" balance={125000000n} onSend={() => {}} onReceive={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/\$125\.00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receive' })).toBeInTheDocument();
  });

  it('shows the empty-activity hint when no tx matches the asset', () => {
    render(<AssetDetailView token={TOKEN} chain="ethereum" chainName="Ethereum" balance={125000000n} onSend={() => {}} onReceive={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/No USDt transactions yet/)).toBeInTheDocument();
  });

  it('fires onBack from the back button', () => {
    const onBack = vi.fn();
    render(<AssetDetailView token={TOKEN} chain="ethereum" chainName="Ethereum" balance={null} onSend={() => {}} onReceive={() => {}} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
