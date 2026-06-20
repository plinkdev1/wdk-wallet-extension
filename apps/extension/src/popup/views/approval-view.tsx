/**
 * ApprovalView - renders an EIP-1193 approval request from a dApp.
 *
 * B4.7 refactor: shared chrome wraps a per-method body selected by request.method.
 * B4.8 adds: SendTransactionBody for eth_sendTransaction.
 *
 * Per PRD 01 Addendum S12.5.
 */

import { Button, Card, Badge } from '@wdk-starter/wdk-ui';
import { send } from '../lib/sw-client.js';
import type { ApprovalRequest } from '../../background/approval-flow.js';
import { PersonalSignBody } from './approval/personal-sign-body.js';
import { SignTypedDataBody } from './approval/sign-typed-data-body.js';
import { SendTransactionBody } from './approval/send-transaction-body.js';
import { AddChainBody } from './approval/add-chain-body.js';
import { DefaultBody } from './approval/default-body.js';

export interface ApprovalViewProps {
  readonly request: ApprovalRequest;
  readonly onResponded?: () => void;
}

function formatOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return url.host;
  } catch {
    return origin;
  }
}

function renderBody(request: ApprovalRequest): JSX.Element {
  switch (request.method) {
    case 'personal_sign':
      return <PersonalSignBody request={request} />;
    case 'eth_signTypedData_v4':
      return <SignTypedDataBody request={request} />;
    case 'eth_sendTransaction':
      return <SendTransactionBody request={request} />;
    case 'wallet_addEthereumChain':
      return <AddChainBody request={request} />;
    default:
      return <DefaultBody request={request} />;
  }
}

export function ApprovalView({ request, onResponded }: ApprovalViewProps): JSX.Element {
  const handleResponse = async (approved: boolean): Promise<void> => {
    await send({ type: 'APPROVAL_RESPOND', id: request.id, approved });
    onResponded?.();
  };

  return (
    <Card variant="elevated" padding="md" style={{ margin: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Request from</div>
        <Badge
          variant="primary"
          style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}
        >
          {formatOrigin(request.origin)}
        </Badge>
      </div>

      {renderBody(request)}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={() => void handleResponse(false)}>Reject</Button>
        <Button variant="primary" onClick={() => void handleResponse(true)}>Approve</Button>
      </div>
    </Card>
  );
}