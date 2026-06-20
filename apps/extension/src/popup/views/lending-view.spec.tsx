/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));
vi.mock('../hooks/use-transactions.js', () => ({ addTransaction: vi.fn() }));

import { LendingView } from './lending-view.js';

const ACCOUNT_DATA = {
  totalCollateralBase: '100000000', totalDebtBase: '0', availableBorrowsBase: '0',
  currentLiquidationThreshold: '0', ltv: '0', healthFactor: '0',
};

describe('LendingView', () => {
  beforeEach(() => { sendMock.mockReset(); sendMock.mockResolvedValue(ACCOUNT_DATA); });

  it('shows a not-deployed notice on a non-Aave chain', () => {
    render(<LendingView chain={'plasma-mainnet' as never} chainName="Plasma" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByText(/isn.t deployed/i)).toBeInTheDocument();
  });

  it('loads the position and renders the action form on a supported chain', async () => {
    render(<LendingView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'AAVE_GET_ACCOUNT_DATA', chain: 'ethereum' })));
    expect(screen.getByText('Collateral')).toBeInTheDocument();
    expect(screen.getByText('Health factor')).toBeInTheDocument();
  });

  it('rejects an empty amount without dispatching a supply', async () => {
    render(<LendingView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Collateral')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /supply USDT/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(sendMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'AAVE_SUPPLY' }));
  });

  it('dispatches a supply with base-unit amount (6 decimals) and shows the hash', async () => {
    render(<LendingView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Collateral')).toBeInTheDocument());
    sendMock.mockImplementation((m?: { type?: string }) =>
      m?.type === 'AAVE_SUPPLY' ? Promise.resolve({ hash: '0xfeed', fee: '0' }) : Promise.resolve(ACCOUNT_DATA));
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /supply USDT/i }));
    await waitFor(() => expect(screen.getByText('0xfeed')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'AAVE_SUPPLY', amount: '10000000' }));
  });
});
