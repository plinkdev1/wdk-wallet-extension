/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const sendMock = vi.fn();
vi.mock('../lib/sw-client.js', () => ({ send: (m: unknown) => sendMock(m) }));

import { useUsdValue } from './use-usd-value.js';

describe('useUsdValue', () => {
  beforeEach(() => sendMock.mockReset());

  it('formats the USD value from price × base amount', async () => {
    sendMock.mockResolvedValue(2000); // $2000 / ETH
    const { result } = renderHook(() => useUsdValue('ETH', 10n ** 18n / 2n, 18)); // 0.5 ETH
    await waitFor(() => expect(result.current).toBe('$1,000.00'));
    expect(sendMock).toHaveBeenCalledWith({ type: 'PRICING_GET_USD_PRICE', symbol: 'ETH' });
  });

  it('returns null when the price is unavailable', async () => {
    sendMock.mockResolvedValue(null);
    const { result } = renderHook(() => useUsdValue('XYZ', 10n ** 18n, 18));
    await waitFor(() => expect(sendMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('returns null when the amount is null', () => {
    sendMock.mockResolvedValue(2000);
    const { result } = renderHook(() => useUsdValue('ETH', null, 18));
    expect(result.current).toBeNull();
  });
});
