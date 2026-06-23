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

  it('sends native BTC (8-decimal sats) via ACCOUNT_SEND_BTC_TRANSACTION', async () => {
    sendMock.mockResolvedValue('btctxid123');
    render(<SendView chain="bitcoin-mainnet" kind="bitcoin" symbol="BTC" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByText('Send BTC')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('bc1… or legacy address'), { target: { value: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '0.001' } }); // 0.001 BTC = 100_000 sats
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('btctxid123')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_BTC_TRANSACTION',
      chain: 'bitcoin-mainnet',
      accountIndex: 0,
      to: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      value: '100000',
    }));
  });

  it('sends native TON (9-decimal nanotons) via ACCOUNT_SEND_TON_TRANSACTION', async () => {
    sendMock.mockResolvedValue('tontxhash');
    render(<SendView chain="ton-mainnet" kind="ton" symbol="TON" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByText('Send TON')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('EQ… / UQ… address'), { target: { value: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '2' } }); // 2 TON = 2_000_000_000 nanoton
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('tontxhash')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_TON_TRANSACTION',
      chain: 'ton-mainnet',
      accountIndex: 0,
      value: '2000000000',
    }));
  });

  it('sends native TRX (6-decimal sun) via ACCOUNT_SEND_TRON_TRANSACTION', async () => {
    sendMock.mockResolvedValue('trontxhash');
    render(<SendView chain="tron-mainnet" kind="tron" symbol="TRX" accountIndex={0} onBack={() => {}} />);
    expect(screen.getByText('Send TRX')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('T… address'), { target: { value: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '5' } }); // 5 TRX = 5_000_000 sun
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('trontxhash')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_TRON_TRANSACTION',
      chain: 'tron-mainnet',
      accountIndex: 0,
      to: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
      value: '5000000',
    }));
  });

  it('rejects an invalid Bitcoin address', () => {
    render(<SendView chain="bitcoin-mainnet" kind="bitcoin" symbol="BTC" accountIndex={0} onBack={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('bc1… or legacy address'), { target: { value: '0xdeadbeef' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '0.1' } });
    fireEvent.click(screen.getByText('Review & send'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid Bitcoin address/i);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends an ERC-20 token to the token contract via transfer() calldata', async () => {
    sendMock.mockResolvedValue('0xtokentx');
    render(
      <SendView
        chain="ethereum"
        kind="evm"
        symbol="USDt"
        token={{ address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 }}
        accountIndex={0}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('Send USDt')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('0x…'), { target: { value: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' } });
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '1' } }); // 1 USDt = 1_000_000 base units
    fireEvent.click(screen.getByText('Review & send'));
    await waitFor(() => expect(screen.getByText('0xtokentx')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ACCOUNT_SEND_TRANSACTION',
      chain: 'ethereum',
      to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      value: '0',
      data:
        '0xa9059cbb' +
        '00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8' +
        '00000000000000000000000000000000000000000000000000000000000f4240',
    }));
  });

  it('auto-fills recipient + amount from a pasted BIP-21 (bitcoin:) URI', () => {
    render(<SendView chain="bitcoin-mainnet" symbol="BTC" accountIndex={0} kind="bitcoin" onBack={() => {}} />);
    const recipient = screen.getByPlaceholderText('bc1… or legacy address') as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: 'bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001' } });
    expect(recipient.value).toBe('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq');
    expect((screen.getByPlaceholderText('0.0') as HTMLInputElement).value).toBe('0.001');
  });

  it('auto-fills recipient + amount from a pasted EIP-681 (ethereum:) URI', () => {
    render(<SendView chain="ethereum" symbol="ETH" accountIndex={0} kind="evm" onBack={() => {}} />);
    const recipient = screen.getByPlaceholderText('0x…') as HTMLInputElement;
    fireEvent.change(recipient, { target: { value: 'ethereum:0x70997970C51812dc3A010C7d01b50e0d17dc79C8@1?value=1000000000000000000' } });
    expect(recipient.value).toBe('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    expect((screen.getByPlaceholderText('0.0') as HTMLInputElement).value).toBe('1');
  });
});
