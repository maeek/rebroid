# Web design system

Standard protected pages, authentication pages, and immersive viewers share semantic tokens,
controls, surfaces, feedback, and accessibility behavior. Features compose these primitives;
they do not define their own visual recipes.

## Tokens and visual hierarchy

Palette variables are private to `apps/web/src/app/globals.css`. Feature code uses semantic utilities.

| Intent          | Tokens                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Canvas and text | `background`, `foreground`, `foreground-muted`, `foreground-subtle`.              |
| Surfaces        | `surface`, `surface-panel`, `surface-band`, `surface-elevated`, `surface-border`. |
| Controls        | `control`, `control-hover`, `control-border`, `control-border-strong`, `ring`.    |
| Selection       | `primary`, `primary-foreground`, `accent`, `accent-foreground`.                   |
| Feedback        | `info`, `success`, `warning`, `danger`, and matching `*-foreground`.              |

Literal colors and raw palette utilities are reserved for brand artwork, media/canvas rendering,
chart series, and user-supplied tags. Use semantic radii and shadows:

| Element                       | Radius                        |
| ----------------------------- | ----------------------------- |
| Inputs, buttons, compact rows | `rounded-control` — 0.625rem. |
| Cards, sections, grids        | `rounded-panel` — 0.875rem.   |
| Dialogs, sheets, menus        | `rounded-overlay` — 1rem.     |
| Branded/immersive surfaces    | `rounded-feature` — 1.25rem.  |
| Avatars, dots, genuine pills  | `rounded-full`.               |

Use `shadow-control`, `shadow-panel`, `shadow-floating`, or `shadow-emphasis`; OLED mode removes
decorative elevation. Glass effects belong to shared elevated panels and overlays.
Ubuntu supports weights 300, 400, 500, and 700; do not synthesize semibold or black. Supporting
UI text is at least `text-xs`.

## Page families

| Family             | Composition                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Standard protected | `StandardPage`, one `PageHeader`, and `PageContent`; add `PageAside` for split workspaces. |
| Authentication     | `AuthPage` owns the branded backdrop and centered form panel.                              |
| Immersive viewer   | `ImmersiveViewerPage` owns full-bleed media and floating controls.                         |

The protected layout owns sidebar offset, `main`, width, and outer gutters. Standard rhythm uses
16 px mobile/24 px desktop gutters, 24 px primary gaps, and a 120 rem maximum width.
Use one `h1`, `h2` for primary sections, and `h3` for nested sections.

`PageHeader` owns breadcrumbs and the single page title, with one action slot. Keep `PageContent`
a vertical stack; responsive columns belong to a child grid with explicit `minmax()` tracks.
Do not repeat outer padding or use fractional flex sizing for primary columns.

## Surfaces and feedback

Use `Surface` levels `panel`, `band`, `floating`, or `control` with semantic tones. Sections use
`plain` for spatial grouping, `band` for nested grouping, and `panel` for primary bounded content.

- `Section.headingSpacing` owns heading rhythm: `none`, `compact` (8 px), or `default` (16 px).
  Put helper copy in `Section.description`, not feature-local title padding.
- `StatusBadge` communicates compact state; `Notice` communicates inline feedback; `StateView`
  covers loading, empty, unavailable, not-found, and error states.
- `Surface` `data-tone` styling is authoritative. Success keeps its visible semantic tint in light,
  dark, and OLED themes. Do not override a toned surface with a neutral background.
- Successful mutations use the success toast variant. Informational toasts are for facts, not completion.
- Page notices and service banners span the content width; badges remain intrinsic.

## Controls and forms

Use shared controls, including their focus and keyboard behavior:

- `Button`: `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`, or `bare`.
  Sizes are `sm`, `md`, `lg`, `icon-sm`, and `icon-md`; icon-only actions need accessible names.
- `MutationButton`: asynchronous actions with pending labels, spinner, disabled state, and `aria-busy`.
- `ConfirmMutationDialog`: destructive row/bulk actions. Name the target/count and consequence,
  keep Cancel before Confirm, and prevent dismissal while pending.
- `FormField`: every labeled control, with explicit `vertical` or `horizontal` layout. It owns
  label association, description, required/error state, and ARIA relationships. Use `band` for standalone toggle rows.
- `MultiSelectCombobox`: searchable multiple relationships, preserving removable chips, option descriptions,
  keyboard behavior, anchored scrolling, and empty state. Do not replace it with an expanded checkbox list.
- `TabsRoot`, `TabsList`, `TabsTrigger`, `TabsPanel`: tabs without feature-local focus/role implementations.

Declare `SelectTrigger` width explicitly. Use a numeric slider only when direct range manipulation
helps the task. Page-form actions belong in the header; dialog actions in the footer. Hidden file
inputs and canvas/media surfaces are the native-control exceptions.

## Grids and loading

Every interactive `DataGrid` uses `DataGridWorkspace` for search, active-filter chips, bulk actions,
and optional structured filtering. Use filter sidebars/drawers only for page-level datasets with
meaningful facets; embedded or small fixed datasets use search-only mode.

Desktop filter sidebars start closed. Keep the filter button, active count/chips, reset, and mobile
drawer usable while the sidebar is closed. Search is debounced without a submit button; filters apply
immediately. Page filters use validated URL state. Do not add column-header filters or separate filter popovers.

Keep column visibility independent. Show bulk actions only for selected visible rows. Use
`DataGrid.rowActivation` for a clear primary row destination, preserving nested controls and providing
an accessible activation label. Read-only metrics/key/value tables use `DefinitionTable`.

Loading belongs to the component that owns ready-state geometry. Reuse shells, responsive grids,
sections, columns, system columns, table markup, and scroll containers; define cell placeholders
through owning column metadata. Known titles, breadcrumbs, headings, and safe actions render
immediately. Keep known search/filter chrome as real disabled UI rather than skeleton blocks.

Route `loading.tsx` files are thin feature entrypoints. Explicit Suspense fallbacks reuse the same
feature loading component. The protected-route matrix remains 36 renderable routes with feature-owned
loaders; the legacy display-sessions redirect is the only loader-free exclusion.

## Responsive behavior and accessibility

Use mobile-first layouts with 640 px and 1024 px breakpoints. Tables own horizontal scrolling;
pages must not overflow the document. Preserve visible focus, keyboard/pointer equivalence,
focus trapping/restoration, appropriate live regions, and reduced-motion behavior. Color cannot
be the only status signal. Public error states show a safe message and request reference only.

When changing a design-system API, migrate every consumer and remove deprecated variants and aliases
in the same change. Do not add feature-local substitutes.
