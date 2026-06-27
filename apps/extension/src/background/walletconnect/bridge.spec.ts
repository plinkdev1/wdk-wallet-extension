import { describe, it, expect, vi } from 'vitest';
import { createWalletConnectBridge, type WalletConnectClient, type WcSessionRequest } from './bridge.js';

function mockClient() {
  const listeners: Record<string, (arg: unknown) => void> = {};
  const client: WalletConnectClient = {
    approveSession: vi.fn(async () => ({ topic: 't1' })),
    rejectSession: vi.fn(async () => {}),
    respondSessionRequest: vi.fn(async () => {}),
    on: vi.fn((event: string, cb: (arg: unknown) => void) => { listeners[event] = cb; }) as WalletConnectClient['on'],
  };
  return { client, listeners };
}

const request = (method: unknown, params?: unknown): WcSessionRequest => ({
  topic: 't1', id: 42, params: { request: { method: method as string, params }, chainId: 'eip155:1' },
});

describe('createWalletConnectBridge', () => {
  it('routes a session request through the dispatcher and responds with the result', async () => {
    const { client } = mockClient();
    const router = vi.fn(async () => '0xSIGNATURE');
    const bridge = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: false }) });

    await bridge.handleRequest(request('personal_sign', ['0xdead', '0xabc']));

    expect(router).toHaveBeenCalledWith(
      { method: 'personal_sign', params: ['0xdead', '0xabc'] },
      { origin: 'wc:t1', id: '42' },
    );
    expect(client.respondSessionRequest).toHaveBeenCalledWith({ topic: 't1', response: { id: 42, result: '0xSIGNATURE' } });
  });

  it('maps a thrown JSON-RPC error onto the WC response', async () => {
    const { client } = mockClient();
    const router = vi.fn(async () => { throw { code: 4001, message: 'User rejected request' }; });
    const bridge = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: false }) });

    await bridge.handleRequest(request('eth_sendTransaction', [{ to: '0x1' }]));

    expect(client.respondSessionRequest).toHaveBeenCalledWith({
      topic: 't1', response: { id: 42, error: { code: 4001, message: 'User rejected request' } },
    });
  });

  it('rejects a malformed request (no method)', async () => {
    const { client } = mockClient();
    const router = vi.fn();
    const bridge = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: false }) });

    await bridge.handleRequest(request(undefined));

    expect(router).not.toHaveBeenCalled();
    expect(client.respondSessionRequest).toHaveBeenCalledWith({
      topic: 't1', response: { id: 42, error: { code: -32600, message: 'Invalid request' } },
    });
  });

  it('approves a proposal with namespaces, or rejects when declined', async () => {
    const { client } = mockClient();
    const router = vi.fn();
    const ns = { eip155: { accounts: ['eip155:1:0xabc'], methods: ['personal_sign'], events: [] } };

    const approving = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: true, namespaces: ns }) });
    await approving.handleProposal({ id: 7 });
    expect(client.approveSession).toHaveBeenCalledWith({ id: 7, namespaces: ns });

    const rejecting = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: false }) });
    await rejecting.handleProposal({ id: 8 });
    expect(client.rejectSession).toHaveBeenCalledWith({ id: 8, reason: { code: 5000, message: 'User rejected' } });
  });

  it('start() wires the client events to the handlers', async () => {
    const { client, listeners } = mockClient();
    const router = vi.fn(async () => '0xok');
    const bridge = createWalletConnectBridge({ client, router, approveProposal: async () => ({ approved: false }) });
    bridge.start();

    expect(typeof listeners.session_request).toBe('function');
    expect(typeof listeners.session_proposal).toBe('function');
    listeners.session_request?.(request('eth_chainId'));
    await vi.waitFor(() => expect(client.respondSessionRequest).toHaveBeenCalled());
  });
});
