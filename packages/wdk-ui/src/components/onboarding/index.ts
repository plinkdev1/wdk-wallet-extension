/**
 * components/onboarding - wallet creation UX primitives.
 *
 * Per Doc 32 Part II this folder hosts the screens used during first-run
 * wallet creation. The browser extension popup (CreateVaultView) consumes
 * these via @wdk-starter/wdk-ui in B5.2; the Next.js template wallet will
 * too.
 *
 * v0.1 (B5.1) ships:
 *   MnemonicDisplay      - Pattern B (hidden-default, ack-gated copy)
 *   MnemonicVerify       - Pattern A (mandatory position-typing verification)
 *   PasswordSetupScreen  - new password + confirm + strength meter
 *
 * Not yet shipped (B5.2 / B5.4):
 *   OnboardingFlow       - multi-step composition (create vs import branch)
 *   CreateWalletScreen   - first-screen choice + flow controller
 *   ImportWalletScreen   - paste-mnemonic path
 */

export { MnemonicDisplay } from './mnemonic-display.js';
export type { MnemonicDisplayProps } from './mnemonic-display.js';

export { MnemonicVerify } from './mnemonic-verify.js';
export type { MnemonicVerifyProps } from './mnemonic-verify.js';

export { PasswordSetupScreen, evaluatePasswordStrength } from './password-setup-screen.js';
export type { PasswordSetupScreenProps, PasswordStrength } from './password-setup-screen.js';
export { MnemonicInput, type MnemonicInputProps } from './MnemonicInput.js';
export { MnemonicGrid, type MnemonicGridProps } from './mnemonic-grid.js';
