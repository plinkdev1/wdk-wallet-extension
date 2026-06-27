/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabBar } from './tab-bar.js';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'swap', label: 'Swap' },
  { id: 'activity', label: 'Activity' },
];

describe('TabBar', () => {
  it('renders a tablist with one tab per item and marks the active one', () => {
    render(<TabBar tabs={TABS} active="swap" onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Swap' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the tab id when a tab is clicked', () => {
    const onChange = vi.fn();
    render(<TabBar tabs={TABS} active="home" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(onChange).toHaveBeenCalledWith('activity');
  });
});
