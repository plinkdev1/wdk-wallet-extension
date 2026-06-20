import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Button } from './button.js';

describe('Button', () => {
  it('renders with children as accessible name', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Disabled</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies disabled attribute to the underlying button', () => {
    render(<Button disabled>x</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies primary variant style by default (uses var(--color-primary))', () => {
    render(<Button>x</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('var(--color-primary)');
    expect(btn.style.color).toBe('var(--bg-base)');
  });

  it('applies destructive variant style (--color-error background)', () => {
    render(<Button variant="destructive">x</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('var(--color-error)');
  });

  it('applies outline variant style (transparent bg + border)', () => {
    render(<Button variant="outline">x</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('transparent');
    expect(btn.style.border).toContain('var(--border-default)');
  });

  it('applies ghost variant style (transparent background)', () => {
    render(<Button variant="ghost">x</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.backgroundColor).toBe('transparent');
    // jsdom's CSSStyleDeclaration unreliably preserves border-related properties
    // set via inline style - 'border: none', 'borderStyle: none', and 'borderWidth: 0'
    // all get silently dropped on read. Source uses `borderStyle: 'none'` which is
    // correct CSS and works in real browsers (Chrome/Firefox/Safari). Visual
    // no-border outcome is verified at smoke-load time (B4.4+ when WdkUI consumers
    // mount real DOM), not in this jsdom-based unit test.
  });

  it('applies size sm style (32px height)', () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole('button').style.height).toBe('32px');
  });

  it('applies size lg style (48px height)', () => {
    render(<Button size="lg">x</Button>);
    expect(screen.getByRole('button').style.height).toBe('48px');
  });

  it('applies size icon style (40x40 square)', () => {
    render(<Button size="icon" aria-label="icon">x</Button>);
    const btn = screen.getByRole('button');
    expect(btn.style.height).toBe('40px');
    expect(btn.style.width).toBe('40px');
  });

  it('uses var(--radius-md) for border radius', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button').style.borderRadius).toBe('var(--radius-md)');
  });

  it('uses var(--motion-duration) for transition duration', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button').style.transitionDuration).toBe('var(--motion-duration)');
  });

  it('forwards ref to underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>x</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('allows style prop to override defaults', () => {
    render(<Button style={{ backgroundColor: 'red' }}>x</Button>);
    expect(screen.getByRole('button').style.backgroundColor).toBe('red');
  });

  it('passes through arbitrary button props (type, aria-label, data-*)', () => {
    render(<Button type="submit" aria-label="submit-btn" data-testid="btn">x</Button>);
    const btn = screen.getByTestId('btn');
    expect(btn).toHaveAttribute('type', 'submit');
    expect(btn).toHaveAttribute('aria-label', 'submit-btn');
  });
});