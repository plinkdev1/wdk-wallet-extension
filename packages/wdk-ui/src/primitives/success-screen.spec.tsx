/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuccessScreen } from './success-screen.js';

describe('SuccessScreen', () => {
  it('renders title, message and a Done button that fires onDone', () => {
    const onDone = vi.fn();
    render(<SuccessScreen title="Sent" message="Transaction submitted." onDone={onDone} />);
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('Transaction submitted.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('middle-truncates a long hash and links out', () => {
    render(
      <SuccessScreen
        title="Sent"
        hash="0x1234567890abcdef1234567890abcdef"
        link={{ href: 'https://etherscan.io/tx/0x123', label: 'View on explorer' }}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText('0x12345678…abcdef')).toBeTruthy();
    const a = screen.getByRole('link', { name: /View on explorer/ }) as HTMLAnchorElement;
    expect(a.href).toContain('etherscan.io');
  });
});
