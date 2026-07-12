# Web design system

Rebroid uses one semantic design system across three page families: standard protected pages, authentication pages, and
immersive viewer pages. The families may compose content differently, but they share the same tokens, controls,
surfaces, feedback, typography, and interaction rules.

## Principles

- Prefer semantic intent over visual recipes. Features select a component variant; they do not assemble their own
  border, background, radius, shadow, and state combinations.
- Keep the current layered and translucent Rebroid identity. Glass effects are reserved for elevated panels and
  overlays, not applied independently by feature code.
- Use one accessible hierarchy: one `h1` per page, `h2` for primary sections, and `h3` for nested sections.
- Keep page rhythm predictable. Standard pages use 16 px mobile and 24 px desktop gutters, a 24 px primary stack gap,
  and a maximum width of 120 rem.
- Do not preserve deprecated visual APIs or aliases. When the system changes, migrate every consumer in the same
  change and delete the old surface.

## Color vocabulary

Palette variables are private to `src/app/globals.css`. Application code uses semantic utilities only.

| Intent          | Tokens                                                                           | Use                                      |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| Canvas          | `background`, `foreground`                                                       | Page background and primary text         |
| Supporting text | `foreground-muted`, `foreground-subtle`                                          | Secondary and tertiary information       |
| Surfaces        | `surface`, `surface-panel`, `surface-band`, `surface-elevated`, `surface-border` | Page regions ordered by elevation        |
| Controls        | `control`, `control-hover`, `control-border`, `control-border-strong`, `ring`    | Inputs and interactive boundaries        |
| Selection       | `primary`, `primary-foreground`, `accent`, `accent-foreground`                   | Primary actions and selected states      |
| Feedback        | `info`, `success`, `warning`, `danger` and matching `*-foreground`               | Notices, status, and destructive actions |

Do not use raw palette utilities, literal hex/RGB/HSL values, or opacity variations invented inside a feature. Literal
colors are allowed only for brand artwork, viewer/canvas rendering, chart series, and user-supplied tag colors.

## Shape, elevation, and type

- `rounded-control` (`0.625rem`): inputs, buttons, compact rows.
- `rounded-panel` (`0.875rem`): cards, sections, tables, empty states.
- `rounded-overlay` (`1rem`): dialogs, sheets, drawers, menus.
- `rounded-feature` (`1.25rem`): branded and immersive feature surfaces.
- `rounded-full`: avatars, status dots, and genuine pills only.
- Use `shadow-control`, `shadow-panel`, `shadow-floating`, or `shadow-emphasis`. Feature-local arbitrary shadows are
  forbidden. OLED mode removes decorative elevation automatically.
- Ubuntu weights are limited to 300, 400, 500, and 700. Use `font-light`, `font-normal`, `font-medium`, or `font-bold`.
  Do not synthesize `font-semibold` or `font-black`.
- Supporting UI text must be at least `text-xs`; arbitrary font sizes are reserved for rendered media, not interface
  labels.

## Surfaces and feedback

Use `Surface` when a feature needs a visual container. Its level is `panel`, `band`, `floating`, or `control`; its tone
is `neutral`, `info`, `success`, `warning`, or `danger`. `Section`, `Card`, overlays, grids, and skeletons use the same
surface recipes.

- `plain` section: grouping established by spacing and hierarchy.
- `band` section: low-emphasis nested grouping.
- `panel` section: primary bounded content group.
- `StatusBadge`: compact state only; never a call to action.
- `Notice`: inline informational, success, warning, or danger feedback.
- `StateView`: loading, empty, unavailable, not-found, and error states at page, section, grid, or immersive scope.

## Controls and forms

- `Button` variants are `primary`, `secondary`, `outline`, `ghost`, `danger`, `link`, and `bare`. `bare` is the
  focus-safe base for custom clickable cards and rows. Do not use raw buttons in feature code.
- Button sizes are `sm`, `md`, `lg`, `icon-sm`, and `icon-md`. Icon-only controls require an accessible name.
- Async submit actions use `MutationButton` so pending labels, spinners, disabled state, and `aria-busy` stay consistent.
- Destructive row and bulk actions always open `ConfirmMutationDialog`. Name the target or selection count, state the
  consequence, keep Cancel before Confirm, and prevent dismissal while the mutation is pending.
- Tabbed interfaces use `TabsRoot`, `TabsList`, `TabsTrigger`, and `TabsPanel`; feature code does not implement its own
  tab roles, roving focus, or arrow-key handling.
- Use `FormField` for every labeled control. It owns the label association, description, required indicator, error,
  `aria-describedby`, and `aria-invalid`. Layout is `vertical` or `horizontal`; use its `band` surface for standalone
  horizontal toggle rows so label, description, control, and padding remain one visual unit. Every call site declares
  the layout explicitly; feature forms never depend on the component default.
