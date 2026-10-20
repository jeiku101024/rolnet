# ROLNET design foundation

ROLNET uses an **operations ledger** direction: a warm paper-like work surface, compact rows, visible rules, and a small number of deliberate controls. Lists and tables carry the hierarchy. Cards, gradients, and ornamental shadows are not part of the foundation.

## Brand assets

The supplied assets in `public/brand/` are:

- `apple-touch-icon.png`
- `favicon.ico`
- `favicon.svg`
- `icon-192.png`
- `icon-512.png`
- `rolnet-icon.svg`
- `rolnet-logo.png`
- `rolnet-logo.svg`
- `rolnet-mark.svg`

The SVG source files contain the same brand palette. The application uses the assets without redrawing, recoloring, or distorting them:

- `rolnet-mark.svg`: compact tricycle mark for the mobile app header.
- `rolnet-logo.svg`: full mark and wordmark for the desktop header and sign-in screen.
- `rolnet-icon.svg`: square app icon and favicon source.

Clear space is at least one mark-stroke width around every logo edge. The mark is never rendered below 44px in the app header. The full logo is never rendered below 120px wide; the sign-in specimen uses 176px wide.

## Palette

The first four values are extracted directly from the supplied SVG assets:

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `--color-brand` | `#FFC72C` | Primary action fill, active navigation, key highlights | `#0F1B2D` on brand: 11.08:1 |
| `--color-brand-dark` | `#1B2A41` | Brand text, rules with emphasis, dark header treatments | On `#FFFCF3`: 14.08:1; on white: 14.44:1 |
| `--color-ink` | `#0F1B2D` | Main text and dense data | On `#FFFCF3`: 16.85:1; on white: 17.28:1 |
| `--color-surface` | `#FFFFFF` | Inputs and document surfaces | `#0F1B2D` on surface: 17.28:1 |
| `--color-canvas` | `#FFFCF3` | Warm neutral page background derived from the logo yellow | `#526174` on canvas: 6.16:1 |
| `--color-rule` | `#D8DEE7` | Thin dividers and table rules | Non-text structural color |
| `--color-muted` | `#526174` | Supporting copy and metadata | On canvas: 6.16:1; on white: 6.32:1 |
| `--color-focus` | `#7A4B00` | Focus rings and accessible links on light surfaces | On canvas: 7.22:1; on white: 7.41:1 |
| `--color-ok` | `#246B4A` | Compliant status | On `#E7F3EC`: 5.62:1; on white: 6.41:1 |
| `--color-warn` | `#8A5100` | Expiring-soon status | On `#FFF1D6`: 5.77:1; on white: 6.45:1 |
| `--color-danger` | `#A33F3B` | Expired or overdue status | On `#FBE9E8`: 5.38:1; on white: 6.30:1 |

The yellow brand accent never carries white text. Status colors are deliberately separate from the brand accent and always appear with an icon and a text label; color is never the only status signal.

## Typography

- Geist Sans is the UI family: labels, headings, navigation, helper copy, and controls. It follows the supplied reference’s compact documentation-style grotesk.
- Geist Mono is the data family: body numbers, plate numbers, dates, and peso amounts.
- Data uses tabular figures for vertical scanning and reconciliation.
- The scale is `0.75rem`, `0.875rem`, `1rem`, `1.125rem`, `1.75rem`, and `2.25rem`.

## Layout and interaction

- Page horizontal padding is `1rem` on mobile and `2rem` from 768px upward.
- Touch targets are at least `44px` high.
- The base radius is 4px; the control radius is 6px. There are no pill-shaped controls.
- Shadows are absent except for the focus ring. Separation comes from rules and spacing.
- Mobile is a single-column ledger with horizontal table overflow where a data table requires it. Desktop expands into two-column specimen groups.
- Keyboard focus is visible with the darker brand-derived focus color.

## Never do

- Do not use Inter, Roboto, Arial, or generic system fonts.
- Do not put white text on the yellow brand accent.
- Do not use the brand accent to mean warning, expiry, or error.
- Do not communicate status with color alone.
- Do not add gradients, glassmorphism, emoji icons, or decorative shadows.
- Do not put every element in a rounded card.
- Do not use all-caps eyebrow labels as generic decoration.
- Do not use middle-dot strings as a substitute for information hierarchy.
- Do not introduce component-level hex colors, arbitrary font sizes, or arbitrary spacing values; consume the variables in `app/globals.css`.
