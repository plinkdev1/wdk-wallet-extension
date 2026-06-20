/**
 * Vitest setup for apps/extension.
 *
 * - @testing-library/jest-dom/vitest extends expect with DOM matchers
 *   (toBeInTheDocument, toHaveAttribute, etc.).
 * - afterEach(cleanup) unmounts React trees rendered via @testing-library/react
 *   so test 1's component doesn't leak into test 2 (L-UI-01 from wdk-ui Phase 1
 *   - cleanup is REQUIRED when globals:false since the auto-cleanup hook only
 *   fires under globals:true).
 *
 * Loaded once per test file via vite.config.ts `test.setupFiles`.
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});