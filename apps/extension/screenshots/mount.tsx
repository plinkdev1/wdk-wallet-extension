import { createRoot } from 'react-dom/client';
import { WdkThemeProvider } from '@wdk-starter/wdk-ui';
import type { ReactNode } from 'react';
export function mount(node: ReactNode): void {
  createRoot(document.getElementById('root')!).render(
    <WdkThemeProvider>
      <div style={{ width: 380, margin: '0 auto', minHeight: 600, background: 'var(--bg)' }}>{node}</div>
    </WdkThemeProvider>,
  );
}
