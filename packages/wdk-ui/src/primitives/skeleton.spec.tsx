import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Skeleton } from './skeleton.js';

describe('Skeleton', () => {
  beforeEach(() => {
    // Remove any keyframes-injection style from prior test (idempotency check should
    // make this unnecessary, but explicit reset prevents cross-test pollution).
    document.getElementById('wdk-skeleton-keyframes')?.remove();
  });

  it('renders with default width 100% and height 1em', () => {
    render(<Skeleton data-testid="s" />);
    const s = screen.getByTestId('s');
    expect(s.style.width).toBe('100%');
    expect(s.style.height).toBe('1em');
  });

  it('accepts custom width and height strings', () => {
    render(<Skeleton width="200px" height="40px" data-testid="s" />);
    const s = screen.getByTestId('s');
    expect(s.style.width).toBe('200px');
    expect(s.style.height).toBe('40px');
  });

  it('uses var(--bg-elevated-2) for background', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s').style.backgroundColor).toBe('var(--bg-elevated-2)');
  });

  it('uses var(--radius-sm) for border radius', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s').style.borderRadius).toBe('var(--radius-sm)');
  });

  it('applies pulse animation by default', () => {
    render(<Skeleton data-testid="s" />);
    const s = screen.getByTestId('s');
    expect(s.style.animationName).toBe('wdk-skeleton-pulse');
    expect(s.style.animationDuration).toBe('1.6s');
    expect(s.style.animationIterationCount).toBe('infinite');
  });

  it('omits animation when static=true', () => {
    render(<Skeleton static data-testid="s" />);
    const s = screen.getByTestId('s');
    expect(s.style.animationName).toBe('');
  });

  it('injects @keyframes wdk-skeleton-pulse into document.head on first non-static mount', () => {
    render(<Skeleton />);
    const styleEl = document.getElementById('wdk-skeleton-keyframes');
    expect(styleEl).toBeInstanceOf(HTMLStyleElement);
    expect(styleEl?.textContent).toContain('@keyframes wdk-skeleton-pulse');
  });

  it('does NOT inject keyframes for static skeleton', () => {
    render(<Skeleton static />);
    expect(document.getElementById('wdk-skeleton-keyframes')).toBeNull();
  });

  it('is idempotent - rendering multiple Skeletons creates only one keyframes style element', () => {
    render(
      <>
        <Skeleton data-testid="s1" />
        <Skeleton data-testid="s2" />
        <Skeleton data-testid="s3" />
      </>
    );
    const matches = document.head.querySelectorAll('#wdk-skeleton-keyframes');
    expect(matches.length).toBe(1);
  });

  it('exposes aria-busy=true for accessibility', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s')).toHaveAttribute('aria-busy', 'true');
  });

  it('forwards ref to underlying div', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Skeleton ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});