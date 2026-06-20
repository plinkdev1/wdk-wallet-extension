import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { WdkThemeProvider, useWdkTheme } from './provider.js';
import { wdkWarmTheme, coolDarkTheme, institutionalLightTheme } from './default-themes.js';
import type { WdkTheme } from './types.js';

describe('WdkThemeProvider', () => {
  beforeEach(() => {
    // Reset document state between tests so prior useEffect side effects don't leak
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
  });

  it('injects --color-primary onto document.documentElement on mount', () => {
    render(<WdkThemeProvider>kids</WdkThemeProvider>);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#F4642F');
  });

  it('injects --bg-base from wdkWarmTheme by default', () => {
    render(<WdkThemeProvider>kids</WdkThemeProvider>);
    expect(document.documentElement.style.getPropertyValue('--bg-base')).toBe('#0F0B08');
  });

  it('sets data-theme=dark for wdkWarmTheme default', () => {
    render(<WdkThemeProvider>kids</WdkThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('switches CSS vars when theme prop changes to coolDarkTheme', () => {
    render(<WdkThemeProvider theme={coolDarkTheme}>kids</WdkThemeProvider>);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#9333EA');
    expect(document.documentElement.style.getPropertyValue('--bg-base')).toBe('#111827');
  });

  it('sets data-theme=light for institutionalLightTheme', () => {
    render(<WdkThemeProvider theme={institutionalLightTheme}>kids</WdkThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes injected CSS vars and data-theme on unmount', () => {
    const { unmount } = render(<WdkThemeProvider>kids</WdkThemeProvider>);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#F4642F');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.getAttribute('data-theme')).toBe(null);
  });

  it('skips CSS injection when skipCssInjection=true (only context distribution)', () => {
    render(<WdkThemeProvider skipCssInjection>kids</WdkThemeProvider>);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(document.documentElement.getAttribute('data-theme')).toBe(null);
  });

  it('exposes theme via useWdkTheme hook', () => {
    let captured: WdkTheme | null = null;
    function Capture() {
      captured = useWdkTheme();
      return null;
    }
    render(
      <WdkThemeProvider theme={coolDarkTheme}>
        <Capture />
      </WdkThemeProvider>
    );
    expect(captured).toBe(coolDarkTheme);
  });

  it('useWdkTheme falls back to wdkWarmTheme when no provider in tree', () => {
    let captured: WdkTheme | null = null;
    function Capture() {
      captured = useWdkTheme();
      return null;
    }
    render(<Capture />);
    expect(captured).toBe(wdkWarmTheme);
  });

  it('useWdkTheme returns wdkWarmTheme when WdkThemeProvider has no theme prop', () => {
    let captured: WdkTheme | null = null;
    function Capture() {
      captured = useWdkTheme();
      return null;
    }
    render(
      <WdkThemeProvider>
        <Capture />
      </WdkThemeProvider>
    );
    expect(captured).toBe(wdkWarmTheme);
  });
});