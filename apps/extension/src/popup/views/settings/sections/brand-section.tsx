/**
 * BrandSection - Settings sub-section for brand-identity customization.
 *
 * Thin wrapper around wdk-ui BrandPicker. The brand state is hoisted
 * to App.tsx via useBrandPicker and threaded down through UnlockedRouter
 * -> SettingsView -> this section.
 *
 * The Reset button inside BrandPicker resets to DEFAULT_WDK_BRAND
 * (the canonical WDK assets defined in @wdk-starter/wdk-ui).
 *
 * Source: B0b per user requirement that brand swap must be a UI toggle.
 */

import { BrandPicker, DEFAULT_WDK_BRAND } from '@wdk-starter/wdk-ui';
import type { BrandState } from '../types.js';

export interface BrandSectionProps {
  readonly brandState: BrandState;
}

export function BrandSection({ brandState }: BrandSectionProps): JSX.Element {
  return (
    <BrandPicker
      value={brandState.brand}
      onChange={brandState.setBrand}
      defaults={DEFAULT_WDK_BRAND}
    />
  );
}