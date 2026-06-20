/**
 * Per-method body for personal_sign approval.
 *
 * Decodes the hex-encoded message into readable text and shows it prominently.
 * The user reads the actual message they're signing, not a hex blob.
 *
 * Per PRD 01 Addendum S12.5: "Origin of the requesting dApp; What's being
 * asked; ... Approve / Reject buttons". This component handles the
 * "What's being asked" surface for personal_sign.
 */

import type { ApprovalRequest } from '../../../background/approval-flow.js';

function decodeHexToText(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  try {
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []);
    return new TextDecoder().decode(bytes);
  } catch {
    return hex;
  }
}

export interface PersonalSignBodyProps {
  readonly request: ApprovalRequest;
}

export function PersonalSignBody({ request }: PersonalSignBodyProps): JSX.Element {
  const params = request.params as readonly [string, string] | undefined;
  const messageHex = params?.[0] ?? '';
  const signingAddress = params?.[1] ?? '';
  const messageText = decodeHexToText(messageHex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Sign Message</h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.72, lineHeight: 1.5 }}>
        Signing this message proves you control the account. It does not authorize any token transfer or transaction.
      </p>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Message</div>
        <pre
          style={{
            margin: 0,
            padding: 12,
            backgroundColor: 'var(--bg-elevated-2)',
            borderRadius: 6,
            fontSize: 12,
            maxHeight: 200,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-body)',
          }}
        >
          {messageText}
        </pre>
      </div>

      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Signing with account</div>
        <code style={{ fontSize: 11, padding: '4px 8px', backgroundColor: 'var(--bg-elevated-2)', borderRadius: 4, display: 'inline-block', wordBreak: 'break-all' }}>
          {signingAddress}
        </code>
      </div>
    </div>
  );
}