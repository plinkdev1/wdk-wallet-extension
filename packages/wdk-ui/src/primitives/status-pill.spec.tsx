/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from './status-pill.js';

describe('StatusPill', () => {
  it('uses the default label for each status', () => {
    const { rerender } = render(<StatusPill status="pending" />);
    expect(screen.getByText('Pending')).toBeTruthy();
    rerender(<StatusPill status="success" />);
    expect(screen.getByText('Confirmed')).toBeTruthy();
    rerender(<StatusPill status="failed" />);
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('honors a custom label', () => {
    render(<StatusPill status="success" label="Done" />);
    expect(screen.getByText('Done')).toBeTruthy();
  });
});
