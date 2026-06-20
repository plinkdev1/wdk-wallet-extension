/**
 * @wdk-starter/wdk-ui/components/brand/brand-provider
 *
 * Runtime brand-identity provider. Sibling to WdkThemeProvider; defaults to
 * DEFAULT_WDK_BRAND (canonical WDK assets); downstream consumers override
 * with their own BrandConfig.
 *
 * Usage (WDK extension - the default consumer):
 *
 *   <WdkThemeProvider>
 *     <BrandProvider>                    {/ * no brand prop -> WDK defaults * /}
 *       <App />
 *     </BrandProvider>
 *   </WdkThemeProvider>
 *
 * Usage (Bounty 2 Template Wallet fork):
 *
 *   <WdkThemeProvider theme={myTheme}>
 *     <BrandProvider brand={{
 *       name: 'MyWallet',
 *       wordmarkSrc: '/mycorp-wordmark.svg',
 *       markSrc: '/mycorp-mark.png',
 *     }}>
 *       <App />
 *     </BrandProvider>
 *   </WdkThemeProvider>
 *
 * Usage (consumer with no brand context - useBrand still works):
 *
 *   function MyComponent() {
 *     const brand = useBrand();  // returns DEFAULT_WDK_BRAND
 *     return <img src={brand.wordmarkSrc} alt={brand.name} />;
 *   }
 *
 * Graceful fallback (no provider mounted): useBrand returns DEFAULT_WDK_BRAND.
 * Partial override (BrandProvider receives partial BrandConfig): merge on top
 * of DEFAULT_WDK_BRAND so unspecified fields keep WDK defaults.
 * Nested providers: innermost provider wins (standard React context semantics).
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_WDK_BRAND, type BrandConfig } from './brand-config.js';

const BrandContext = createContext<BrandConfig>(DEFAULT_WDK_BRAND);
BrandContext.displayName = 'WdkBrandContext';

export interface BrandProviderProps {
  /**
   * Brand override. Any unspecified field falls back to DEFAULT_WDK_BRAND.
   * Pass undefined or omit to use full WDK defaults (useful at the root of
   * the WDK extension - the provider is mounted for downstream fork
   * compatibility but the WDK extension itself uses WDK assets).
   */
  readonly brand?: Partial<BrandConfig>;
  readonly children: ReactNode;
}

export function BrandProvider({ brand, children }: BrandProviderProps): JSX.Element {
  // useMemo so consumers do not re-render on every parent render when brand
  // is a stable reference. Merge order: DEFAULT_WDK_BRAND base, then override.
  const value = useMemo<BrandConfig>(
    () => ({ ...DEFAULT_WDK_BRAND, ...brand }),
    [brand],
  );
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

/**
 * Consumer hook. Returns the current BrandConfig from the nearest
 * BrandProvider ancestor, or DEFAULT_WDK_BRAND if no provider is mounted.
 *
 * The graceful-fallback behavior (no throw when called outside a provider)
 * is intentional - it lets primitives and shared components reference brand
 * assets without forcing every consumer to mount a provider.
 */
export function useBrand(): BrandConfig {
  return useContext(BrandContext);
}