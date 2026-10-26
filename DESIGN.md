# AUTO UNIVERSE — Black & Silver Automotive

Active direction from the user's request on 25 October 2026. This supersedes
the former bright/red Modern Precision direction. Preserve the existing identity
until the exact AUTO PRIME artwork and naming are supplied; do not claim a match
to an image that is unavailable.

## Palette and material

Graphite canvas #0B0D10, panels #12161B / #171C22, raised controls #232830.
Primary type #F7F8FA, muted type #A4ADB8, hairlines #2A313A, strong borders #414B56.
Silver #C7CDD4 is the primary accent. Metallic gradients belong on small action
surfaces, never across every panel. Avoid neon, saturated brand highlights and
decorative financial numbers. Semantic stock/error colors remain subdued.

The existing `frontend/src/black-silver.css` is now imported after legacy styles.
The analytics workspace owns scoped `.pa-*` tokens in premium-analytics.css.
Consolidation of legacy CSS needs visual regression checks before removing layers.

## Composition and typography

Storefront: cinematic automotive photography, a strong typographic lead, distinct
vehicle selection and merchandising sections. Preserve the working catalogue,
search and vehicle compatibility APIs. Editorial photographs must not impersonate
verified SKU photographs. Keep missing-image labels when real media is absent.

Analytics: graphite sidebar, narrow workspace header, large figures, restrained
silver lines, precise tables and generous separation between groups. Manrope for
headings/body; tabular figures and monospace SKU detail. Strong hierarchy before
decoration. The UI must remain useful with zero orders and an empty catalogue.

## Interaction

Visible focus rings, labelled form controls, keyboard-accessible native selects
and details, inline errors and retry actions. Dialogs retain the existing focus
management. Recharts includes tooltip/accessibility support and an alternate data
table. Reduced motion disables decorative transitions; charts do not animate data.

Filter changes query the server. Date drafts apply explicitly; presets apply
immediately. Drill-down means a documented cohort of orders containing a category.
No fake controls for unsupported payment or unavailable statistics.

## Responsive behavior

Store product grids retain two mobile columns and four large-screen columns.
Analytics sidebar gives way to wrapped navigation tabs below 900 px. KPI cards
become two columns, graphs stack, and tables scroll inside their own containers.
The entire page must not scroll horizontally. Check at 320, 390, 768, 1440 and
1920 px in a real browser before accepting this as visually finished.

## Data truth

Default monetary unit: TJS. Russian is the primary copy, with existing tg/en locale
infrastructure retained; full translation of new analytics copy remains pending.
No invented addresses, ratings, stock, compatibility or financial performance.
Order value must never be called settled revenue. Unknown cost, payment and visit
data must remain visibly unavailable. See docs/ANALYTICS_METRICS.md.

## Acceptance status

Code builds and backend tests pass. Exact AUTO PRIME comparison and browser visual
QA are still pending: IAB/Edge were unavailable, and native Chrome launch through
computer-use timed out. Existing screenshots are from prior versions and must not
be used as proof that this revision passed visual acceptance.
