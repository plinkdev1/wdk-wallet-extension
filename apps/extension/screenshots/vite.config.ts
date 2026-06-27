import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const STUB = here('./stubs/sw-client.ts');
export default defineConfig({
  root: here('.'),
  plugins: [
    { name: 'stub-sw-client', enforce: 'pre', resolveId(s: string) { return (s.endsWith('/lib/sw-client.js') || s.endsWith('/lib/sw-client')) ? STUB : null; } },
    react(),
  ],
  resolve: { alias: [{ find: '@', replacement: here('../src') }] },
  build: { outDir: here('./dist'), emptyOutDir: true, rollupOptions: { input: {
    swap: here('./swap.html'), lending: here('./lending.html'), bridge: here('./bridge.html'),
    buy: here('./buy.html'), 'smart-account': here('./smart-account.html'),
  } } },
});
