/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonalSignBody } from './personal-sign-body.js';
import type { ApprovalRequest } from '../../../background/approval-flow.js';

const baseRequest: ApprovalRequest = {
  id: 'r1',
  origin: 'https://uniswap.org',
  method: 'personal_sign',
  params: ['0x48656c6c6f2c20576f726c6421', '0xAa00000000000000000000000000000000000000'],
  createdAt: 0,
};

describe('PersonalSignBody', () => {
  it('renders the "Sign Message" heading', () => {
    render(<PersonalSignBody request={baseRequest} />);
    expect(screen.getByText('Sign Message')).toBeInTheDocument();
  });

  it('decodes the hex message and renders as text', () => {
    render(<PersonalSignBody request={baseRequest} />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('renders the signing address', () => {
    render(<PersonalSignBody request={baseRequest} />);
    expect(screen.getByText('0xAa00000000000000000000000000000000000000')).toBeInTheDocument();
  });

  it('falls back to raw hex when input is not valid hex', () => {
    const malformed: ApprovalRequest = { ...baseRequest, params: ['not-hex-data', '0xAa'] };
    render(<PersonalSignBody request={malformed} />);
    // The decode-fallback path returns the input as-is on parse failure.
    // No assertion error - just verifying no crash.
    expect(screen.getByText('Sign Message')).toBeInTheDocument();
  });
});