/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { announceEip6963Provider, WDK_ICON_PLACEHOLDER } from './eip6963.js';

describe('announceEip6963Provider', () => {
  let cleanup: (() => void) | null = null;
  let received: CustomEvent[];
  let listener: (e: Event) => void;

  beforeEach(() => {
    received = [];
    listener = (e: Event) => { received.push(e as CustomEvent); };
    window.addEventListener('eip6963:announceProvider', listener);
  });

  afterEach(() => {
    window.removeEventListener('eip6963:announceProvider', listener);
    cleanup?.();
    cleanup = null;
  });

  it('dispatches eip6963:announceProvider immediately on call', () => {
    cleanup = announceEip6963Provider({}, 'uuid-1');
    expect(received.length).toBe(1);
  });

  it('detail contains info { uuid, name, icon, rdns } + provider', () => {
    const provider = { request: async () => 'x' };
    cleanup = announceEip6963Provider(provider, 'uuid-42');
    const detail = received[0]!.detail as { info: { uuid: string; name: string; icon: string; rdns: string }; provider: unknown };
    expect(detail.info.uuid).toBe('uuid-42');
    expect(detail.info.name).toBe('WDK Wallet');
    expect(detail.info.rdns).toBe('app.wdkstarter.wallet');
    expect(detail.info.icon).toBe(WDK_ICON_PLACEHOLDER);
    expect(detail.provider).toBe(provider);
  });

  it('uses custom icon when supplied', () => {
    const customIcon = 'data:image/svg+xml;utf8,<svg/>';
    cleanup = announceEip6963Provider({}, 'uuid', customIcon);
    const detail = received[0]!.detail as { info: { icon: string } };
    expect(detail.info.icon).toBe(customIcon);
  });

  it('detail is frozen (cannot be mutated by dApps)', () => {
    cleanup = announceEip6963Provider({}, 'uuid');
    const detail = received[0]!.detail as { info: { uuid: string } };
    expect(Object.isFrozen(detail)).toBe(true);
    expect(Object.isFrozen(detail.info)).toBe(true);
  });

  it('re-dispatches announceProvider when eip6963:requestProvider is fired', () => {
    cleanup = announceEip6963Provider({}, 'uuid');
    expect(received.length).toBe(1);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    expect(received.length).toBe(2);
  });

  it('cleanup function stops re-announce on request', () => {
    cleanup = announceEip6963Provider({}, 'uuid');
    cleanup();
    cleanup = null;
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    expect(received.length).toBe(1);
  });

  it('multiple announce calls each dispatch independently', () => {
    cleanup = announceEip6963Provider({ a: 1 }, 'uuid-a');
    const cleanup2 = announceEip6963Provider({ b: 2 }, 'uuid-b');
    expect(received.length).toBe(2);
    cleanup2();
  });
});