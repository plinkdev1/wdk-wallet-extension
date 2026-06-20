/**
 * Default per-method body. Used for eth_requestAccounts (connection prompt)
 * and as fallback for methods without a dedicated body (e.g., the
 * eth_sendTransaction stub before B4.8 ships its dedicated body).
 *
 * Renders origin + method + raw params JSON. Extracted from the previous
 * monolithic ApprovalView so per-method bodies can replace it cleanly.
 */

import type { ApprovalRequest } from '../../../background/approval-flow.js';

const FRIENDLY_TITLES: Readonly<Record<string, string>> = {
  eth_requestAccounts: 'Connection Request',
};

function titleFor(method: string): string {
  return FRIENDLY_TITLES[method] ?? `Request: ${method}`;
}

export interface DefaultBodyProps {
  readonly request: ApprovalRequest;
}

export function DefaultBody({ request }: DefaultBodyProps): JSX.Element {
  const paramsToShow = request.params && request.params.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{titleFor(request.method)}</h2>
      <div>
        <strong>Method:</strong> <code>{request.method}</code>
      </div>
      {paramsToShow && (
        <pre
          style={{
            fontSize: 11,
            padding: 8,
            backgroundColor: 'var(--bg-elevated-2)',
            borderRadius: 4,
            maxHeight: 120,
            overflow: 'auto',
            margin: 0,
          }}
        >
          {JSON.stringify(request.params, null, 2)}
        </pre>
      )}
    </div>
  );
}