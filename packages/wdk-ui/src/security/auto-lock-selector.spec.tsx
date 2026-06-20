// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoLockSelector } from './auto-lock-selector.js';

const OPTIONS = [
  { value: 1,  label: '1 minute'   },
  { value: 5,  label: '5 minutes'  },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour'     },
  { value: 0,  label: 'Never'      },
];

describe('AutoLockSelector', () => {
  it('renders all options', () => {
    render(<AutoLockSelector value={5} options={OPTIONS} onChange={() => {}} />);
    const select = screen.getByTestId('auto-lock-selector') as HTMLSelectElement;
    expect(select.options.length).toBe(OPTIONS.length);
  });

  it('reflects the active value in the select', () => {
    render(<AutoLockSelector value={15} options={OPTIONS} onChange={() => {}} />);
    expect((screen.getByTestId('auto-lock-selector') as HTMLSelectElement).value).toBe('15');
  });

  it('calls onChange with the numeric value on selection', () => {
    const onChange = vi.fn();
    render(<AutoLockSelector value={5} options={OPTIONS} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('auto-lock-selector'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('respects the disabled prop', () => {
    render(<AutoLockSelector value={5} options={OPTIONS} onChange={() => {}} disabled />);
    expect((screen.getByTestId('auto-lock-selector') as HTMLSelectElement).disabled).toBe(true);
  });
});