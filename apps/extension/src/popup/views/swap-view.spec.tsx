/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));
vi.mock('../hooks/use-transactions.js', () => ({ addTransaction: vi.fn() }));

import { SwapView } from './swap-view.js';

describe('SwapView', () => {
  beforeEach(() => sendMock.mockReset());

  it('shows a not-wired notice on an unsupported chain', () => {
    render(<SwapView chain={'plasma-mainnet' as never} chainName="Plasma" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByText(/wired for Ethereum/i)).toBeInTheDocument();
  });

  it('quotes a swap and shows the expected output', async () => {
    sendMock.mockResolvedValue({ fee: '0', tokenInAmount: '10000000', tokenOutAmount: '9990000' });
    render(<SwapView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await waitFor(() => expect(screen.getByText(/Expected/i)).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'VELORA_QUOTE_SWAP', tokenInAmount: '10000000' }));
  });

  it('rejects a same-token swap', () => {
    render(<SwapView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} onBack={() => {}} />);
    // Set buy = USDT (index 0) so sell(USDT) == buy(USDT)
    const usdtButtons = screen.getAllByRole('button', { name: 'USDT' });
    fireEvent.click(usdtButtons[1]!); // the "Buy" row USDT
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/different tokens/i);
    // (useGasless probes ERC4337_IS_CONFIGURED on mount; the quote itself must not fire.)
    expect(sendMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'VELORA_QUOTE_SWAP' }));
  });
});
