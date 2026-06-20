/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandSection } from './brand-section';
import { DEFAULT_WDK_BRAND } from '@wdk-starter/wdk-ui';
import type { BrandState } from '../types.js';

function makeState(): BrandState {
  return {
    brand: DEFAULT_WDK_BRAND,
    setBrand: vi.fn(),
  };
}

describe('BrandSection', () => {
  it('renders the BrandPicker (brand name input present)', () => {
    render(<BrandSection brandState={makeState()} />);
    expect(screen.getByLabelText(/brand name/i)).toBeInTheDocument();
  });

  it('changing the name input fires setBrand with the new value', () => {
    const state = makeState();
    render(<BrandSection brandState={state} />);
    fireEvent.change(screen.getByLabelText(/brand name/i), { target: { value: 'MyWallet' } });
    expect(state.setBrand).toHaveBeenCalledWith(expect.objectContaining({ name: 'MyWallet' }));
  });

  it('Reset button fires setBrand with DEFAULT_WDK_BRAND', () => {
    const state: BrandState = { brand: { ...DEFAULT_WDK_BRAND, name: 'Custom' }, setBrand: vi.fn() };
    render(<BrandSection brandState={state} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(state.setBrand).toHaveBeenCalledWith(DEFAULT_WDK_BRAND);
  });
});