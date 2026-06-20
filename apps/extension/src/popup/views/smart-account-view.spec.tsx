/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));
vi.mock('../hooks/use-transactions.js', () => ({ addTransaction: vi.fn() }));

import { SmartAccountView } from './smart-account-view.js';

const SMART_ADDR = '0x636e9c21f27d9401ac180666bf8DC0D3FcEb0D24';

describe('SmartAccountView', () => {
  beforeEach(() => sendMock.mockReset());

  it('shows a configure notice when no bundler is set', async () => {
    sendMock.mockImplementation((m?: { type?: string }) => Promise.resolve(m?.type === 'ERC4337_IS_CONFIGURED' ? false : ''));
    render(<SmartAccountView chain={'ethereum' as never} chainName="Ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/ready to enable/i)).toBeInTheDocument());
    expect(screen.getByText(/VITE_BUNDLER_URL/)).toBeInTheDocument();
  });

  it('renders the smart-account address + balance when configured', async () => {
    sendMock.mockImplementation((m?: { type?: string }) => {
      switch (m?.type) {
        case 'ERC4337_IS_CONFIGURED': return Promise.resolve(true);
        case 'ERC4337_GET_ADDRESS': return Promise.resolve(SMART_ADDR);
        case 'ERC4337_GET_BALANCE': return Promise.resolve('1000000000000000000');
        default: return Promise.resolve('');
      }
    });
    render(<SmartAccountView chain={'ethereum' as never} chainName="Ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/0x636e/)).toBeInTheDocument());
    expect(screen.getByText(/1 ETH/)).toBeInTheDocument();
    expect(screen.getByText('Send gasless')).toBeInTheDocument();
  });

  it('sends a gasless UserOperation and shows the hash', async () => {
    sendMock.mockImplementation((m?: { type?: string }) => {
      switch (m?.type) {
        case 'ERC4337_IS_CONFIGURED': return Promise.resolve(true);
        case 'ERC4337_GET_ADDRESS': return Promise.resolve(SMART_ADDR);
        case 'ERC4337_GET_BALANCE': return Promise.resolve('0');
        case 'ERC4337_SEND': return Promise.resolve({ hash: '0xop123', fee: '0' });
        default: return Promise.resolve('');
      }
    });
    render(<SmartAccountView chain={'ethereum' as never} chainName="Ethereum" symbol="ETH" accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Send gasless')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '0.1' } });
    fireEvent.click(screen.getByText('Send gasless'));
    await waitFor(() => expect(screen.getByText('0xop123')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERC4337_SEND', value: '100000000000000000' }));
  });
});
