/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));

import { BuyView } from './buy-view.js';

const ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('BuyView', () => {
  beforeEach(() => sendMock.mockReset());

  it('shows a configure notice when MoonPay is not configured', async () => {
    sendMock.mockResolvedValue(false); // MOONPAY_IS_CONFIGURED
    render(<BuyView chain="ethereum" chainName="Ethereum" address={ADDR} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/ready to enable/i)).toBeInTheDocument());
    expect(screen.getByText(/VITE_MOONPAY_API_KEY/)).toBeInTheDocument();
  });

  it('renders the asset form + quotes a buy when configured', async () => {
    sendMock.mockImplementation((m?: { type?: string }) => {
      if (m?.type === 'MOONPAY_IS_CONFIGURED') return Promise.resolve(true);
      if (m?.type === 'MOONPAY_QUOTE_BUY') return Promise.resolve({ fiatAmount: 100, cryptoAmount: 0.03, feeAmount: 4.99, totalAmount: 104.99 });
      return Promise.resolve('');
    });
    render(<BuyView chain="ethereum" chainName="Ethereum" address={ADDR} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Amount (USD)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await waitFor(() => expect(screen.getByText(/You receive/i)).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'MOONPAY_QUOTE_BUY', cryptoAsset: 'eth', fiatAmount: 100 }));
  });
});
