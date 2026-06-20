/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceSection } from './appearance-section';
import { defaultTheme } from '@wdk-starter/wdk-ui';
import type { ThemeState } from '../types.js';

function makeState(customPrimary: string | null = null): ThemeState {
  return {
    baseTheme: defaultTheme,
    setBaseTheme: vi.fn(),
    customPrimary,
    setCustomPrimary: vi.fn(),
    customColors: {},
    setCustomColor: vi.fn(),
    clearAllCustomColors: vi.fn(),
  };
}

describe('AppearanceSection', () => {
  it('renders the ThemePicker (swatch buttons present)', () => {
    render(<AppearanceSection themeState={makeState()} />);
    // ThemePicker exposes 7 primary swatches as labelled buttons; find one
    expect(screen.getByLabelText(/warm orange/i)).toBeInTheDocument();
  });

  it('renders the custom hex input + Apply button', () => {
    render(<AppearanceSection themeState={makeState()} />);
    expect(screen.getByLabelText(/custom primary color/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument();
  });

  it('Apply with a valid hex calls setCustomPrimary with that hex', () => {
    const state = makeState();
    render(<AppearanceSection themeState={state} />);
    fireEvent.change(screen.getByLabelText(/custom primary color/i), { target: { value: '#FF00FF' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(state.setCustomPrimary).toHaveBeenCalledWith('#FF00FF');
  });

  it('Apply with invalid hex shows an alert and does NOT call setCustomPrimary', () => {
    const state = makeState();
    render(<AppearanceSection themeState={state} />);
    fireEvent.change(screen.getByLabelText(/custom primary color/i), { target: { value: 'not-hex' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/#RRGGBB/);
    expect(state.setCustomPrimary).not.toHaveBeenCalled();
  });

  it('Apply with empty input clears the custom primary', () => {
    const state = makeState('#FF00FF');
    render(<AppearanceSection themeState={state} />);
    fireEvent.change(screen.getByLabelText(/custom primary color/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(state.setCustomPrimary).toHaveBeenCalledWith(null);
  });

  it('Clear button calls setCustomPrimary(null) when a custom primary is active', () => {
    const state = makeState('#FF00FF');
    render(<AppearanceSection themeState={state} />);
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(state.setCustomPrimary).toHaveBeenCalledWith(null);
  });

  it('shows "Active custom primary" indicator when one is set', () => {
    const state = makeState('#ABCDEF');
    render(<AppearanceSection themeState={state} />);
    expect(screen.getByText(/active custom primary/i)).toBeInTheDocument();
    expect(screen.getByText('#ABCDEF')).toBeInTheDocument();
  });

  it('renders a native visual color picker input', () => {
    render(<AppearanceSection themeState={makeState()} />);
    const picker = screen.getByLabelText(/visual color picker/i) as HTMLInputElement;
    expect(picker).toBeInTheDocument();
    expect(picker.type).toBe('color');
  });

  it('changing the visual color picker fires setCustomPrimary immediately (no Apply click)', () => {
    const state = makeState();
    render(<AppearanceSection themeState={state} />);
    const picker = screen.getByLabelText(/visual color picker/i);
    fireEvent.change(picker, { target: { value: '#aabbcc' } });
    expect(state.setCustomPrimary).toHaveBeenCalledWith('#AABBCC');
  });

  it('B0c.swatch-clear: clicking the ThemePicker swatch fires setCustomPrimary(null) when a custom hex is active', () => {
    const state = makeState('#ABCDEF'); // custom primary currently active
    render(<AppearanceSection themeState={state} />);
    // The swatch buttons are role="radio" with aria-label "Warm Orange" etc.
    fireEvent.click(screen.getByLabelText(/warm orange/i));
    expect(state.setBaseTheme).toHaveBeenCalled();
    expect(state.setCustomPrimary).toHaveBeenCalledWith(null);
  });

  it('B0c.swatch-clear: does NOT call setCustomPrimary if no custom hex is currently active', () => {
    const state = makeState(); // no custom primary
    render(<AppearanceSection themeState={state} />);
    fireEvent.click(screen.getByLabelText(/warm orange/i));
    expect(state.setBaseTheme).toHaveBeenCalled();
    expect(state.setCustomPrimary).not.toHaveBeenCalled();
  });

  it('B0c.per-color: renders Advanced colors details with 5 color rows', () => {
    render(<AppearanceSection themeState={makeState()} />);
    // The Advanced colors summary
    expect(screen.getByText(/advanced colors/i)).toBeInTheDocument();
    // 5 color rows by data-testid
    expect(screen.getByTestId('color-row-bgBase')).toBeInTheDocument();
    expect(screen.getByTestId('color-row-bgElevated1')).toBeInTheDocument();
    expect(screen.getByTestId('color-row-bgElevated2')).toBeInTheDocument();
    expect(screen.getByTestId('color-row-textPrimary')).toBeInTheDocument();
    expect(screen.getByTestId('color-row-textSecondary')).toBeInTheDocument();
  });

  it('B0c.per-color: changing a color picker fires setCustomColor with the picked hex', () => {
    const state = makeState();
    render(<AppearanceSection themeState={state} />);
    const picker = screen.getByLabelText(/background color picker/i);
    fireEvent.change(picker, { target: { value: '#abcdef' } });
    expect(state.setCustomColor).toHaveBeenCalledWith('bgBase', '#ABCDEF');
  });

  it('B0c.reset: renders Reset appearance to defaults button', () => {
    render(<AppearanceSection themeState={makeState()} />);
    expect(screen.getByTestId('appearance-reset-button')).toBeInTheDocument();
  });

  it('B0c.reset: clicking Reset calls setBaseTheme, setCustomPrimary(null), clearAllCustomColors', () => {
    const state = makeState();
    render(<AppearanceSection themeState={state} />);
    const resetBtn = screen.getByTestId('appearance-reset-button');
    fireEvent.click(resetBtn);
    expect(state.setBaseTheme).toHaveBeenCalled();
    expect(state.setCustomPrimary).toHaveBeenCalledWith(null);
    expect(state.clearAllCustomColors).toHaveBeenCalled();
  });
});