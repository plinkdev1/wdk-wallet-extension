import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { Input } from './input.js';

describe('Input', () => {
  it('renders as text input by default', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i')).toBeInstanceOf(HTMLInputElement);
  });

  it('accepts and emits value changes', () => {
    const onChange = vi.fn();
    render(<Input data-testid="i" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('i'), { target: { value: '0xabc' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('applies default variant border (--border-default)', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i').style.borderColor).toBe('var(--border-default)');
  });

  it('applies error variant border (--color-error)', () => {
    render(<Input variant="error" data-testid="i" />);
    expect(screen.getByTestId('i').style.borderColor).toBe('var(--color-error)');
  });

  it('applies size sm (32px height)', () => {
    render(<Input size="sm" data-testid="i" />);
    expect(screen.getByTestId('i').style.height).toBe('32px');
  });

  it('applies size lg (48px height)', () => {
    render(<Input size="lg" data-testid="i" />);
    expect(screen.getByTestId('i').style.height).toBe('48px');
  });

  it('uses var(--bg-elevated-1) for background', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i').style.backgroundColor).toBe('var(--bg-elevated-1)');
  });

  it('uses var(--radius-md) for border radius', () => {
    render(<Input data-testid="i" />);
    expect(screen.getByTestId('i').style.borderRadius).toBe('var(--radius-md)');
  });

  it('forwards ref to underlying input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through native input props (type, placeholder, value, name)', () => {
    render(<Input type="password" placeholder="enter password" name="pwd" data-testid="i" />);
    const i = screen.getByTestId('i');
    expect(i).toHaveAttribute('type', 'password');
    expect(i).toHaveAttribute('placeholder', 'enter password');
    expect(i).toHaveAttribute('name', 'pwd');
  });

  it('allows style prop to override defaults', () => {
    render(<Input style={{ width: '200px' }} data-testid="i" />);
    expect(screen.getByTestId('i').style.width).toBe('200px');
  });

  it('applies border-box sizing + min-width:0 so a full-width field stays inside its flex container', () => {
    render(<Input data-testid="i" />);
    const el = screen.getByTestId('i');
    expect(el.style.boxSizing).toBe('border-box');
    expect(['0px', '0']).toContain(el.style.minWidth);
  });
});