/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from './password-input.js';

describe('PasswordInput', () => {
  it('renders with default Password placeholder', () => {
    render(<PasswordInput value="" onChange={() => undefined} />);
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  it('accepts a custom placeholder', () => {
    render(<PasswordInput value="" onChange={() => undefined} placeholder="Wallet password" />);
    expect(screen.getByPlaceholderText('Wallet password')).toBeInTheDocument();
  });

  it('forwards typed characters to onChange', async () => {
    const onChange = vi.fn();
    render(<PasswordInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Password');
    await userEvent.type(input, 'hunter2');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders masked by default (type=password)', () => {
    render(<PasswordInput value="abc" onChange={() => undefined} />);
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles to type=text when Show is clicked', async () => {
    render(<PasswordInput value="abc" onChange={() => undefined} />);
    const input = screen.getByPlaceholderText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('respects defaultShow test hook', () => {
    render(<PasswordInput value="abc" onChange={() => undefined} defaultShow />);
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'text');
  });

  it('disabled prop disables input and toggle button', () => {
    render(<PasswordInput value="" onChange={() => undefined} disabled />);
    expect(screen.getByPlaceholderText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });

  it('calls onSubmit when Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(<PasswordInput value="abc" onChange={() => undefined} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Password'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onSubmit on Enter when disabled', () => {
    const onSubmit = vi.fn();
    render(<PasswordInput value="abc" onChange={() => undefined} onSubmit={onSubmit} disabled />);
    fireEvent.keyDown(screen.getByPlaceholderText('Password'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});