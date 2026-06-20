/**
 * @wdk-starter/wdk-ui security module
 *
 * Public exports for the security-related UI surface (auto-lock, password
 * change, recovery phrase backup, etc.). Currently houses just the
 * AutoLockSelector; password / recovery components land in future phases.
 */

export { AutoLockSelector } from './auto-lock-selector.js';
export type { AutoLockSelectorProps, AutoLockOption } from './auto-lock-selector.js';