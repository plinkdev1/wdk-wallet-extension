/**
 * components/unlock - vault unlock UX primitives.
 *
 * Per Doc 32 Part II this folder hosts the screens + atoms used during the
 * lock-state -> unlocked transition. The browser extension popup consumes
 * these via @wdk-starter/wdk-ui; the Next.js template wallet will too.
 */

export { PasswordInput } from './password-input.js';
export type { PasswordInputProps } from './password-input.js';

export { AdaptiveSpinner } from './adaptive-spinner.js';
export type { AdaptiveSpinnerProps } from './adaptive-spinner.js';

export { UnlockScreen, F_VAULT_01_ERROR_STRING } from './unlock-screen.js';
export type { UnlockScreenProps } from './unlock-screen.js';