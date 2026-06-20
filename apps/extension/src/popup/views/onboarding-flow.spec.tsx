/**
 * @vitest-environment jsdom
 *
 * OnboardingFlow (B5.4.3) spec. Mocks all three child views (OnboardingChoice,
 * CreateVaultView, ImportVaultView) so the tests focus on this component's
 * mode-routing state machine + callback propagation. Each child has its own
 * spec for its own behavior (L-TEST-03 / L-REACT-04).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingFlow } from './onboarding-flow.js';

vi.mock('./onboarding-choice.js', () => ({
  OnboardingChoice: ({ onCreateNew, onImport }: { onCreateNew: () => void; onImport: () => void }) => (
    <div data-testid="mock-choice">
      <button type="button" onClick={onCreateNew}>mock-pick-create</button>
      <button type="button" onClick={onImport}>mock-pick-import</button>
    </div>
  ),
}));

vi.mock('./create-vault-view.js', () => ({
  CreateVaultView: ({ onVaultCreated, onBack }: { onVaultCreated: () => void; onBack?: () => void }) => (
    <div data-testid="mock-create-view">
      <button type="button" onClick={onVaultCreated}>mock-trigger-vault-created</button>
      {onBack ? <button type="button" onClick={onBack}>mock-create-back</button> : null}
    </div>
  ),
}));

vi.mock('./import-vault-view.js', () => ({
  ImportVaultView: ({ onVaultImported, onBack }: { onVaultImported: () => void; onBack?: () => void }) => (
    <div data-testid="mock-import-view">
      <button type="button" onClick={onVaultImported}>mock-trigger-vault-imported</button>
      {onBack ? <button type="button" onClick={onBack}>mock-import-back</button> : null}
    </div>
  ),
}));

describe('OnboardingFlow (B5.4.3)', () => {
  it('initially renders OnboardingChoice (not CreateVaultView or ImportVaultView)', () => {
    render(<OnboardingFlow onVaultReady={vi.fn()} />);
    expect(screen.getByTestId('mock-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-create-view')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-import-view')).not.toBeInTheDocument();
  });

  it('clicking "create" on the choice screen renders CreateVaultView', () => {
    render(<OnboardingFlow onVaultReady={vi.fn()} />);
    fireEvent.click(screen.getByText('mock-pick-create'));
    expect(screen.getByTestId('mock-create-view')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-choice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-import-view')).not.toBeInTheDocument();
  });

  it('clicking "import" on the choice screen renders ImportVaultView', () => {
    render(<OnboardingFlow onVaultReady={vi.fn()} />);
    fireEvent.click(screen.getByText('mock-pick-import'));
    expect(screen.getByTestId('mock-import-view')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-choice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-create-view')).not.toBeInTheDocument();
  });

  it('propagates onVaultReady when CreateVaultView fires onVaultCreated', () => {
    const onVaultReady = vi.fn();
    render(<OnboardingFlow onVaultReady={onVaultReady} />);
    fireEvent.click(screen.getByText('mock-pick-create'));
    fireEvent.click(screen.getByText('mock-trigger-vault-created'));
    expect(onVaultReady).toHaveBeenCalledTimes(1);
  });

  it('propagates onVaultReady when ImportVaultView fires onVaultImported', () => {
    const onVaultReady = vi.fn();
    render(<OnboardingFlow onVaultReady={onVaultReady} />);
    fireEvent.click(screen.getByText('mock-pick-import'));
    fireEvent.click(screen.getByText('mock-trigger-vault-imported')); 
    expect(onVaultReady).toHaveBeenCalledTimes(1);
  });

  it('does not call onVaultReady before any user action', () => {
    const onVaultReady = vi.fn();
    render(<OnboardingFlow onVaultReady={onVaultReady} />);
    expect(onVaultReady).not.toHaveBeenCalled();
  });

  it('clicking back from CreateVaultView returns to choice screen', () => {
    render(<OnboardingFlow onVaultReady={vi.fn()} />);
    fireEvent.click(screen.getByText('mock-pick-create'));
    expect(screen.getByTestId('mock-create-view')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-create-back'));
    expect(screen.getByTestId('mock-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-create-view')).not.toBeInTheDocument();
  });

  it('clicking back from ImportVaultView returns to choice screen', () => {
    render(<OnboardingFlow onVaultReady={vi.fn()} />);
    fireEvent.click(screen.getByText('mock-pick-import'));
    expect(screen.getByTestId('mock-import-view')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mock-import-back'));
    expect(screen.getByTestId('mock-choice')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-import-view')).not.toBeInTheDocument();
  });
  it('does not call onVaultReady from picking create alone (only from CreateVaultView completing)', () => {
    const onVaultReady = vi.fn();
    render(<OnboardingFlow onVaultReady={onVaultReady} />);
    fireEvent.click(screen.getByText('mock-pick-create'));
    expect(onVaultReady).not.toHaveBeenCalled();
  });
});