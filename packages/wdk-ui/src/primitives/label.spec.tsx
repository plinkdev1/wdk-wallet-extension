import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Label } from './label.js';

describe('Label', () => {
  it('renders children', () => {
    render(<Label>Email</Label>);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders as a <label> element', () => {
    render(<Label data-testid="l">x</Label>);
    expect(screen.getByTestId('l').tagName).toBe('LABEL');
  });

  it('uses var(--text-primary) for color', () => {
    render(<Label data-testid="l">x</Label>);
    expect(screen.getByTestId('l').style.color).toBe('var(--text-primary)');
  });

  it('does NOT render asterisk by default', () => {
    render(<Label data-testid="l">Email</Label>);
    expect(screen.getByTestId('l').textContent).toBe('Email');
  });

  it('renders asterisk when required=true', () => {
    render(<Label required data-testid="l">Email</Label>);
    expect(screen.getByTestId('l').textContent).toBe('Email*');
  });

  it('asterisk uses --color-error and is aria-hidden', () => {
    render(<Label required data-testid="l">x</Label>);
    const asterisk = screen.getByTestId('l').querySelector('span');
    expect(asterisk?.style.color).toBe('var(--color-error)');
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
  });

  it('forwards htmlFor attribute to underlying label', () => {
    render(<Label htmlFor="email-input" data-testid="l">x</Label>);
    expect(screen.getByTestId('l')).toHaveAttribute('for', 'email-input');
  });

  it('forwards ref to underlying label element', () => {
    const ref = createRef<HTMLLabelElement>();
    render(<Label ref={ref}>x</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });
});