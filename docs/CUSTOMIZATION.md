# Customization — theming & branding

The WDK Wallet is built to be **re-skinned and re-branded without touching
component code**. Everything visual flows from two systems in the shared
`@wdk-starter/wdk-ui` package: a **theme** (colors, type, radius, motion) and a
**brand** (name, wordmark, mark). Both can be set statically at build time *or*
changed at runtime from the in-app Settings, and both persist to `localStorage`.

> TL;DR for developers: wrap your app in `<WdkThemeProvider theme={…}>` +
> `<BrandProvider brand={…}>`, or just open the popup's **Settings → Appearance /
> Brand** and click. Nothing is hard-coded.

---

## Theme system

Defined in `packages/wdk-ui/src/theme/`:

- `types.ts` — the `WdkTheme` contract (colors, fonts, radius, motion, glass, mode).
- `default-themes.ts` — three built-in presets:
  - **`wdkWarmTheme`** — the default (WDK orange `#F4642F`, warm dark surfaces).
  - **`coolDarkTheme`** — purple `#9333EA`, cool surfaces, playful motion.
  - **`institutionalLightTheme`** — light mode, neutral gray.
- `provider.tsx` — `WdkThemeProvider`, which injects the theme as **CSS custom
  properties** (`--color-primary`, `--bg-base`, `--bg-elevated-1/2/3`,
  `--text-primary/secondary/tertiary`, `--border-subtle/default/emphasis`,
  `--color-success/warning/error/info`, …) onto `document.documentElement`.
- `css-variables.ts` — derives the variable set from a `WdkTheme`.

Every component (including all the wallet views and the DeFi/Smart-Account/Buy
screens added later) styles itself **only** through these variables, so changing
the theme restyles the entire app.

### Customizing the theme (code)

```tsx
import { WdkThemeProvider, coolDarkTheme } from '@wdk-starter/wdk-ui';

// A built-in preset…
<WdkThemeProvider theme={coolDarkTheme}>…</WdkThemeProvider>

// …or your own palette (only override what you want):
<WdkThemeProvider theme={{ ...wdkWarmTheme, colors: { ...wdkWarmTheme.colors, primary: '#0D9488' } }}>
  …
</WdkThemeProvider>
```

### Customizing the theme (runtime, in the popup)

Open the corner **gear → Settings → Appearance**:
- **7 primary swatches** × **4 edge styles** (sharp / soft / rounded / pill) × **2 modes** (light / dark).
- A **custom primary** hex input (color picker + `#RRGGBB`).
- **Advanced colors** — per-token hex for `bgBase`, `bgElevated1/2`, `textPrimary`, `textSecondary`.
- **Reset to defaults**.

Persistence keys: `wdk-theme-pref-v1`, `wdk-theme-custom-primary-v1`,
`wdk-theme-custom-colors-v1`.

---

## Brand system

Defined in `packages/wdk-ui/src/components/brand/`:

- `brand-config.ts` — `BrandConfig` (`name`, `wordmarkSrc`, `markSrc`).
- `brand-provider.tsx` — `BrandProvider` + `useBrand()` (falls back to the WDK brand).
- `brand-picker.tsx` — the in-app picker: upload a custom **wordmark** + **mark**,
  edit the brand **name** + alt text, live preview, reset.
- `use-brand-picker.ts` — persists the full `BrandConfig` (assets as data URIs)
  to `localStorage` (`wdk-brand-pref-v1`).

Brand assets ship in `brand/` (master mark in 8 sizes, wordmarks, per-package
product marks, icons/social cards). Swap them by editing `brand/` or by passing
your own `BrandConfig`.

### Customizing the brand (code)

```tsx
import { BrandProvider } from '@wdk-starter/wdk-ui';

<BrandProvider brand={{ name: 'Acme Wallet', wordmarkSrc: '/acme-wordmark.svg', markSrc: '/acme-mark.png' }}>
  …
</BrandProvider>
```

### Customizing the brand (runtime)

**Settings → Brand identity** → upload wordmark/mark, set the name, preview, save.

---

## Shipping without the customization UI

The runtime pickers are gated behind a build-time flag. To ship a fixed-brand
build (no end-user pickers), set `VITE_WDK_CUSTOMIZATION_UI=false` and pass your
fixed `theme`/`brand` to the providers. The customization code is tree-shaken out.

---

## Where it's wired

- Providers + hoisted picker state: `apps/extension/src/popup/app.tsx`.
- Settings UI: `apps/extension/src/popup/views/settings/` (`appearance-section.tsx`, `brand-section.tsx`).
- The same `wdk-ui` theme/brand system powers the **[WDK Wallet Template](https://github.com/plinkdev1/wdk-wallet-template)** — see its `docs/CUSTOMIZATION.md`.
