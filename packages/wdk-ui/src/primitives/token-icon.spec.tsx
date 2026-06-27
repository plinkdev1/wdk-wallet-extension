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

  it('renders the embedded Tether mark for USDt / XAUt (not a generic chip)', () => {
    for (const sym of ['USDt', 'usdt', 'XAUt', 'USDT0']) {
      const { container } = render(<TokenIcon symbol={sym} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      // the canonical Tether glyph path is present, and NO letter-chip span
      expect(svg?.querySelector('path')?.getAttribute('d')).toContain('M17.922 17.383');
      expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
    }
  });

  it('uses the green disc for USD₮ and the gold disc for Tether Gold', () => {
    const { container: u } = render(<TokenIcon symbol="USDt" />);
    expect(u.querySelector('circle')?.getAttribute('fill')).toBe('#26A17B');
    const { container: x } = render(<TokenIcon symbol="XAUt" />);
    expect(x.querySelector('circle')?.getAttribute('fill')).toBe('#C7A647');
  });

  it('accepts a custom size', () => {
    const { container } = render(<TokenIcon symbol="ETH" size={24} />);
    expect(container.firstChild).not.toBeNull();
  });
});