/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsView } from './index';
import { defaultTheme, DEFAULT_WDK_BRAND } from '@wdk-starter/wdk-ui';
import type { ThemeState, BrandState } from './types.js';

// Mock the sections so this spec stays focused on the shell
vi.mock('./sections/appearance-section.js', () => ({
  AppearanceSection: () => <div data-testid="mock-appearance">appearance</div>,
}));
vi.mock('./sections/brand-section.js', () => ({
  BrandSection: () => <div data-testid="mock-brand">brand</div>,
}));

const themeState: ThemeState = {
  baseTheme: defaultTheme,
  setBaseTheme: vi.fn(),
  customPrimary: null,
  setCustomPrimary: vi.fn(),
};
const brandState: BrandState = {
  brand: DEFAULT_WDK_BRAND,
  setBrand: vi.fn(),
};

describe('SettingsView shell', () => {
  it('renders the Settings title', () => {
    render(<SettingsView themeState={themeState} brandState={brandState} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  it('renders both section testids (appearance + brand) in order', () => {
    render(<SettingsView themeState={themeState} brandState={brandState} onBack={vi.fn()} />);
    expect(screen.getByTestId('section-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('section-brand')).toBeInTheDocument();
  });

  it('mounts AppearanceSection + BrandSection child components', () => {
    render(<SettingsView themeState={themeState} brandState={brandState} onBack={vi.fn()} />);
    expect(screen.getByTestId('mock-appearance')).toBeInTheDocument();
    expect(screen.getByTestId('mock-brand')).toBeInTheDocument();
  });

  it('clicking the Back button fires onBack', () => {
    const onBack = vi.fn();
    render(<SettingsView themeState={themeState} brandState={brandState} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders section headings (Appearance, Brand identity)', () => {
    render(<SettingsView themeState={themeState} brandState={brandState} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /^appearance$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^brand identity$/i })).toBeInTheDocument();
  });
});