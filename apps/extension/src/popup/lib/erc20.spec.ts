import { describe, it, expect } from 'vitest';
import { encodeErc20Transfer } from './erc20.js';

describe('encodeErc20Transfer', () => {
  it('encodes selector + padded recipient + padded amount', () => {
    // 1 USDt (6 decimals) = 1_000_000 base units = 0xf4240
    const data = encodeErc20Transfer('0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 1_000_000n);
    expect(data).toBe(
      '0xa9059cbb' +
        '00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8' +
        '00000000000000000000000000000000000000000000000000000000000f4240',
    );
    expect(data).toHaveLength(2 + 8 + 64 + 64);
  });

  it('lowercases the address and zero-pads a zero amount', () => {
    const data = encodeErc20Transfer('0x0000000000000000000000000000000000000001', 0n);
    expect(data.slice(10, 74)).toBe('0'.repeat(63) + '1');
    expect(data.slice(74)).toBe('0'.repeat(64));
  });

  it('rejects a malformed recipient', () => {
    expect(() => encodeErc20Transfer('nope', 1n)).toThrow(/Invalid recipient/);
  });
});
