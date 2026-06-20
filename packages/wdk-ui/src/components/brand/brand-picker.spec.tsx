/**
 * BrandPicker contract tests.
 *
 * The `readFile` prop injection is used to test file inputs without
 * needing a real FileReader (jsdom's FileReader is unreliable for our
 * needs). The injected reader returns a deterministic data URI per file.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandPicker } from './brand-picker';
import { DEFAULT_WDK_BRAND, type BrandConfig } from './brand-config';

function makeFile(name: string, content = 'x', type = 'image/png'): File {
  return new File([content], name, { type });
}

const fakeReader = vi.fn(async (f: File) => `data:${f.type};base64,FAKE_${f.name}`);

describe('BrandPicker', () => {
  it('renders preview, name, wordmark, mark, alt fields, and Reset button', () => {
    render(<BrandPicker value={DEFAULT_WDK_BRAND} onChange={vi.fn()} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    expect(screen.getByTestId('brand-preview')).toBeInTheDocument();
    expect(screen.getByLabelText(/brand name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wordmark image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wordmark alt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/master mark image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/master mark alt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
  });

  it('name input change fires onChange with updated name', () => {
    const onChange = vi.fn();
    render(<BrandPicker value={DEFAULT_WDK_BRAND} onChange={onChange} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    fireEvent.change(screen.getByLabelText(/brand name/i), { target: { value: 'MyWallet' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'MyWallet' }));
  });

  it('Reset button fires onChange with defaults', () => {
    const onChange = vi.fn();
    const custom: BrandConfig = { ...DEFAULT_WDK_BRAND, name: 'Custom' };
    render(<BrandPicker value={custom} onChange={onChange} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    fireEvent.click(screen.getByRole('button', { name: /reset to defaults/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_WDK_BRAND);
  });

  it('wordmark file upload fires onChange with data URI from readFile', async () => {
    const onChange = vi.fn();
    render(<BrandPicker value={DEFAULT_WDK_BRAND} onChange={onChange} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    const file = makeFile('mycorp-wm.svg', '<svg/>', 'image/svg+xml');
    const input = screen.getByLabelText(/wordmark image/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    // Wait microtask so the await in handleWordmarkFile resolves
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        wordmarkSrc: 'data:image/svg+xml;base64,FAKE_mycorp-wm.svg',
      }));
    });
  });

  it('mark file upload fires onChange with data URI from readFile', async () => {
    const onChange = vi.fn();
    render(<BrandPicker value={DEFAULT_WDK_BRAND} onChange={onChange} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    const file = makeFile('mycorp-mark.png');
    const input = screen.getByLabelText(/master mark image/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        markSrc: 'data:image/png;base64,FAKE_mycorp-mark.png',
      }));
    });
  });

  it('Clear wordmark button fires onChange with wordmarkSrc undefined', () => {
    const onChange = vi.fn();
    const withWordmark: BrandConfig = { ...DEFAULT_WDK_BRAND, wordmarkSrc: 'data:image/png;base64,X' };
    render(<BrandPicker value={withWordmark} onChange={onChange} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    fireEvent.click(screen.getByRole('button', { name: /clear wordmark/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ wordmarkSrc: undefined }));
  });

  it('preview renders mark img and wordmark img when both srcs are set', () => {
    const full: BrandConfig = {
      ...DEFAULT_WDK_BRAND,
      wordmarkSrc: 'data:image/svg+xml;base64,WM',
      markSrc: 'data:image/png;base64,MK',
    };
    render(<BrandPicker value={full} onChange={vi.fn()} defaults={DEFAULT_WDK_BRAND} readFile={fakeReader} />);
    const preview = screen.getByTestId('brand-preview');
    const imgs = preview.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0]?.getAttribute('src')).toBe('data:image/png;base64,MK');
    expect(imgs[1]?.getAttribute('src')).toBe('data:image/svg+xml;base64,WM');
  });
});