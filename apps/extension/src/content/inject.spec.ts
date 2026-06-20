/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { injectInpage } from './inject.js';

describe('injectInpage', () => {
  beforeEach(() => {
    // Reset DOM between tests
    document.head.innerHTML = '';
  });

  it('creates a <script> element with src from getURL()', () => {
    const getURL = (path: string) => `chrome-extension://abc123/${path}`;
    const script = injectInpage({ getURL, uuid: 'u1' });
    expect(script.tagName).toBe('SCRIPT');
    expect(script.src).toBe('chrome-extension://abc123/inpage.js');
  });

  it('sets script.dataset.uuid before appending', () => {
    const getURL = (p: string) => p;
    const script = injectInpage({ getURL, uuid: 'install-uuid-xyz' });
    expect(script.dataset.uuid).toBe('install-uuid-xyz');
  });

  it('appends the script to document.head by default', () => {
    const getURL = (p: string) => p;
    const script = injectInpage({ getURL, uuid: 'u' });
    expect(document.head.contains(script)).toBe(true);
  });

  it('uses custom inpagePath when supplied', () => {
    const getURL = (p: string) => `chrome-extension://x/${p}`;
    const script = injectInpage({
      getURL, uuid: 'u',
      inpagePath: 'custom/inpage.js',
    });
    expect(script.src).toContain('custom/inpage.js');
  });

  it('uses custom target element when supplied', () => {
    const customTarget = document.createElement('div');
    document.body.appendChild(customTarget);
    const script = injectInpage({
      getURL: (p) => p,
      uuid: 'u',
      target: customTarget,
    });
    expect(customTarget.contains(script)).toBe(true);
    expect(document.head.contains(script)).toBe(false);
  });
});