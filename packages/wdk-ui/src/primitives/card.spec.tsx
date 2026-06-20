import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Card } from './card.js';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><span data-testid="child">content</span></Card>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('content');
  });

  it('applies flat variant by default (bg-elevated-1 + border-subtle)', () => {
    render(<Card data-testid="card">x</Card>);
    const card = screen.getByTestId('card');
    expect(card.style.backgroundColor).toBe('var(--bg-elevated-1)');
    expect(card.style.border).toContain('var(--border-subtle)');
  });

  it('applies elevated variant with shadow and border-default', () => {
    render(<Card variant="elevated" data-testid="card">x</Card>);
    const card = screen.getByTestId('card');
    expect(card.style.boxShadow).toContain('var(--shadow-md');
    expect(card.style.border).toContain('var(--border-default)');
  });

  it('applies glass variant with backdrop-filter blur using --glass-blur', () => {
    render(<Card variant="glass" data-testid="card">x</Card>);
    const card = screen.getByTestId('card');
    expect(card.style.backdropFilter).toBe('blur(var(--glass-blur))');
  });

  it('applies md padding by default (20px)', () => {
    render(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId('card').style.padding).toBe('20px');
  });

  it('applies none padding (0px)', () => {
    render(<Card padding="none" data-testid="card">x</Card>);
    expect(screen.getByTestId('card').style.padding).toBe('0px');
  });

  it('applies lg padding (32px)', () => {
    render(<Card padding="lg" data-testid="card">x</Card>);
    expect(screen.getByTestId('card').style.padding).toBe('32px');
  });

  it('uses var(--radius-lg) for border radius', () => {
    render(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId('card').style.borderRadius).toBe('var(--radius-lg)');
  });

  it('forwards ref to underlying div element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>x</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('allows style prop to override defaults', () => {
    render(<Card style={{ backgroundColor: 'red' }} data-testid="card">x</Card>);
    expect(screen.getByTestId('card').style.backgroundColor).toBe('red');
  });
});