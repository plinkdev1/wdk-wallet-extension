/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (msg: unknown) => sendMock(msg) }));

import { SparkView } from './spark-view.js';

/**
 * Resolve the mocked SW by message type (mount fires GET_ADDRESS → GET_BALANCE,
 * then per-action calls). Unrecognized calls resolve to undefined rather than
 * reject, so a late balance refresh after a test asserts doesn't surface as an
 * unhandled rejection.
 */
function routeByType(overrides: Record<string, unknown> = {}): void {
  const table: Record<string, unknown> = {
    SPARK_GET_ADDRESS: 'spark1qexampleaddress',
    SPARK_GET_BALANCE: '4200',
    SPARK_GET_DEPOSIT_ADDRESS: 'bc1qdepositexample',
    SPARK_SEND: 'sparktxhash',
    LIGHTNING_CREATE_INVOICE: 'lnbc100n1exampleinvoice',
    ...overrides,
  };
  sendMock.mockImplementation((msg: { type?: string } | undefined) => {
    const type = msg?.type;
    return Promise.resolve(type && type in table ? table[type] : undefined);
  });
}

describe('SparkView', () => {
  beforeEach(() => sendMock.mockReset());

  it('connects on mount and shows the Spark address + balance', async () => {
    routeByType();
    render(<SparkView accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('spark1qexampleaddress')).toBeInTheDocument());
    expect(screen.getByText('4200 sats')).toBeInTheDocument();
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'SPARK_GET_ADDRESS', accountIndex: 0 }));
  });

  it('surfaces a connect error (e.g. MV3 dynamic-import restriction)', async () => {
    sendMock.mockImplementation((msg: { type?: string } | undefined) =>
      msg?.type === 'SPARK_GET_ADDRESS'
        ? Promise.reject(new Error('Spark SDK could not be loaded (F-MV3-04)'))
        : Promise.resolve(undefined),
    );
    render(<SparkView accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i));
  });

  it('switches to the Lightning tab and creates an invoice', async () => {
    routeByType();
    render(<SparkView accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('spark1qexampleaddress')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Lightning'));
    fireEvent.change(screen.getByPlaceholderText('Amount (sats)'), { target: { value: '100' } });
    fireEvent.click(screen.getByText('Create invoice'));

    await waitFor(() => expect(screen.getByText('lnbc100n1exampleinvoice')).toBeInTheDocument());
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'LIGHTNING_CREATE_INVOICE', accountIndex: 0, amountSats: 100 }));
  });

  it('rejects an invalid Spark recipient without messaging the SW', async () => {
    routeByType();
    render(<SparkView accountIndex={0} onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('spark1qexampleaddress')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Send'));
    fireEvent.change(screen.getByPlaceholderText('Recipient Spark address (spark1…)'), { target: { value: 'not-spark' } });
    fireEvent.change(screen.getByPlaceholderText('Amount (sats)'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Send sats'));

    expect(screen.getByRole('alert')).toHaveTextContent(/valid Spark address/i);
    expect(sendMock).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SPARK_SEND' }));
  });
});
