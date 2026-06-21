/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));
vi.mock('../hooks/use-transactions.js', () => ({ addTransaction: vi.fn() }));

import { BridgeView } from './bridge-view.js';

const ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('BridgeView', () => {
  beforeEach(() => sendMock.mockReset());

  it('shows a not-wired notice on an unsupported chain', () => {
    render(<BridgeView chain={'polygon-mainnet' as never} chainName="Polygon" accountIndex={0} ownAddress={ADDR} onBack={() => {}} />);
    expect(screen.getByText(/Ethereum ⇄ Arbitrum/i)).toBeInTheDocument();
  });

  it('defaults the recipient to the user address and quotes the bridge fee', async () => {
    sendMock.mockResolvedValue({ fee: '1000000000000000' });
    render(<BridgeView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} ownAddress={ADDR} onBack={() => {}} />);
    expect((screen.getByDisplayValue(ADDR) as HTMLInputElement).value).toBe(ADDR);
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    await waitFor(() => expect(screen.getByText(/bridge fee/i)).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'USDT0_QUOTE_BRIDGE', targetChain: 'arbitrum', amount: '25000000', recipient: ADDR,
    }));
  });

  it('rejects an invalid recipient', () => {
    render(<BridgeView chain={'ethereum' as never} chainName="Ethereum" accountIndex={0} ownAddress="" onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /get quote/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid recipient/i);
    // (useGasless probes ERC4337_IS_CONFIGURED on mount; the quote itself must not fire.)
    expect(sendMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'USDT0_QUOTE_BRIDGE' }));
  });
});
