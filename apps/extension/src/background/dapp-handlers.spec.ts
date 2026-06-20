/**
 * dapp-handlers tests (B4.8 update).
 */

import { describe, it, expect, vi } from 'vitest';
import { createDappHandlers } from './dapp-handlers.js';
import { createApprovalFlow } from './approval-flow.js';
import { createEngine } from './engine.js';
import type { WalletWorker } from '@wdk-starter/wdk-web-core/worker';
import type { ConnectionState } from './connection-state.js';

function createMockWorker(): WalletWorker {
  return {
    account_getEvmAddress: vi.fn(async (_chain: string, idx: number) => {
      return `0xAa${idx.toString(16).padStart(38, '0')}` as `0x${string}`;
    }),
    account_signMessage: vi.fn(async (_chain: string, idx: number, message: string) => {
      return `0xsig-msg-${idx}-${message.length}` as `0x${string}`;
    }),
    account_signTypedData: vi.fn(async (_chain: string, idx: number, data: unknown) => {
      const repr = typeof data === 'object' && data !== null ? JSON.stringify(data).length.toString() : 'na';
      return `0xsig-typed-${idx}-${repr}` as `0x${string}`;
    }),
    account_sendTransaction: vi.fn(async (_chain: string, idx: number, _tx: Record<string, unknown>) => {
      return `0xtxhash${idx.toString().padStart(58, '0')}` as `0x${string}`;
    }),
  } as unknown as WalletWorker;
}

function createMockConnectionState(): ConnectionState {
  return {
    load: vi.fn(async () => undefined),
    isConnected: vi.fn(() => false),
    getApprovedAccounts: vi.fn(() => []),
    getApprovedChains: vi.fn(() => []),
    approve: vi.fn(async () => ({ origin: '', chains: [], accountIndices: [], approvedAt: 0 })),
    revoke: vi.fn(async () => false),
    revokeAll: vi.fn(async () => undefined),
    list: vi.fn(() => []),
  } as unknown as ConnectionState;
}

const ACCOUNT_0_ADDR = '0xAa00000000000000000000000000000000000000';

describe('createDappHandlers - eth_chainId', () => {
  it('returns 0x1 (mainnet) for unconnected origin', async () => {
    const handlers = createDappHandlers({
      engine: createEngine(), worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: createMockConnectionState(),
    });
    expect(await handlers.eth_chainId!({ method: 'eth_chainId' }, { origin: 'https://x' })).toBe('0x1');
  });

  it('returns connected origin chain id in hex', async () => {
    const cs = createMockConnectionState();
    vi.mocked(cs.getApprovedChains).mockReturnValue(['polygon-mainnet']);
    const handlers = createDappHandlers({
      engine: createEngine(), worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: cs,
    });
    expect(await handlers.eth_chainId!({ method: 'eth_chainId' }, { origin: 'https://x' })).toBe('0x89');
  });
});

describe('createDappHandlers - eth_accounts', () => {
  it('returns [] when origin is not connected', async () => {
    const handlers = createDappHandlers({
      engine: createEngine(), worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: createMockConnectionState(),
    });
    expect(await handlers.eth_accounts!({ method: 'eth_accounts' }, { origin: 'https://x' })).toEqual([]);
  });

  it('returns derived addresses for connected origin', async () => {
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0, 1]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    const handlers = createDappHandlers({
      engine: createEngine(), worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: cs,
    });
    expect(await handlers.eth_accounts!({ method: 'eth_accounts' }, { origin: 'https://x' })).toEqual([
      '0xAa00000000000000000000000000000000000000',
      '0xAa00000000000000000000000000000000000001',
    ]);
  });
});

