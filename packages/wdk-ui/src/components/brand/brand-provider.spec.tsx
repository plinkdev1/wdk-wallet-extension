/**
 * BrandProvider + useBrand contract tests.
 *
 * Verifies:
 * 1. useBrand returns DEFAULT_WDK_BRAND when no provider is mounted (graceful fallback)
 * 2. BrandProvider with no brand prop yields DEFAULT_WDK_BRAND
 * 3. Partial brand override merges with DEFAULT_WDK_BRAND (unspecified fields keep defaults)
 * 4. Nested providers: innermost wins (standard React context semantics)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandProvider, useBrand } from './brand-provider';
import { DEFAULT_WDK_BRAND } from './brand-config';

function BrandConsumer() {
  const brand = useBrand();
  return (
    <div>
      <span data-testid="name">{brand.name}</span>
      <span data-testid="wordmark">{brand.wordmarkSrc ?? ''}</span>
      <span data-testid="wordmarkAlt">{brand.wordmarkAlt ?? ''}</span>
      <span data-testid="mark">{brand.markSrc ?? ''}</span>
      <span data-testid="markAlt">{brand.markAlt ?? ''}</span>
    </div>
  );
}

describe('BrandProvider + useBrand', () => {
  it('useBrand returns DEFAULT_WDK_BRAND when no provider is mounted', () => {
    render(<BrandConsumer />);
    expect(screen.getByTestId('name').textContent).toBe(DEFAULT_WDK_BRAND.name);
    expect(screen.getByTestId('wordmark').textContent).toBe(DEFAULT_WDK_BRAND.wordmarkSrc);
    expect(screen.getByTestId('mark').textContent).toBe(DEFAULT_WDK_BRAND.markSrc);
  });

  it('BrandProvider with no brand prop yields DEFAULT_WDK_BRAND', () => {
    render(
      <BrandProvider>
        <BrandConsumer />
      </BrandProvider>,
    );
    expect(screen.getByTestId('name').textContent).toBe('WDK');
    expect(screen.getByTestId('wordmark').textContent).toBe('/wdk-wordmark.svg');
    expect(screen.getByTestId('mark').textContent).toBe('/wdk-mark.png');
  });

  it('partial brand override merges with DEFAULT_WDK_BRAND', () => {
    render(
      <BrandProvider brand={{ name: 'MyWallet' }}>
        <BrandConsumer />
      </BrandProvider>,
    );
    expect(screen.getByTestId('name').textContent).toBe('MyWallet');
    // Unspecified fields keep WDK defaults
    expect(screen.getByTestId('wordmark').textContent).toBe(DEFAULT_WDK_BRAND.wordmarkSrc);
    expect(screen.getByTestId('mark').textContent).toBe(DEFAULT_WDK_BRAND.markSrc);
  });

  it('nested providers: innermost wins', () => {
    render(
      <BrandProvider brand={{ name: 'Outer', wordmarkSrc: '/outer-wm.svg' }}>
        <BrandProvider brand={{ name: 'Inner' }}>
          <BrandConsumer />
        </BrandProvider>
      </BrandProvider>,
    );
    // Inner provider supplied name='Inner' and inherits wordmark from DEFAULT_WDK_BRAND
    // (the outer provider's wordmarkSrc does NOT leak through - inner merges on
    // DEFAULT_WDK_BRAND, not on outer's value; this is intentional, matches
    // theme's compositional semantics)
    expect(screen.getByTestId('name').textContent).toBe('Inner');
    expect(screen.getByTestId('wordmark').textContent).toBe(DEFAULT_WDK_BRAND.wordmarkSrc);
  });
});