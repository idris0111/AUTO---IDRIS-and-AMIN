# AUTO UNIVERSE — Black & Silver × Amber

Active direction confirmed 26 October 2026. This supersedes the former
bright/red and blue marketplace layers. The storefront CSS has been
consolidated into a single system; legacy marketplace/commerce files were
removed.

## Palette and material

Graphite canvas `#0D0F12`, panels `#14171B` / `#191D22`, raised `#20252B`.
Primary type `#F0F1F2`, muted `#9CA4AD`, hairlines `#2B3037`.
**Silver `#CBD0D5`** is the primary accent (actions, metal, focus).
**Amber `#D9A441`** is the secondary accent (discount badges, ratings,
loyalty, kickers, benefit rules) — warm, restrained, never neon.
Semantic colors are subdued: success `#8FBF9F`, danger `#D98F8F`,
warning `#D9B070`.

Light mode mirrors the same roles with warm porcelain surfaces
(`#F3F2EF` canvas, `#353A40` silver-ink, `#9A7328` amber-ink).

## File structure

```
frontend/src/index.css          — Tailwind entry, @theme bridge, base, cockpit icons
frontend/src/styles/tokens.css  — single source of truth (dark + light)
frontend/src/styles/components.css — all storefront components
frontend/src/styles/motion.css  — keyframes + reduced-motion guard
frontend/src/components/cockpit/premium-analytics.css — isolated cockpit layer (.pa-*)
```

`App.tsx` imports only `index.css`, which `@import`s the three style files.
Do not reintroduce parallel CSS layers; extend `components.css`.

## Typography

Manrope 300–800 for display and body (`--font-body`); JetBrains Mono for
SKU, telemetry, kickers (`--font-mono`). Loaded in `frontend/index.html`.
Display headings use weight 650–720 with `-0.045em` to `-0.055em` tracking.

## Signature details

- Asymmetric radii: cards `5px 15px 5px 15px`, hero `4px 22px 4px 22px`.
- Satin-silver primary buttons (light gradient + inset highlight) in dark
  mode; solid ink buttons in light mode.
- Hero photo carries a fine SVG grain overlay and a mono caption chip.
- Product photo fields are graphite studio radials, never white boxes.
- Discount badges and rating stars use amber.
- Vehicle picker fields carry mono step numbers `01–04`.
- Scroll-reveal on home sections via framer-motion `Reveal`
  (`whileInView`, once, guarded by `prefers-reduced-motion`).

## Interaction and motion

Visible focus rings (`--focus-ring`), labelled controls, inline errors.
`motion.css` disables decorative animation under reduced motion; charts
never animate data. Filter changes still query the server; date drafts
apply explicitly.

## Responsive behavior

Store grids: 4 columns desktop, 2 on mobile. Hero copy stacks above the
photo below 767px. Catalog sidebar becomes a dialog below 1024px. Verify
at 320, 390, 768, 1440 and 1920 px before accepting visual changes.

## Data truth

Default monetary unit: TJS. Russian is the primary copy. No invented
addresses, ratings, stock, compatibility or financial performance.
Editorial photographs must not impersonate verified SKU photographs;
missing-image labels remain when real media is absent.

## Acceptance status

`npm run build`, `npm run lint` (pre-existing warnings only) and
`npm test` pass after consolidation. Browser visual QA across breakpoints
and both themes remains the owner's final gate.
