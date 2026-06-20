/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NetworkIcon } from './network-icon.js';

describe('NetworkIcon', () => {
  it('renders content for the ethereum chain (svg or fallback)', () => {
    const { container } = render(<NetworkIcon chain="ethereum" />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders a placeholder span for unknown chains', () => {
    const { container } = render(<NetworkIcon chain="not-a-real-chain-xyz" />);
    expect(container.querySelector('span[aria-hidden="true"]')).not.toBeNull();
  });

  it('accepts a custom size', () => {
    const { container } = render(<NetworkIcon chain="ethereum" size={32} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts a mono variant with color', () => {
    const { container } = render(
      <NetworkIcon chain="ethereum" variant="mono" color="#FF0000" />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});