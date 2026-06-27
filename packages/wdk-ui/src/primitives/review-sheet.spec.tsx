/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewSheet } from './review-sheet.js';

const ROWS = [
  { label: 'To', value: '0xabc…1234', mono: true },
  { label: 'Amount', value: '1.5 ETH' },
];

describe('ReviewSheet', () => {
  it('renders every row label and value', () => {
    render(<ReviewSheet rows={ROWS} onConfirm={() => {}} />);
    expect(screen.getByText('To')).toBeTruthy();
    expect(screen.getByText('0xabc…1234')).toBeTruthy();
    expect(screen.getByText('Amount')).toBeTruthy();
  });

  it('fires onConfirm / onCancel', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn();
    render(<ReviewSheet rows={ROWS} onConfirm={onConfirm} onCancel={onCancel} confirmLabel="Send" cancelLabel="Back" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows the busy label and disables confirm while busy', () => {
    render(<ReviewSheet rows={ROWS} onConfirm={() => {}} busy busyLabel="Sending…" />);
    const btn = screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders an error when provided', () => {
    render(<ReviewSheet rows={ROWS} onConfirm={() => {}} error="Insufficient balance." />);
    expect(screen.getByText('Insufficient balance.')).toBeTruthy();
  });
});
