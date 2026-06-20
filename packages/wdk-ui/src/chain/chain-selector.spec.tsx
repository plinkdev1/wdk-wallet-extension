// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChainSelector } from './chain-selector.js';

const OPTIONS = [
  { id: 'ethereum' as const, name: 'Ethereum', testnet: false },
  { id: 'sepolia-testnet' as const, name: 'Sepolia', testnet: true },
];

describe('ChainSelector', () => {
  it('renders the active chain name in the trigger', () => {
    render(<ChainSelector active="ethereum" options={OPTIONS} onChange={() => {}} />);
    const trigger = screen.getByTestId('chain-selector-trigger');
    expect(trigger.textContent).toContain('Ethereum');
  });

  it('shows testnet hint when active chain is a testnet', () => {
    render(<ChainSelector active="sepolia-testnet" options={OPTIONS} onChange={() => {}} />);
    const trigger = screen.getByTestId('chain-selector-trigger');
    expect(trigger.textContent?.toLowerCase()).toContain('testnet');
  });

  it('opens the listbox when the trigger is clicked', () => {
    render(<ChainSelector active="ethereum" options={OPTIONS} onChange={() => {}} />);
    expect(screen.queryByTestId('chain-selector-list')).toBeNull();
    fireEvent.click(screen.getByTestId('chain-selector-trigger'));
    expect(screen.getByTestId('chain-selector-list')).toBeInTheDocument();
  });

  it('fires onChange with the picked id and closes the list', () => {
    const onChange = vi.fn();
    render(<ChainSelector active="ethereum" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('chain-selector-trigger'));
    fireEvent.click(screen.getByTestId('chain-option-sepolia-testnet'));
    expect(onChange).toHaveBeenCalledWith('sepolia-testnet');
    expect(screen.queryByTestId('chain-selector-list')).toBeNull();
  });

  it('marks the active option with aria-selected=true', () => {
    render(<ChainSelector active="sepolia-testnet" options={OPTIONS} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('chain-selector-trigger'));
    const activeOpt = screen.getByTestId('chain-option-sepolia-testnet');
    expect(activeOpt.getAttribute('aria-selected')).toBe('true');
    const inactiveOpt = screen.getByTestId('chain-option-ethereum');
    expect(inactiveOpt.getAttribute('aria-selected')).toBe('false');
  });
});