import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Badge } from './badge.js';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>v1.0</Badge>);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
  });

  it('renders as <span>', () => {
    render(<Badge data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').tagName).toBe('SPAN');
  });

  it('applies default variant (bg-elevated-2 + text-primary)', () => {
    render(<Badge data-testid="b">x</Badge>);
    const b = screen.getByTestId('b');
    expect(b.style.backgroundColor).toBe('var(--bg-elevated-2)');
    expect(b.style.color).toBe('var(--text-primary)');
  });

  it('applies primary variant', () => {
    render(<Badge variant="primary" data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').style.backgroundColor).toBe('var(--color-primary)');
  });

  it('applies success variant', () => {
    render(<Badge variant="success" data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').style.backgroundColor).toBe('var(--color-success)');
  });

  it('applies warning variant with black text (contrast on amber)', () => {
    render(<Badge variant="warning" data-testid="b">x</Badge>);
    const b = screen.getByTestId('b');
    expect(b.style.backgroundColor).toBe('var(--color-warning)');
    expect(b.style.color).toBe('rgb(0, 0, 0)');
  });

  it('applies error variant', () => {
    render(<Badge variant="error" data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').style.backgroundColor).toBe('var(--color-error)');
  });

  it('applies info variant', () => {
    render(<Badge variant="info" data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').style.backgroundColor).toBe('var(--color-info)');
  });

  it('uses full-pill border radius (9999px)', () => {
    render(<Badge data-testid="b">x</Badge>);
    expect(screen.getByTestId('b').style.borderRadius).toBe('9999px');
  });

  it('forwards ref to underlying span', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>x</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});