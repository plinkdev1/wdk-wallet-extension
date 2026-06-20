/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TokenIcon } from './token-icon.js';

describe('TokenIcon', () => {
  it('renders content for the ETH symbol (svg or fallback)', () => {
    const { container } = render(<TokenIcon symbol="ETH" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts lowercase symbol (case-insensitive)', () => {
    const { container } = render(<TokenIcon symbol="eth" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders a placeholder span for unknown symbols', () => {
    const { container } = render(<TokenIcon symbol="NOT-A-REAL-TOKEN" />);
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });

  it('accepts a custom size', () => {
    const { container } = render(<TokenIcon symbol="ETH" size={24} />);
    expect(container.firstChild).not.toBeNull();
  });
});