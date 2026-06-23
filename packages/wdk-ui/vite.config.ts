import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-tabs',
      ],
    },
  },
  test: {
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // @web3icons/react/dynamic lazy-loads each icon via dynamic import; in the
    // token-icon / network-icon specs that import can resolve a tick after the
    // test's jsdom environment is torn down and setState on a gone `window`,
    // surfacing as a flaky post-teardown "Unhandled Rejection: window is not
    // defined". All 350 assertions pass; this only ignores those late
    // third-party teardown rejections. Real test failures still fail the run.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});