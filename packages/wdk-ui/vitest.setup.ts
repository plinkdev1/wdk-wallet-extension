/**
 * vitest setup - imports @testing-library/jest-dom matchers (toBeInTheDocument,
 * toHaveClass, toBeDisabled, etc.) so they're available in every *.spec.tsx
 * without per-file imports.
 *
 * Also registers an afterEach hook calling testing-library's cleanup() which
 * unmounts all rendered React trees and removes them from document.body.
 * REQUIRED when vite.config.ts has test.globals: false - testing-library's
 * auto-cleanup hook only registers when vitest globals are enabled. Without
 * this, each render() call accumulates a tree in document.body and subsequent
 * getByRole/getByTestId calls fail with "Found multiple elements" errors.
 *
 * Loaded by vite.config.ts test.setupFiles.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});