- Numeric bounds do not imply a range slider. Use the shared numeric field without its slider when direct range
  manipulation does not improve the task; bounds and blur normalization still apply to the number input.
- `SelectTrigger` is intrinsic-width by default. Every feature call site declares its width explicitly; vertical forms,
  dialogs, and filter panels normally use `w-full`, while compact toolbar controls use a documented fixed width.
- Form actions live in the page header for page forms and in the footer for dialogs. Do not create a second save bar.
- Hidden file inputs and canvas/media surfaces are the only native-control exceptions.

## Page families

### Standard protected pages

The protected route layout owns the sidebar offset, `<main>`, minimum height, and maximum width. A page uses
`StandardPage`, one `PageHeader`, and `PageContent`. Split workspaces add `PageAside`; pages never repeat outer gutters.
`PageContent` remains a vertical content stack. Responsive page columns belong in a full-width child grid with explicit
`minmax()` tracks; do not switch `PageContent` to a responsive flex row or size primary columns with fractional flex.

`PageHeader` accepts `section`, `trail`, `title`, `description`, `leading`, `badges`, and one `actions` slot. It renders
the single page `h1` and builds breadcrumbs from the required section and optional trail. Deprecated breadcrumb-array
and title-prefix APIs do not exist.

### Authentication pages

`AuthPage` owns the branded backdrop and centered form panel. Authentication controls still use the standard fields,
buttons, notices, tokens, and responsive rules.

### Immersive viewer pages

`ImmersiveViewerPage` may use full-bleed media and floating controls. Chrome, tools, alerts, and overlays still use the
standard control, surface, feedback, and focus recipes.

## Data and route states

- Interactive tables use `DataGrid`, ordered as toolbar, bulk actions, table, empty state, and pagination.
- Every interactive grid is composed through `DataGridWorkspace`. It owns the icon search field, active-filter chips,
  contextual bulk actions, and—when appropriate—the collapsible desktop filter sidebar and mobile filter drawer.
  Filter panels are reserved for page-level datasets with meaningful structured facets. Embedded related-resource
  grids and small fixed datasets use the workspace's search-only mode. Features provide domain controls and filter
  state without rebuilding the workspace shell.
- Grid search is debounced and does not use a separate submit button. Structured filters apply immediately. Page-level
  grids keep shareable filter state in validated URL parameters; embedded grids may keep local controlled state.
- Filtering lives in the workspace sidebar rather than column headers. The column visibility menu remains independent
  from filtering, and bulk actions are hidden until one or more visible rows are selected.
- Read-only key/value or metrics tables use `DefinitionTable`.
- Loading UI uses list, detail, form, split, or immersive page-skeleton compositions and must match the route family.
- Loading is a state of the component that owns the final geometry. Page shells, responsive grids, table columns,
  scroll containers, sections, and control groups must not be reimplemented in a parallel skeleton component.
- Render known breadcrumbs, titles, descriptions, headings, and safe actions immediately. Mask only values and regions
  that genuinely depend on pending data.
- `DataGrid` loading states use the same `ColumnDef` values, system columns, table markup, and column metadata as ready
  states. Do not copy column widths or add placeholder action columns in `loading.tsx` files.
- Search and filter chrome remains real, disabled UI during loading. Do not replace known search icons, filter labels,
  or workspace geometry with anonymous skeleton blocks.
- Route `loading.tsx` files are thin feature entrypoints. Layout markup belongs to the feature's geometry-owning loading
  state, which is also used by explicit Suspense fallbacks.
- Natural-height result changes and conditional notices may reflow later content, but corresponding shells, controls,
  columns, and visible row slots must remain aligned during loading replacement.
- Page-level notices and service-status banners span the available content width; compact badges remain intrinsic.
- Error UI displays a safe public message and request reference only. It must not render raw backend errors.

## Responsive and accessibility constraints

- Design for mobile first; standard breakpoints are 640 px and 1024 px.
- Pages must not create horizontal document overflow. Tables own their local scrolling.
- Every interactive element has a visible focus state and keyboard behavior equivalent to pointer behavior.
- Dialogs, sheets, drawers, menus, and popovers preserve focus trapping and restoration from the shared primitive.
- Status updates use an appropriate live region. Color is never the only state signal.
- Motion respects `prefers-reduced-motion`; branded animation must remain optional.

## Review checklist

- Does the page use one documented page family and exactly one `h1`?
- Are outer gutters, width, and vertical rhythm owned by page components?
- Are all colors, radii, shadows, and state tones semantic?
- Are panels built with `Surface`, `Section`, `Card`, `DataGrid`, or `StateView` rather than class recipes?
- Are fields represented by `FormField` and actions by `Button`?
- Are loading, empty, unavailable, error, and destructive states represented consistently?
- Do loading and ready states share the same geometry-owning component rather than duplicate layout classes?
- Are all literal-color or native-control exceptions within the documented categories?
