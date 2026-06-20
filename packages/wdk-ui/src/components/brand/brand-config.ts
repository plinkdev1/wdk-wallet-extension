/**
 * @wdk-starter/wdk-ui/components/brand/brand-config
 *
 * Type contract for the brand-identity assets a consumer (extension popup,
 * Template Wallet, eCommerce checkout, downstream fork) exposes through
 * BrandProvider.
 *
 * Sibling to the WdkTheme system: WdkThemeProvider controls colors/fonts/
 * radii/motion/glass (the visual surface); BrandProvider controls the brand
 * identity assets (logo, wordmark, brand name). The two are orthogonal -
 * a fork can change one without the other.
 *
 * The default export DEFAULT_WDK_BRAND is the canonical WDK brand-asset set.
 * Consumers who do not mount a BrandProvider get this back from useBrand()
 * as a graceful fallback. Consumers who mount BrandProvider with a partial
 * override get the partial merged on top of DEFAULT_WDK_BRAND.
 *
 * Asset URLs are RELATIVE PATHS that the consumer is responsible for
 * deploying (e.g. apps/extension/public/wdk-wordmark.svg is served at
 * /wdk-wordmark.svg). The provider does not load or validate the URLs;
 * it is a pure config surface.
 */

export interface BrandConfig {
  /** Brand display name. Used for accessibility fallbacks and document titles. */
  readonly name: string;
  /**
   * URL of the full wordmark (typically wider than tall, e.g. "WDK" wordmark).
   * Used on welcome / header / hero surfaces. Optional: a consumer that does
   * not have a wordmark asset can omit this and conditional rendering at the
   * use site will skip the wordmark slot.
   */
  readonly wordmarkSrc?: string | undefined;
  /** Alt text for the wordmark image. Defaults at the use site to brand.name. */
  readonly wordmarkAlt?: string | undefined;
  /**
   * URL of the master mark / icon (typically square, e.g. Bold W).
   * Used on compact surfaces (unlock screen, toolbar, button badges).
   * Optional: same rationale as wordmarkSrc.
   */
  readonly markSrc?: string | undefined;
  /** Alt text for the master mark image. Defaults at the use site to brand.name. */
  readonly markAlt?: string | undefined;
}

/**
 * Canonical WDK brand-asset set. Used as the default value of the
 * BrandContext, and as the merge base when BrandProvider receives a
 * partial override.
 *
 * Paths assume the consuming product deploys these assets at the
 * referenced URLs. The WDK browser extension deploys them to
 * apps/extension/public/ which Vite copies verbatim to dist root,
 * so they are served at /wdk-wordmark.svg and /wdk-mark.png from
 * the popup HTML.
 *
 * Downstream forks (Bounty 2 Template Wallet, Bounty 3 eCommerce,
 * private rebrands) DO NOT need to keep these paths - they pass
 * their own BrandConfig to BrandProvider and useBrand() returns
 * the override.
 */
export const DEFAULT_WDK_BRAND: BrandConfig = {
  name: 'WDK',
  wordmarkSrc: '/wdk-wordmark.svg',
  wordmarkAlt: 'WDK',
  markSrc: '/wdk-mark.png',
  markAlt: 'WDK Wallet',
};