import { describe, it, expect } from 'vitest';
import { ApprovalFlow, createApprovalFlow, type ApprovalRequest } from './approval-flow.js';

describe('ApprovalFlow', () => {
  it('open() returns a Promise that stays pending until respond()', async () => {
    const flow = new ApprovalFlow();
    const promise = flow.open({ id: 'r1', origin: 'https://x', method: 'eth_chainId' });
    // Race against a short delay to verify the Promise hasn't resolved.
    const result = await Promise.race([
      promise.then((v) => ({ resolved: true, value: v })),
      new Promise((r) => setTimeout(() => r({ resolved: false }), 10)),
    ]);
    expect(result).toEqual({ resolved: false });

    // Now respond and verify resolution
    flow.respond('r1', { approved: true });
    await expect(promise).resolves.toEqual({ approved: true });
  });

  it('open() throws synchronously on empty id', () => {
    const flow = new ApprovalFlow();
    expect(() => flow.open({ id: '', origin: 'x', method: 'eth_chainId' })).toThrow(/non-empty/);
  });

  it('open() throws synchronously on duplicate id', () => {
    const flow = new ApprovalFlow();
    flow.open({ id: 'r1', origin: 'x', method: 'eth_chainId' });
    expect(() =>
      flow.open({ id: 'r1', origin: 'x', method: 'eth_accounts' })
    ).toThrow(/already pending/);
  });

  it('respond() returns false for unknown id and does not throw', () => {
    const flow = new ApprovalFlow();
    expect(flow.respond('bogus', { approved: true })).toBe(false);
  });

  it('respond() returns true and passes decision data through unchanged', async () => {
    const flow = new ApprovalFlow();
    const promise = flow.open({ id: 'r1', origin: 'x', method: 'eth_requestAccounts' });
    const ok = flow.respond('r1', { approved: true, data: ['0xabc', '0xdef'] });
    expect(ok).toBe(true);
    await expect(promise).resolves.toEqual({ approved: true, data: ['0xabc', '0xdef'] });
  });

  it('cancel() rejects the open() Promise with the given reason', async () => {
    const flow = new ApprovalFlow();
    const promise = flow.open({ id: 'r1', origin: 'x', method: 'personal_sign' });
    const ok = flow.cancel('r1', 'Popup closed');
    expect(ok).toBe(true);
    await expect(promise).rejects.toThrow('Popup closed');
  });

  it('cancel() returns false for unknown id', () => {
    const flow = new ApprovalFlow();
    expect(flow.cancel('bogus')).toBe(false);
  });

  it('cancelAll() rejects every pending Promise', async () => {
    const flow = new ApprovalFlow();
    const p1 = flow.open({ id: 'r1', origin: 'x', method: 'eth_chainId' });
    const p2 = flow.open({ id: 'r2', origin: 'y', method: 'eth_accounts' });
    flow.cancelAll('SW reset');
    await expect(p1).rejects.toThrow('SW reset');
    await expect(p2).rejects.toThrow('SW reset');
    expect(flow.listPending()).toEqual([]);
  });

  it('getPending() returns the stored request shape (with createdAt set)', () => {
    const flow = new ApprovalFlow();
    flow.open({ id: 'r1', origin: 'https://uniswap.org', method: 'eth_sendTransaction', params: [{ to: '0x1' }] });
    const pending = flow.getPending('r1') as ApprovalRequest;
    expect(pending).not.toBeNull();
    expect(pending.id).toBe('r1');
    expect(pending.origin).toBe('https://uniswap.org');
    expect(pending.method).toBe('eth_sendTransaction');
    expect(pending.params).toEqual([{ to: '0x1' }]);
    expect(typeof pending.createdAt).toBe('number');
    expect(pending.createdAt).toBeGreaterThan(0);
  });

  it('getPending() returns null for unknown id', () => {
    const flow = new ApprovalFlow();
    expect(flow.getPending('bogus')).toBeNull();
  });

  it('listPending() returns all current ids in insertion order', () => {
    const flow = new ApprovalFlow();
    flow.open({ id: 'r1', origin: 'a', method: 'eth_chainId' });
    flow.open({ id: 'r2', origin: 'b', method: 'eth_accounts' });
    flow.open({ id: 'r3', origin: 'c', method: 'personal_sign' });
    expect(flow.listPending()).toEqual(['r1', 'r2', 'r3']);

    flow.respond('r2', { approved: false });
    expect(flow.listPending()).toEqual(['r1', 'r3']);
  });

  it('respond() with approved=false also resolves (decision is approved:false, not rejection)', async () => {
    const flow = new ApprovalFlow();
    const promise = flow.open({ id: 'r1', origin: 'x', method: 'eth_chainId' });
    flow.respond('r1', { approved: false });
    await expect(promise).resolves.toEqual({ approved: false });
  });

  it('createApprovalFlow() returns a fresh ApprovalFlow instance', () => {
    const a = createApprovalFlow();
    const b = createApprovalFlow();
    expect(a).toBeInstanceOf(ApprovalFlow);
    expect(b).toBeInstanceOf(ApprovalFlow);
    expect(a).not.toBe(b);
  });
});