/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AdaptiveSpinner } from './adaptive-spinner.js';

describe('AdaptiveSpinner (F-WEBCRYPTO-01)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when pending=false', () => {
    const { container } = render(<AdaptiveSpinner pending={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render immediately when pending=true (below 300ms threshold)', () => {
    const { container } = render(<AdaptiveSpinner pending={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render if pending flips to false before 300ms elapses', () => {
    const { rerender, container } = render(<AdaptiveSpinner pending={true} />);
    act(() => { vi.advanceTimersByTime(200); });
    rerender(<AdaptiveSpinner pending={false} />);
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.firstChild).toBeNull();
  });

  it('renders when pending stays true past 300ms', () => {
    render(<AdaptiveSpinner pending={true} />);
    act(() => { vi.advanceTimersByTime(301); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Working...')).toBeInTheDocument();
  });

  it('respects a custom delayMs', () => {
    render(<AdaptiveSpinner pending={true} delayMs={1000} />);
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<AdaptiveSpinner pending={true} label="Decrypting vault..." />);
    act(() => { vi.advanceTimersByTime(301); });
    expect(screen.getByText('Decrypting vault...')).toBeInTheDocument();
  });

  it('disappears when pending flips back to false after being shown', () => {
    const { rerender } = render(<AdaptiveSpinner pending={true} />);
    act(() => { vi.advanceTimersByTime(301); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(<AdaptiveSpinner pending={false} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});