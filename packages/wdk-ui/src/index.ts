/**
 * @wdk-starter/wdk-ui
 *
 * Shared React component library + theme system for WDK browser wallet products.
 *
 * v0.7 (w-5): Theme picker per Doc 33 Part III.2 - 7 primary swatches x
 *             4 edge styles x 2 modes = 56 composable themes on top of any
 *             base preset. ThemePicker component (controlled) + useThemePicker
 *             hook (localStorage-persisted state). System mode (auto-resolve
 *             via prefers-color-scheme) deferred to v0.8.
 *
 * This commit completes wdk-ui's Phase 1 scope. The track joins B4.4
 * (extension approval popup) as its first consumer.
 *
 * See:
 *   docs/phase-1/wdk-ui-component-library-spec.md (Doc 32)
 *   docs/phase-1/doc32-addendum-theme-expansion-phantom-patterns.md (Doc 33)
 *   docs/phase-1/design-system.md (Doc 16 v2)
 *   packages/wdk-web-core/src/design/tailwind-tokens.ts
 */

export const VERSION = '0.7.0-dev' as const;

export * from './theme/index.js';
export * from './primitives/index.js';
export * from './components/index.js';
export * from './chain/index.js';
export * from './security/index.js';