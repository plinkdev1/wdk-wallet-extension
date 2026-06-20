/**
 * Per-method body for eth_signTypedData_v4 approval.
 *
 * Parses the EIP-712 typed data JSON and shows it in structured form:
 *   - Domain summary (name, version, chainId, verifyingContract)
 *   - Primary type name
 *   - Message body as formatted JSON (full structure preserved)
 *
 * EIP-712 message bodies can be deeply nested with arbitrary types defined
 * by the dApp. A faithful structured renderer would need per-type recursion;
 * for v0.1 we use formatted JSON which keeps the structure visible without
 * obscuring details. Future commits may add a tree renderer.
 *
 * Per PRD 01 Addendum S12.5: "For typed-data signing: the parsed EIP-712
 * payload in human-readable form".
 */

import type { ApprovalRequest } from '../../../background/approval-flow.js';

interface Eip712Domain {
  readonly name?: string;
  readonly version?: string;
  readonly chainId?: number | string;
  readonly verifyingContract?: string;
}

interface Eip712TypedData {
  readonly types?: Record<string, unknown>;
  readonly primaryType?: string;
  readonly domain?: Eip712Domain;
  readonly message?: Record<string, unknown>;
}

function parseTypedData(json: string): Eip712TypedData | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as Eip712TypedData;
    return null;
  } catch {
    return null;
  }
}

export interface SignTypedDataBodyProps {
  readonly request: ApprovalRequest;
}

export function SignTypedDataBody({ request }: SignTypedDataBodyProps): JSX.Element {
  const params = request.params as readonly [string, string] | undefined;
  const signingAddress = params?.[0] ?? '';
  const typedDataJson = params?.[1] ?? '';
  const data = parseTypedData(typedDataJson);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Sign Typed Data</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.72, lineHeight: 1.5 }}>
        The dApp is requesting a structured EIP-712 signature. Review the domain and message below before signing.
      </p>

      {!data && (
        <div style={{ padding: 8, backgroundColor: 'var(--color-error)', borderRadius: 4, fontSize: 12, color: '#fff' }}>
          Failed to parse typed data JSON
        </div>
      )}

      {data?.domain && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Domain</div>
          <div style={{ padding: 8, backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.domain.name !== undefined && <div><strong>Name:</strong> {data.domain.name}</div>}
            {data.domain.version !== undefined && <div><strong>Version:</strong> {data.domain.version}</div>}
            {data.domain.chainId !== undefined && <div><strong>Chain ID:</strong> {String(data.domain.chainId)}</div>}
            {data.domain.verifyingContract !== undefined && (
              <div style={{ wordBreak: 'break-all' }}>
                <strong>Verifying Contract:</strong> {data.domain.verifyingContract}
              </div>
            )}
          </div>
        </div>
      )}

      {data?.primaryType && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Primary Type</div>
          <code style={{ fontSize: 12, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block' }}>
            {data.primaryType}
          </code>
        </div>
      )}

      {data?.message && (
        <div>
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Message</div>
          <pre
            style={{
              margin: 0,
              padding: 12,
              backgroundColor: 'var(--bg-elevated-2)',
              borderRadius: 6,
              fontSize: 11,
              maxHeight: 200,
              overflow: 'auto',
              fontFamily: 'monospace',
            }}
          >
            {JSON.stringify(data.message, null, 2)}
          </pre>
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Signing with account</div>
        <code style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
          {signingAddress}
        </code>
      </div>
    </div>
  );
}