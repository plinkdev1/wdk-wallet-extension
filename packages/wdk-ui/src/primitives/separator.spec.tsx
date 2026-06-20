import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Separator } from './separator.js';

describe('Separator', () => {
  it('renders horizontal by default (1px height, 100% width)', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep.style.height).toBe('1px');
    expect(sep.style.width).toBe('100%');
  });

  it('renders vertical with 1px width and 100% height when orientation=vertical', () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep.style.width).toBe('1px');
    expect(sep.style.height).toBe('100%');
  });

  it('uses var(--border-default) for background color', () => {
    render(<Separator data-testid="sep" />);
    expect(screen.getByTestId('sep').style.backgroundColor).toBe('var(--border-default)');
  });

  it('exposes role="separator" with aria-orientation by default', () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).toHaveAttribute('role', 'separator');
    expect(sep).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('uses aria-orientation=vertical for vertical orientation', () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    expect(screen.getByTestId('sep')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('omits role and adds aria-hidden when decorative=true', () => {
    render(<Separator decorative data-testid="sep" />);
    const sep = screen.getByTestId('sep');
    expect(sep).not.toHaveAttribute('role');
    expect(sep).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards ref to underlying div element', () => {
    const ref = createRef<HTMLDivElement>();
    render(<Separator ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});