describe('createDappHandlers - eth_requestAccounts', () => {
  it('returns existing accounts immediately when already connected', async () => {
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    const flow = createApprovalFlow();
    const openSpy = vi.spyOn(flow, 'open');
    const handlers = createDappHandlers({
      engine: createEngine(), worker: createMockWorker(), approvalFlow: flow, connectionState: cs,
    });
    const result = await handlers.eth_requestAccounts!({ method: 'eth_requestAccounts' }, { origin: 'https://x' });
    expect(result).toEqual([ACCOUNT_0_ADDR]);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('throws -32603 when not connected and engine is locked', async () => {
    const engine = createEngine();
    expect(engine.getLockState()).toBe('locked');
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: createMockConnectionState(),
    });
    await expect(
      handlers.eth_requestAccounts!({ method: 'eth_requestAccounts' }, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32603 });
  });

  it('opens approval flow when not connected and engine is unlocked', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const flow = createApprovalFlow();
    const openSpy = vi.spyOn(flow, 'open');
    const cs = createMockConnectionState();
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: flow, connectionState: cs,
    });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const result = await handlers.eth_requestAccounts!(
      { method: 'eth_requestAccounts' },
      { origin: 'https://x', id: 'req-test-1' },
    );
    expect(openSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'req-test-1', origin: 'https://x', method: 'eth_requestAccounts' }),
    );
    expect(cs.approve).toHaveBeenCalledWith('https://x', ['ethereum'], [0]);
    expect(result).toEqual([ACCOUNT_0_ADDR]);
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const flow = createApprovalFlow();
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: flow, connectionState: createMockConnectionState(),
    });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.eth_requestAccounts!({ method: 'eth_requestAccounts' }, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('uses decision.data account indices when provided', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const flow = createApprovalFlow();
    const cs = createMockConnectionState();
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: flow, connectionState: cs,
    });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true, data: [0, 1, 2] });
    }, 5);
    const result = await handlers.eth_requestAccounts!({ method: 'eth_requestAccounts' }, { origin: 'https://x' });
    expect(cs.approve).toHaveBeenCalledWith('https://x', ['ethereum'], [0, 1, 2]);
    expect(result).toHaveLength(3);
  });

  it('falls back to [0] when decision.data is not numeric array', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const flow = createApprovalFlow();
    const cs = createMockConnectionState();
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: flow, connectionState: cs,
    });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true, data: 'garbage' });
    }, 5);
    const result = await handlers.eth_requestAccounts!({ method: 'eth_requestAccounts' }, { origin: 'https://x' });
    expect(cs.approve).toHaveBeenCalledWith('https://x', ['ethereum'], [0]);
    expect(result).toEqual([ACCOUNT_0_ADDR]);
  });
});

