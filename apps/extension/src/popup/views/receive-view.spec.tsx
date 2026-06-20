/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReceiveView } from './receive-view.js';

describe('ReceiveView', () => {
  const address = '0xD9022E95DD4BfEFBeCe17AD19d6b044C5b082359';

  it('renders the full address and a QR image', () => {
    render(<ReceiveView address={address} chainName="Ethereum Mainnet" symbol="ETH" onBack={() => {}} />);
    expect(screen.getByText(address)).toBeInTheDocument();
    const img = screen.getByAltText('Address QR code') as HTMLImageElement;
    expect(img.src.startsWith('data:image')).toBe(true);
  });

  it('shows the chain-specific receive warning', () => {
    render(<ReceiveView address={address} chainName="Polygon" symbol="POL" onBack={() => {}} />);
    expect(screen.getByText(/Send only/i)).toBeInTheDocument();
    expect(screen.getByText('Polygon')).toBeInTheDocument();
  });

  it('calls onBack when the back button is pressed', () => {
    const onBack = vi.fn();
    render(<ReceiveView address={address} chainName="Ethereum" symbol="ETH" onBack={onBack} />);
    screen.getByLabelText('Back').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
