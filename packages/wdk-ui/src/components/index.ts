/**
 * components/* - wallet-specific composite components per Doc 32 Part II.
 *
 * Sub-trees land incrementally:
 *   B5.0a: components/unlock/    (PasswordInput, AdaptiveSpinner, UnlockScreen)
 *   B5.1:  components/onboarding/ (mnemonic display/verify, PasswordSetupScreen, CreateWalletScreen)
 *   B5.2+: components/account/, components/balance/, components/transaction/, etc.
 */

export * from './unlock/index.js';
export * from './onboarding/index.js';
export * from './brand/index.js';
