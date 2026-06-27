/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmountInput } from './amount-input.js';

describe('AmountInput', () => {
  it('emits the typed crypto amount in crypto mode', () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} symbol="ETH" />);
    fireEvent.change(screen.getByLabelText('Amount in ETH'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith('1.5');
  });

  it('rejects non-numeric input', () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} symbol="ETH" />);
    fireEvent.change(screen.getByLabelText('Amount in ETH'), { target: { value: '1.2x' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a fiat preview when priced', () => {
    render(<AmountInput value="2" onChange={() => {}} symbol="ETH" usdPrice={1000} />);
    expect(screen.getByText('≈ $2,000.00')).toBeTruthy();
  });

  it('flips to fiat entry and converts dollars back to crypto', () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} symbol="ETH" usdPrice={2000} />);
    fireEvent.click(screen.getByLabelText('Switch amount currency'));
    // Now typing $3000 should yield 1.5 ETH.
    fireEvent.change(screen.getByLabelText('Amount in USD'), { target: { value: '3000' } });
    expect(onChange).toHaveBeenLastCalledWith('1.5');
  });

  it('fills the spendable max via the Max chip', () => {
    const onChange = vi.fn();
    render(<AmountInput value="" onChange={onChange} symbol="ETH" max="0.75" />);
    fireEvent.click(screen.getByText('Max'));
    expect(onChange).toHaveBeenCalledWith('0.75');
  });

  it('hides the flip control when no price is given', () => {
    render(<AmountInput value="" onChange={() => {}} symbol="ETH" />);
    expect(screen.queryByLabelText('Switch amount currency')).toBeNull();
  });
});
