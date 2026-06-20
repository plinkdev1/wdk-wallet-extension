/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));

import { SendView } from './send-view.js';

describe('SendView', () => {
  beforeEach(() => sendMock.mockReset());

  it('renders recipient and amount inputs', () => {
    render(<SendView chain="ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByPlaceholderText('0x…')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
  });

  it('rejects an invalid recipient without calling the worker', () => {
    render(<SendView chain="ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: 'nope' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Review & send'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid recipient/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends a valid transfer (18-decimal base units) and shows the tx hash', async () => {
    sendMock.mockResolvedValue('0xabc123');
    render(<SendView chain="ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('0xabc123')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_TRANSACTION',
      chain: 'ethereum',
      accountIndex: 0,
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: '500000000000000000',
    }));
  });

  it('renders a base58 placeholder in Solana mode', () => {
    render(<SendView chain="solana-mainnet" kind="solana" symbol="SOL" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByPlaceholderText('Base58 address')).toBeInTheDocument();
    expect(screen.getByText('Send SOL')).toBeInTheDocument();
  });

  it('rejects an invalid Solana address without calling the worker', () => {
    render(<SendView chain="solana-mainnet" kind="solana" symbol="SOL" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Base58 address'), { target: { value: 'not-valid' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Review & send'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid Solana address/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends native SOL (9-decimal lamports) via ACCOUNT_SEND_SOLANA_TRANSACTION', async () => {
    sendMock.mockResolvedValue('soLsig123');
    render(<SendView chain="solana-mainnet" kind="solana" symbol="SOL" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Base58 address'), { target: { value: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('soLsig123')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_SOLANA_TRANSACTION',
      chain: 'solana-mainnet',
      accountIndex: 0,
      to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
      value: '1500000000',
    }));
  });
});