describe('createDappHandlers - personal_sign', () => {
  function setupConnected() {
    const engine = createEngine();
    void engine.unlock('test-password');
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    return { engine, cs, flow: createApprovalFlow(), worker: createMockWorker() };
  }

  it('throws -32602 on missing/malformed params', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.personal_sign!({ method: 'personal_sign' } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws 4100 when dApp is not connected', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: createMockConnectionState(),
    });
    await expect(
      handlers.personal_sign!(
        { method: 'personal_sign', params: ['0x68', ACCOUNT_0_ADDR] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4100, message: expect.stringContaining('Unauthorized') });
  });

  it('throws -32603 when wallet is locked', async () => {
    const engine = createEngine();
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: createApprovalFlow(), connectionState: cs,
    });
    await expect(
      handlers.personal_sign!(
        { method: 'personal_sign', params: ['0x68', ACCOUNT_0_ADDR] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32603 });
  });

  it('throws -32602 when address is not authorized for origin', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.personal_sign!(
        { method: 'personal_sign', params: ['0x68', '0xdeadbeef00000000000000000000000000000000'] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('decodes hex to UTF-8 and calls worker.account_signMessage on approval', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const messageHex = '0x48656c6c6f2c20576f726c6421';
    const result = await handlers.personal_sign!(
      { method: 'personal_sign', params: [messageHex, ACCOUNT_0_ADDR] } as never,
      { origin: 'https://x' },
    );
    expect(worker.account_signMessage).toHaveBeenCalledWith('ethereum', 0, 'Hello, World!');
    expect(result).toBe('0xsig-msg-0-13');
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.personal_sign!(
        { method: 'personal_sign', params: ['0x68', ACCOUNT_0_ADDR] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('case-insensitive address match', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    await expect(
      handlers.personal_sign!(
        { method: 'personal_sign', params: ['0x68', ACCOUNT_0_ADDR.toLowerCase()] } as never,
        { origin: 'https://x' },
      ),
    ).resolves.toBeDefined();
  });
});

describe('createDappHandlers - eth_signTypedData_v4', () => {
  function setupConnected() {
    const engine = createEngine();
    void engine.unlock('test-password');
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    return { engine, cs, flow: createApprovalFlow(), worker: createMockWorker() };
  }

  const sampleTypedData = JSON.stringify({
    types: { EIP712Domain: [{ name: 'name', type: 'string' }], Mail: [{ name: 'from', type: 'address' }] },
    primaryType: 'Mail',
    domain: { name: 'Ether Mail', version: '1', chainId: 1 },
    message: { from: '0x1' },
  });

  it('throws -32602 on missing/malformed params', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.eth_signTypedData_v4!({ method: 'eth_signTypedData_v4' } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws -32602 on invalid JSON', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.eth_signTypedData_v4!(
        { method: 'eth_signTypedData_v4', params: [ACCOUNT_0_ADDR, '{bad json'] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('Invalid typed data JSON') });
  });

  it('parses typed data and calls worker.account_signTypedData on approval', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const result = await handlers.eth_signTypedData_v4!(
      { method: 'eth_signTypedData_v4', params: [ACCOUNT_0_ADDR, sampleTypedData] } as never,
      { origin: 'https://x' },
    );
    expect(worker.account_signTypedData).toHaveBeenCalledWith(
      'ethereum', 0, expect.objectContaining({ primaryType: 'Mail' }),
    );
    expect(result).toMatch(/^0xsig-typed-0/);
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.eth_signTypedData_v4!(
        { method: 'eth_signTypedData_v4', params: [ACCOUNT_0_ADDR, sampleTypedData] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4001 });
  });
});

// ============================================================================
// B4.8 NEW: eth_sendTransaction
// ============================================================================
describe('createDappHandlers - eth_sendTransaction', () => {
  function setupConnected() {
    const engine = createEngine();
    void engine.unlock('test-password');
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    return { engine, cs, flow: createApprovalFlow(), worker: createMockWorker() };
  }

  it('throws -32602 on missing/malformed params', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.eth_sendTransaction!({ method: 'eth_sendTransaction' } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws 4100 when not connected', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(),
      approvalFlow: createApprovalFlow(), connectionState: createMockConnectionState(),
    });
    await expect(
      handlers.eth_sendTransaction!(
        { method: 'eth_sendTransaction', params: [{ to: '0x1', value: '0x0' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4100 });
  });

  it('throws -32603 when wallet is locked', async () => {
    const engine = createEngine();
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(), approvalFlow: createApprovalFlow(), connectionState: cs,
    });
    await expect(
      handlers.eth_sendTransaction!(
        { method: 'eth_sendTransaction', params: [{ to: '0x1', value: '0x0' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32603 });
  });

  it('throws -32602 when from is provided but not authorized', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.eth_sendTransaction!(
        { method: 'eth_sendTransaction', params: [{ from: '0xdead', to: '0x1', value: '0x0' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('not authorized') });
  });

  it('defaults to first approved account when from is omitted', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const tx = { to: '0xff00000000000000000000000000000000000000', value: '0x0' };
    const result = await handlers.eth_sendTransaction!(
      { method: 'eth_sendTransaction', params: [tx] } as never,
      { origin: 'https://x', id: 'req-tx-1' },
    );
    expect(worker.account_sendTransaction).toHaveBeenCalledWith('ethereum', 0, tx);
    expect(result).toMatch(/^0xtxhash/);
  });

  it('uses from address account when provided and authorized', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const tx = { from: ACCOUNT_0_ADDR, to: '0xff00000000000000000000000000000000000000', value: '0x0' };
    await handlers.eth_sendTransaction!(
      { method: 'eth_sendTransaction', params: [tx] } as never,
      { origin: 'https://x' },
    );
    expect(worker.account_sendTransaction).toHaveBeenCalledWith('ethereum', 0, tx);
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.eth_sendTransaction!(
        { method: 'eth_sendTransaction', params: [{ to: '0x1', value: '0x0' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('maps worker errors to -32603 with descriptive message', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    vi.mocked(worker.account_sendTransaction).mockRejectedValueOnce(new Error('insufficient funds for gas'));
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    await expect(
      handlers.eth_sendTransaction!(
        { method: 'eth_sendTransaction', params: [{ to: '0x1', value: '0x0' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32603, message: expect.stringContaining('insufficient funds') });
  });
});

// ============================================================================
// B4.9b NEW: wallet_switchEthereumChain
// ============================================================================
describe('createDappHandlers - wallet_switchEthereumChain', () => {
  function setupConnected() {
    const engine = createEngine();
    void engine.unlock('test-password');
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    const eventBus = { broadcast: vi.fn(async () => undefined) };
    return { engine, cs, flow: createApprovalFlow(), worker: createMockWorker(), eventBus };
  }

  it('throws -32602 on missing/malformed params', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    await expect(
      handlers.wallet_switchEthereumChain!({ method: 'wallet_switchEthereumChain' } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
    await expect(
      handlers.wallet_switchEthereumChain!({ method: 'wallet_switchEthereumChain', params: [{}] } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws 4100 when dApp is not connected', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const eventBus = { broadcast: vi.fn(async () => undefined) };
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(),
      approvalFlow: createApprovalFlow(),
      connectionState: createMockConnectionState(),
      eventBus,
    });
    await expect(
      handlers.wallet_switchEthereumChain!(
        { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4100 });
  });

  it('throws 4902 for unrecognized chain ID (per EIP-3326)', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    await expect(
      handlers.wallet_switchEthereumChain!(
        { method: 'wallet_switchEthereumChain', params: [{ chainId: '0xffff' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4902, message: expect.stringContaining('wallet_addEthereumChain') });
  });

  it('returns null without firing event when already on the requested chain (idempotent)', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    vi.mocked(cs.getApprovedChains).mockReturnValue(['polygon-mainnet']);
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    const result = await handlers.wallet_switchEthereumChain!(
      { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] } as never,
      { origin: 'https://x' },
    );
    expect(result).toBeNull();
    expect(eventBus.broadcast).not.toHaveBeenCalled();
    expect(cs.approve).not.toHaveBeenCalled();
  });

  it('opens approval flow with method=wallet_switchEthereumChain', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const openSpy = vi.spyOn(flow, 'open');
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    await handlers.wallet_switchEthereumChain!(
      { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] } as never,
      { origin: 'https://x' },
    );
    expect(openSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_switchEthereumChain', origin: 'https://x' }),
    );
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.wallet_switchEthereumChain!(
        { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('on approval: updates connectionState, broadcasts chainChanged, returns null', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const result = await handlers.wallet_switchEthereumChain!(
      { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] } as never,
      { origin: 'https://x' },
    );
    expect(result).toBeNull();
    expect(cs.approve).toHaveBeenCalledWith('https://x', ['polygon-mainnet'], [0]);
    expect(eventBus.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'wdk-dapp-event',
        event: 'chainChanged',
        data: '0x89',
      }),
      'https://x',
    );
  });

  it('case-insensitive chainId hex match (0X89 == 0x89)', async () => {
    const { engine, cs, flow, worker, eventBus } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs, eventBus });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const result = await handlers.wallet_switchEthereumChain!(
      { method: 'wallet_switchEthereumChain', params: [{ chainId: '0X89' }] } as never,
      { origin: 'https://x' },
    );
    expect(result).toBeNull();
  });
});

// ============================================================================
// B4.9c NEW: wallet_addEthereumChain
// ============================================================================
describe('createDappHandlers - wallet_addEthereumChain', () => {
  const validPayload = {
    chainId: '0x144',  // zkSync Era mainnet, not in our 7 built-ins
    chainName: 'zkSync Era',
    rpcUrls: ['https://mainnet.era.zksync.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://explorer.zksync.io'],
  };

  function setupConnected() {
    const engine = createEngine();
    void engine.unlock('test-password');
    const cs = createMockConnectionState();
    vi.mocked(cs.isConnected).mockReturnValue(true);
    vi.mocked(cs.getApprovedAccounts).mockReturnValue([0]);
    vi.mocked(cs.getApprovedChains).mockReturnValue(['ethereum']);
    return { engine, cs, flow: createApprovalFlow(), worker: createMockWorker() };
  }

  it('throws -32602 when params is missing', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.wallet_addEthereumChain!({ method: 'wallet_addEthereumChain' } as never, { origin: 'https://x' }),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws -32602 when payload is not an object', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: ['not-an-object'] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602 });
  });

  it('throws -32602 when chainId is missing or not hex', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [{ ...validPayload, chainId: 'not-hex' }] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('chainId') });
  });

  it('throws -32602 when chainName is missing', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    const bad = { ...validPayload, chainName: '' };
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [bad] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('chainName') });
  });

  it('throws -32602 when rpcUrls is empty', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    const bad = { ...validPayload, rpcUrls: [] };
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [bad] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('rpcUrls') });
  });

  it('throws -32602 when nativeCurrency is missing decimals', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    const bad = { ...validPayload, nativeCurrency: { name: 'Ether', symbol: 'ETH' } };
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [bad] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('nativeCurrency') });
  });

  it('throws 4100 when dApp is not connected', async () => {
    const engine = createEngine();
    await engine.unlock('test-password');
    const handlers = createDappHandlers({
      engine, worker: createMockWorker(),
      approvalFlow: createApprovalFlow(),
      connectionState: createMockConnectionState(),
    });
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [validPayload] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4100 });
  });

  it('opens approval flow with method=wallet_addEthereumChain', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const openSpy = vi.spyOn(flow, 'open');
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    await handlers.wallet_addEthereumChain!(
      { method: 'wallet_addEthereumChain', params: [validPayload] } as never,
      { origin: 'https://x' },
    );
    expect(openSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'wallet_addEthereumChain', origin: 'https://x' }),
    );
  });

  it('throws { code: 4001 } when user rejects', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: false });
    }, 5);
    await expect(
      handlers.wallet_addEthereumChain!(
        { method: 'wallet_addEthereumChain', params: [validPayload] } as never,
        { origin: 'https://x' },
      ),
    ).rejects.toMatchObject({ code: 4001 });
  });

  it('returns null on approval (v0.1: chain not actually registered)', async () => {
    const { engine, cs, flow, worker } = setupConnected();
    const handlers = createDappHandlers({ engine, worker, approvalFlow: flow, connectionState: cs });
    setTimeout(() => {
      const ids = flow.listPending();
      if (ids[0]) flow.respond(ids[0], { approved: true });
    }, 5);
    const result = await handlers.wallet_addEthereumChain!(
      { method: 'wallet_addEthereumChain', params: [validPayload] } as never,
      { origin: 'https://x' },
    );
    expect(result).toBeNull();
    // v0.1: no state mutation. cs.approve only called for the connect, not here.
    expect(cs.approve).not.toHaveBeenCalled();
  });
});