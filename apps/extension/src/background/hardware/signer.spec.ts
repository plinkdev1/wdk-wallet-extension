import { describe, it, expect, vi } from 'vitest';
import {
  HardwareSignerRegistry, routeSignMessage, routeSignTypedData, routeSignTransaction,
  type HardwareSigner,
} from './signer.js';

const fakeSigner = (id: string): HardwareSigner => ({
  id,
  getAddress: vi.fn(async () => '0xDEVICE'),
  signMessage: vi.fn(async () => '0xsig-msg'),
  signTypedData: vi.fn(async () => '0xsig-td'),
  signTransaction: vi.fn(async () => '0xsig-tx'),
});

describe('HardwareSignerRegistry', () => {
  it('registers, looks up, and unregisters a hardware account', () => {
    const reg = new HardwareSignerRegistry();
    expect(reg.isHardware('ethereum', 0)).toBe(false);
    const signer = fakeSigner('ledger-nano-x');
    reg.register('ethereum', 0, signer);
    expect(reg.isHardware('ethereum', 0)).toBe(true);
    expect(reg.get('ethereum', 0)).toBe(signer);
    expect(reg.get('ethereum', 1)).toBeNull();
    expect(reg.unregister('ethereum', 0)).toBe(true);
    expect(reg.isHardware('ethereum', 0)).toBe(false);
  });

  it('lists hardware-backed accounts', () => {
    const reg = new HardwareSignerRegistry();
    reg.register('ethereum', 0, fakeSigner('ledger'));
    reg.register('polygon-mainnet', 3, fakeSigner('trezor'));
    expect(reg.list()).toEqual([
      { chain: 'ethereum', index: 0, signerId: 'ledger' },
      { chain: 'polygon-mainnet', index: 3, signerId: 'trezor' },
    ]);
  });
});

describe('routeSign*', () => {
  it('routes to the device when the account is hardware-backed', async () => {
    const reg = new HardwareSignerRegistry();
    const signer = fakeSigner('ledger');
    reg.register('ethereum', 0, signer);
    const seed = vi.fn(async () => '0xseed');

    expect(await routeSignMessage(reg, 'ethereum', 0, 'hi', seed)).toBe('0xsig-msg');
    expect(await routeSignTypedData(reg, 'ethereum', 0, { domain: {}, types: {}, message: {} }, seed)).toBe('0xsig-td');
    expect(await routeSignTransaction(reg, 'ethereum', 0, { to: '0x1' }, seed)).toBe('0xsig-tx');
    expect(seed).not.toHaveBeenCalled();
    expect(signer.signMessage).toHaveBeenCalledWith('ethereum', 0, 'hi');
  });

  it('falls back to the seed signer for normal accounts', async () => {
    const reg = new HardwareSignerRegistry();
    const seed = vi.fn(async () => '0xseed');
    expect(await routeSignMessage(reg, 'ethereum', 1, 'hi', seed)).toBe('0xseed');
    expect(seed).toHaveBeenCalledOnce();
  });
});
