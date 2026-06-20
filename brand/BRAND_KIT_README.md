# WDK Brand Kit v2

**Version:** 2.0 (rebuild)
**Date:** May 2026
**Important:** This kit contains ONLY assets derived from user-provided source files. No AI reconstruction. No invented marks. Every file traces back to one of the 8 source assets in `99-source-originals/`.

---

## What's different from v1 (the rejected version)

v1 included an AI-drawn SVG reconstruction of the Bold W master mark that the user objected to.

**v2 commitment:** every asset in this kit comes from the user's actual provided files. Where SVG variants are needed, they're produced by SVG fill color substitution (paths untouched) or viewBox cropping (paths untouched, just changing visible window). Where PNG variants are needed for the Bold W master mark, they're produced by resizing the user's actual PNG #1 — no synthetic drawing.

---

## Canonical brand colors (from source SVG fills)

| Token | Hex | From |
|---|---|---|
| WDK Orange | `#F4642F` | wordmark #3 source SVG |
| WDK Warm Dark | `#161312` | wordmark #3 source SVG |
| WDK Cream | `#F7EEE8` | wordmark #3 source SVG |
| WDK Brown | `#6B3A1E` | bracket interlock #7 source SVG |

These are the canonical brand colors. Replaces the placeholder `#FF5722` previously referenced in design docs.

