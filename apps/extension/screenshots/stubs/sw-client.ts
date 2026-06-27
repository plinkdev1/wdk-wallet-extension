// Screenshot-harness stub: views call send() on user actions; on mount it
// resolves benign data so a view renders populated chrome with no service worker.
// Only the read-only message types the Home surface needs return sample data;
// everything else (quotes, swaps, sends) resolves undefined so action forms stay
// in their initial state.
export async function send(msg?: { type?: string }): Promise<never> {
  switch (msg?.type) {
    case 'ACCOUNT_GET_EVM_ADDRESS': return '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as never;
    case 'RPC_GET_BALANCE': return '1250000000000000000' as never; // 1.25 ETH
    case 'RPC_GET_TOKEN_BALANCE': return '125000000' as never; // 125.0000 (6dp)
    case 'PRICING_GET_USD_PRICE': return 3140 as never;
    default: return undefined as never;
  }
}
