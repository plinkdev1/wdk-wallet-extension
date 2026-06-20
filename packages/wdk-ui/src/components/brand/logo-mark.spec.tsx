/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogoMark } from './logo-mark.js';

describe('LogoMark', () => {
  it('renders an img when src is provided', () => {
    render(<LogoMark src="/test.svg" alt="WDK" size="md" />);
    const img = screen.getByRole('img', { name: 'WDK' });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe('/test.svg');
  });

  it('renders children when no src is provided', () => {
    render(
      <LogoMark size="md">
        <span data-testid="inline-svg">inline-content</span>
      </LogoMark>,
    );
    expect(screen.getByTestId('inline-svg')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('applies the size preset to container height', () => {
    const { container } = render(<LogoMark src="/x.svg" alt="x" size="lg" />);
    const span = container.querySelector('span');
    expect(span?.style.height).toBe('64px');
  });

  it('fluid mode sets width to auto (height-driven layout for wordmarks)', () => {
    const { container } = render(<LogoMark src="/x.svg" alt="x" size="xl" fluid />);
    const span = container.querySelector('span');
    expect(span?.style.width).toBe('auto');
    expect(span?.style.height).toBe('96px');
  });

  it('square mode (default) sets width === height', () => {
    const { container } = render(<LogoMark src="/x.svg" alt="x" size="sm" />);
    const span = container.querySelector('span');
    expect(span?.style.width).toBe('32px');
    expect(span?.style.height).toBe('32px');
  });
});