# Web design system

Features compose the shared page, form and grid components. Use this guide to choose a composition.
The components own their dimensions, variants, breakpoints and transitions. Update the shared
primitive when a design change applies across features. [Primitives](../apps/web/src/components/ui) · [Shared layouts](../apps/web/src/shared/ui)

## Page families

| Surface | Composition |
| --- | --- |
| Protected list or workspace | `StandardPage`, `PageHeader` and `PageContent`. The shell supplies the sidebar offset, outer gutters and skip link. |
| Create, edit or settings page | `EditorPage` with a page header and sections. Group related fields in responsive columns. |
| Resource with multiple views | `ResourceNavigation` for routed links with `aria-current`. The feature owns destinations, permissions and query state. |
| Authentication | `AuthPage` and `AuthPanel` share the console identity and theme controls. |
| Standalone viewer | `ImmersiveViewerPage` gives media the full viewport. Scope keyboard capture to the active surface. |

Use one accessible page heading. Breadcrumbs follow the resource’s place in navigation and link back
to its list. Keep page actions reachable when a long resource name wraps. For resource metadata,
use `DetailFields` in both ready and loading views. Use `ResourceLink` for navigable values and
`ApplicationReference` when showing an app name and ID.

## Tokens and visual hierarchy

Use semantic colors, radii and spacing from the [theme stylesheet](../apps/web/src/app/globals.css).
Keep canvas, panels, controls and floating surfaces neutral across accents. Accent identifies actions,
links, focus and selection. Literal colors belong to artwork, media, charts and user-supplied tags.

Use `Surface` for panels, floating layers and controls. Editor sections and summary panels share the
opaque `surface-editor` treatment. Nested groups sit flat within their containing panel. Use
`Section.description` for helper text and `Section.headingSpacing` for its spacing. Status tones come
from the surface and must remain distinguishable in light, dark and OLED themes.

## Controls and forms

Use `FormField` for label, description and error association. Use `Select` for a short fixed choice,
`SingleSelectCombobox` for a searchable catalog and `MultiSelectCombobox` for multiple relationships.
Retain removable selections, option descriptions, empty states and keyboard access. Give file drops a
keyboard-accessible picker. Page actions belong in the header and dialog actions in the footer.

Keep drafts through failed saves and refreshes. Show field corrections beside the input, reveal errors
inside collapsed groups and show the request reference for a server failure. Save only the fields the
editor owns. Reflect the returned saved value before showing success. Use the shared unsaved-changes
dialog when navigation would discard a draft.

Use `MutationButton` for asynchronous actions and `MutationSwitch` for immediately saved toggles.
Keep pending controls disabled and their status accessible. A lifecycle command can be accepted while
the resource is still starting. Show progress until the operation itself reports completion.
Confirmation dialogs identify the target and consequence. Reserve typed confirmation for broad
irreversible actions. Keep the dialog content mounted through dismissal and restore trigger focus.

## Grids and loading

Compose interactive tables with `DataGridWorkspace`. Use search for small or embedded datasets.
Page inventories with meaningful facets can add the shared filter sheet. Keep structured filters
in validated URL state. Keep active filters visible and restore focus to Filters when the sheet
closes. Clearing filters preserves fixed owner and resource scope.

The shared grid owns the unboxed toolbar, quiet header, transparent body and row separators.
Selection swaps the toolbar in place. Keep inactive controls inert. Bulk actions apply to selected
visible rows. Keep failed rows selected after a partial success. Use container width to stack
records on narrow screens or retain horizontal scrolling when comparing columns is the task.
[Grid workspace](../apps/web/src/shared/ui/data-grid/data-grid-workspace.tsx)

The component that renders the ready view owns its loading geometry. Route loaders and explicit
Suspense fallbacks reuse its shell, sections, columns and scroll container. Use column metadata
for cell placeholders and `FormLoadingBoundary` for real field groups. Disable data fetching and
mutations while the form is inert. Scope route loaders to the destination they represent.
Preserve the selected resource view and render known headings and controls immediately.
Mask unknown values, health and availability with neutral placeholders.
[Protected route checks](../apps/web/src/features/loading/protected-route-loading-contract.spec.ts) · [Loading layout tests](../apps/web/e2e/page-loading-layout.spec.ts)

## Surfaces and feedback

Use `StatusBadge` for a compact status, `Notice` for contextual feedback, `StateView` for a missing
or unavailable section or page, and `DataGridEmptyState` for empty results. Distinguish an empty
dataset, a filtered result, denied access and a failed read. Offer the action that addresses that
state. Keep grid recovery controls accessible outside the scrolling table.

Export state artwork for its rendered size and compare the graphite gradients and transparent
edges on light and dark backgrounds. The [shared illustration](../apps/web/src/shared/ui/state-illustration.tsx)
reserves space while loading and reveals the image and its accent together after decoding.

On initial dependency failure, show the shared page failure. On refresh failure, keep the last
successful data and drafts, mark them stale and disable actions that need the service. Independent
diagnostics can remain available. Report successful mutations with the success tone.

## Responsive behavior and accessibility

Keep visible keyboard focus, accessible names for icon controls, associated field errors and touch
targets of at least 44 px. Restore focus after menus, sheets and dialogs. On mobile, Back dismisses
the active overlay before navigating. Keep content readable at narrow widths and under zoom. Honor
reduced motion while keeping status changes visible. Shortcuts supplement visible controls and yield
to text editing, modal dialogs and active device keyboard capture.

For user-facing actions and destinations, see the [operator console](operator-console.md). For
desktop, touch and keyboard examples, see the [browser journeys](../apps/web/e2e).