Other source files use slightly different orange shades (#F7682E, #F78620, #FC7429, #F97322, #FB4A1C) due to being separate AI generations. `#F4642F` is the canonical orange — used for any new component theme tokens or surfaces.

---

## Source-to-product mapping

| Product / Surface | Asset | File path |
|---|---|---|
| Master brand (showcase, GitHub, social) | User's Bold W PNG #1 | `01-master-mark/wdk-master-mark-source.png` + sizes |
| Browser Extension app icon | Same Bold W | `01-master-mark/wdk-master-mark-{32..1024}.png` |
| Template Wallet header | User's wordmark SVG #3 | `02-wordmarks/wdk-wordmark-display-primary.svg` |
| eCommerce checkout ("Powered by WDK") | Bold W small | `01-master-mark/wdk-master-mark-64.png` |
| wdk-web-core npm package | User's isometric cubes SVG #6 (text stripped) | `03-product-marks/wdk-web-core-mark.svg` |
| wdk-ui npm package | User's stacked squares SVG #5 (text stripped) | `03-product-marks/wdk-ui-mark.svg` |
| wdk-protocol-eip3009 npm | User's bracket interlock SVG #7 | `03-product-marks/wdk-protocol-eip3009-mark.svg` |
| wdk-checkout npm | User's bracket arrow SVG #8 | `03-product-marks/wdk-checkout-mark.svg` |
| Favicon (universal) | Bold W resized | `04-icons/favicon.ico` |

---

## File inventory

```
01-master-mark/                              # User's Bold W PNG (resized only)
├── wdk-master-mark-source.png               # User's original PNG #1 (untouched)
├── wdk-master-mark-{32,64,128,256,512,1024}.png  # Resized variants
├── wdk-master-mark-alt-source.png           # Alternative #2 (triple-stripe)
└── wdk-master-mark-alt-{256,512,1024}.png

02-wordmarks/                                # User's wordmark SVGs (color variants via fill swap only)
├── wdk-wordmark-display-primary.svg         # User's SVG #3 unchanged
├── wdk-wordmark-display-primary-{256,512,1024}.png
├── wdk-wordmark-display-transparent.svg     # Same paths, dark bg removed
├── wdk-wordmark-display-transparent-{512,1024}.png
├── wdk-wordmark-display-on-light.svg        # Same paths, cream→dark text swap
├── wdk-wordmark-display-on-light-{512,1024}.png
├── wdk-wordmark-display-mono-white.svg      # Same paths, all white
├── wdk-wordmark-display-mono-white-{512,1024}.png
├── wdk-wordmark-display-mono-black.svg      # Same paths, all black
├── wdk-wordmark-display-mono-black-{512,1024}.png
├── wdk-wordmark-sans-alternative.svg        # User's SVG #4 unchanged
└── wdk-wordmark-sans-alternative-{512,1024}.png

03-product-marks/                            # Per-package marks (text stripped via viewBox crop)
├── wdk-ui-mark.svg                          # User's SVG #5, cropped to exclude "WDK Wallet" text
├── wdk-ui-mark-{256,512,1024}.png
├── wdk-web-core-mark.svg                    # User's SVG #6, cropped to exclude text
├── wdk-web-core-mark-{256,512,1024}.png
├── wdk-protocol-eip3009-mark.svg            # User's SVG #7 unchanged (no text)
├── wdk-protocol-eip3009-mark-{256,512,1024}.png
├── wdk-checkout-mark.svg                    # User's SVG #8 unchanged (no text)
└── wdk-checkout-mark-{256,512,1024}.png

04-icons/                                    # Platform icons (Bold W PNG #1 resized)
├── favicon.ico                              # Multi-size .ico from PNG #1
├── favicon-{16,24,32,48,64}.png             # Individual sizes from PNG #1
├── apple-touch-icon.png                     # 180×180 from PNG #1
├── android-chrome-{192,512}.png             # From PNG #1
├── manifest-icon-{192,512}.png              # From PNG #1
├── manifest-icon-maskable-512.png           # PNG #1 with safe-zone padding on dark canvas
├── og-image-1200x630.png                    # PNG #1 + text labels composited on dark canvas
└── twitter-card-1200x675.png                # Same as OG, different aspect

99-source-originals/                         # Your 8 original files, preserved as-is
├── 01-bold-w-USERS-FAVORITE.png             # The Bold W PNG (your favorite)
├── 02-triple-stripe-alternative.png         # Alternative W
├── 03-wordmark-display-font.svg             # Wordmark with W mark, display font
├── 04-wordmark-sans-serif.svg               # Wordmark with striped square, sans-serif
├── 05-stacked-squares-mark.svg              # Stacked squares (with WDK Wallet text)
├── 06-isometric-cubes-mark.svg              # Isometric cubes (with WDK Wallet text)
├── 07-bracket-interlock-mark.svg            # Bracket interlock
└── 08-bracket-arrow-mark.svg                # Bracket with arrow
```

---

## Transformations applied (auditable list)

Every transformation done to your source files:

**Master mark (Bold W PNG #1):**
- Resized to 32, 64, 128, 256, 512, 1024 via PIL LANCZOS resampling. Original preserved as `wdk-master-mark-source.png`.

**Wordmarks (your SVGs #3 and #4):**
- Original SVG paths preserved exactly. Color variants produced by SVG fill attribute substitution only:
  - `transparent` variant: removed the background rect path (the one with `fill="#161312" d="M0 0..."`)
  - `on-light` variant: same as transparent + swapped `fill="#F7EEE8"` (cream) to `fill="#161312"` (dark) for text legibility on light backgrounds
  - `mono-white` variant: replaced all fills with `#FFFFFF`
  - `mono-black` variant: replaced all fills with `#000000`
- PNG renders via cairosvg.

**Product marks #5 (stacked squares) and #6 (isometric cubes):**
- Original SVG paths preserved exactly. ViewBox attribute changed to crop out the "WDK Wallet" text area:
  - Stacked squares: `viewBox="0 0 1024 1024"` → `viewBox="280 180 460 480"` (shows mark, excludes text)
  - Cubes: `viewBox="0 0 1024 1024"` → `viewBox="360 270 400 240"` (shows mark, excludes text)
- PNG renders via cairosvg.

**Product marks #7 (bracket interlock) and #8 (bracket arrow):**
- No transformations. Originals preserved as-is. PNG renders via cairosvg.

**Platform icons:**
- All favicon and app icon PNGs: PIL LANCZOS resize of your Bold W PNG #1 to platform-required dimensions.
- Maskable Android icon: your PNG #1 placed centered on a dark canvas with safe-zone padding (Android adaptive icon spec).
- OG image and Twitter card: your PNG #1 placed on the left of a dark canvas, with text labels ("WDK", "Wallet Development Kit", "Self-custodial wallet starter") rendered in DejaVu fonts on the right. This is layout composition using your asset as the hero element, not logo manipulation.

---

## What this kit does NOT contain

Explicitly NOT in this kit:

- Any SVG version of the Bold W master mark. The Bold W exists only as your PNG #1 — no vector source was provided. Where vector is needed for the master mark in the future, options are: (a) trace the PNG via vector tool, (b) commission a clean vector redraw, (c) iterate Recraft to produce native SVG output.
- Any invented or AI-drawn logo paths.
- Any color combinations not derived from your source files.
- Decorative additions, effects, drop shadows, or modifications beyond the auditable transformations above.

---

## Usage in repo

See `34_BRAND_IDENTITY_LOCKED_INTEGRATION_PLAN.md` for the integration commit sequence (brand-1 through brand-7) and Dev Agent direction.
