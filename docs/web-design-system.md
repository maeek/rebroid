# Web design system

Standard protected pages, authentication pages, and immersive viewers share semantic tokens,
controls, surfaces, feedback, and accessibility behavior. Features compose these primitives;
they do not define their own visual recipes.

## Tokens and visual hierarchy

Palette variables are private to `apps/web/src/app/globals.css`. Feature code uses semantic utilities.

| Intent          | Tokens                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Canvas and text | `background`, `foreground`, `foreground-muted`, `foreground-subtle`.              |
| Surfaces        | `surface`, `surface-panel`, `surface-band`, `surface-elevated`, `surface-border`, `surface-navigation`. |
| Controls        | `control`, `control-hover`, `control-border`, `control-border-strong`, `ring`.    |
| Selection       | `primary`, `primary-foreground`, `accent`, `accent-foreground`.                   |
| Feedback        | `info`, `success`, `warning`, `danger`, and matching `*-foreground`.              |

Literal colors and raw palette utilities are reserved for brand artwork, media/canvas rendering,
chart series, and user-supplied tags. Use semantic radii and shadows:

| Element                       | Radius                         |
| ----------------------------- | ------------------------------ |
| Inputs, buttons, compact rows | `rounded-control` — 0.625rem.  |
| Cards, sections               | `rounded-panel` — 0.875rem.    |
| Data table header bands       | Control radius; no outer card. |
| Dialogs, sheets, menus        | `rounded-overlay` — 1rem.      |
| Branded/immersive surfaces    | `rounded-feature` — 1.25rem.   |
| Avatars, dots, genuine pills  | `rounded-full`.                |

Controls use solid surfaces and subtle resting borders, with fainter outlines in dark and OLED themes. Regular panels, editor sections, and summary cards share the semantic `surface-editor` fill, panel radius, and no visible perimeter border, decorative shadow, or backdrop blur. Reserve `shadow-floating` for menus and dialogs. Hover strengthens the control boundary; keyboard focus retains a visible ring. Sheets have straight edges and a dimmed, unblurred backdrop. OLED mode removes
decorative elevation. Glass effects belong to shared elevated panels and overlays.
Canvas, panels, controls, secondary actions, and floating layers use one low-saturation neutral
family. These surfaces stay stable when the accent changes; use accent color for primary actions,
links, focus, and selection. Protected pages use the neutral canvas background. App icons and
profile photos appear in identity and preview elements. Editor panels are opaque. Light controls
are white on a soft gray panel; dark controls sit one restrained step above their panel.
Dialogs, sheets, and drawers use `surface-dialog`: a soft gray surface in light mode and a darker neutral surface in dark
and OLED modes so controls remain distinct. Menus and popovers use `surface-elevated` with a
muted `surface-border` outline. Use a checkmark and a quiet accent tint for the selected option, and a separate
highlight for keyboard navigation or hover. Combobox empty-state
live regions stay mounted; put spacing on the message content so populated menus have no blank row.

Confirmation dialogs put the action and target in the title, state the immediate impact in the first
sentence, and keep supplemental consequences and resource lists flat. Use a quiet Cancel action and
a specific primary action. Reserve the danger button for destructive operations and typed
confirmation for broad irreversible operations such as purging the audit log. Focus Cancel for
ordinary confirmations, restore trigger focus on dismissal, and keep the footer available when the
body scrolls. While an operation is pending, keep its label visible and block dismissal.
Ubuntu supports weights 300, 400, 500, and 700; do not synthesize semibold or black. Supporting
UI text is at least `text-xs`.

## Page families

| Family             | Composition                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Standard protected | `StandardPage`, one `PageHeader`, and `PageContent`; add `PageAside` for split workspaces. |
| Authentication     | `AuthPage` uses the console wordmark and theme controls. `AuthPanel` contains the form. |
| Immersive viewer   | `ImmersiveViewerPage` owns full-bleed media and floating controls.                         |

The desktop sign-in page sits toward the top of the viewport, with a product introduction and
full-page animated brand backdrop that fades behind the form. The animation pauses offscreen and in hidden tabs,
and shows a still frame for reduced motion. Narrow screens show the introduction and form in
a single column.

The protected layout owns sidebar offset, `main`, width, and outer gutters. Standard rhythm uses
16 px mobile/24 px desktop gutters, 24 px primary gaps, and a 120 rem maximum width.
The desktop sidebar sits in a rounded panel inset 8 px from the window’s top, left, and bottom.
Set `surface-navigation` between the page background and editor panels, without a perimeter border. Keep the
brand and collapse control above the scrollable links. Keep the account, service health, and notifications
at the bottom. Place a compact health chip next to the bell. The status control opens service details on hover, click, or tap.
The popup hides disabled services and reports outages for enabled services.
Animate the desktop sidebar width and content inset together, respecting reduced motion. The collapsed sidebar
is a 64 px icon rail with a status dot above the bell. Footer popups open beside the rail and align
with the bottom edge of their trigger. In the expanded sidebar they open upward. The account Theme submenu uses
the same floating surface and opens toward the center of the viewport from the mobile account menu.
On mobile, the top bar contains the brand and navigation drawer trigger, with the health chip beside the bell in the account controls.
Direct links keep their accessible names
and show labels on hover and keyboard focus. Administration groups start expanded in the desktop sidebar.
The Docker label opens its overview, with a separate chevron for expanding or collapsing its child links.
In the icon rail, groups open labeled flyouts with their destinations and available shortcuts.
Use the circled add icon for sidebar create shortcuts.
Use one `h1`, `h2` for primary sections, and `h3` for nested sections. Skip subheadings that
repeat the page title or active tab. Put page-wide context in `PageHeader.description` and
keep useful section-specific copy in `Section.description` without adding a heading.

`PageHeader` owns breadcrumbs and the single page title, with one action slot. Breadcrumbs share the
same top inset and row height with the viewer, including during loading. The top-level Overview
omits `section` to render without breadcrumbs or an empty breadcrumb gap. Keep `PageContent`
a vertical stack; responsive columns belong to a child grid with explicit `minmax()` tracks.
Do not repeat outer padding or use fractional flex sizing for primary columns.

Use the closest sidebar group as the first breadcrumb, such as Docker, Users & groups, or System.
Use Administration for its direct destinations. Keep the same group and destination labels when a
page is loading or unavailable. Detail pages link back to the destination that lists the resource.

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

Empty and error states use `StateView` at the scope of the missing content. Section states stay
compact and left-aligned; page states use bounded spacing; only immersive viewer states fill their
parent. Page-level unavailable, missing-resource, and unexpected-error states use the shared local
`StateIllustration` artwork: a disconnected server, a searched-for resource, and an interrupted page.
Keep illustrations static, decorative, and neutral across light, dark, and OLED themes. Section and
grid feedback keeps a small icon. Use a concise title, reason, and relevant next step. Avoid decorative
circles, nested cards, viewport-height placeholders inside sections, and raw internal error text.
Unavailable/error states use an alert and preserve request references; empty and not-applicable
states are informational. Preserve the page title and use a level-two feedback heading beneath it.
Service-outage recovery offers retry and Overview rather than implying another runtime-backed list
will be available. Administrator quotas show Unlimited quotas and explain the role rule,
without disabled inputs or misleading save instructions.

Check the owning service before loading dependent page sections. A known orchestrator outage uses
one shared page failure and skips dependent reads, editors, and empty datasets. Failures encountered
after the health check use the same screen; preserve request references and keep authorization and
missing-resource outcomes distinct. Unknown health uses warning tone. On refresh failure, retain
loaded data and drafts with one notice and disable unavailable mutations. Independent host statistics
and reachable service diagnostics remain available during partial outages.

Grid empty states use `DataGridEmptyState`, outside the horizontally scrolling table so the message
and recovery actions remain visible on mobile. Keep headers and search/filter controls available.
An empty dataset explains what belongs there; a filtered dataset offers Clear search and/or Clear
filters through its owning workspace. Never clear a fixed app/owner scope. Keep create actions
permission-aware and avoid duplicating an action already in the page header. On refresh failure,
keep usable existing data and show an inline notice; replace content only when nothing loaded.
Loading remains a neutral skeleton, never a fabricated empty, failure, or successful state.

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
  Give each tab and resource navigation item a decorative icon alongside its text label.

Declare `SelectTrigger` width explicitly. Use a numeric slider only when direct range manipulation
helps the task. Page-form actions belong in the header; dialog actions in the footer. Hidden file
inputs and canvas/media surfaces are the native-control exceptions.

## Grids and loading

Every interactive `DataGrid` uses `DataGridWorkspace` for search, active-filter chips, bulk actions,
and optional structured filtering. Use filter sheets only for page-level datasets with
meaningful facets; embedded or small fixed datasets use search-only mode.

Page-level inventories can opt into `StandardPage`'s `gridToolbar`. On wide page canvases, the
workspace toolbar aligns with the breadcrumbs. Place refresh at the right edge, then search,
then filters and other dataset actions. Empty search starts collapsed and expands on pointer movement
over the control or on focus. An entered query keeps it open. On narrow canvases the workspace keeps
its full search field above the grid.
Keep filter chips by the grid and keep embedded grids, including the app viewer, in their local layout.
Use the same toolbar placement for ready and loading views.

Grids are flat data surfaces. Keep the toolbar unboxed, the table body transparent,
and the header on a quiet semantic editor surface with the shared control radius at all four corners.
Keep that radius consistent with inputs and buttons rather than introducing square header bands.
Keep the rounded header free of rules. Use subtle separators between body rows
and above pagination, with no perimeter frame, vertical rules, or shadow. Shared cells use compact vertical spacing, including
loading placeholders; hover and selection supply row emphasis. Keep pagination unboxed and table
utilities as ghost actions. Apply this composition to both page-level and embedded grids rather than
adding feature-specific wrappers.
Horizontally overflowing grids reserve space below the table for overlay scrollbars.

Selection replaces the search/action toolbar in the same measured grid track; it never inserts a
new bar above the table. Keep both toolbar modes mounted for stable responsive geometry, with the
inactive mode invisible, inert, and hidden from assistive technology. Bulk actions scroll horizontally
on narrow screens instead of wrapping and shifting rows. Selection bars use the same control radius
as the header. Hover, keyboard focus, and selected rows share the same control corner radius. Selected rows use a quiet background tint,
without outlines, accent borders, or inset stripes. Toolbar swaps and selection highlights are immediate;
use ghost bulk actions and `danger-ghost` for destructive bulk actions, reserving filled danger buttons
for confirmation. Active filter chips remain visible in both modes.

Filter sheets start closed and overlay the page without narrowing the table. Sheet backdrops and panels
use coordinated 200ms transitions driven by Base UI starting/ending states; preserve the ending opacity
until unmount so the mask cannot flash back. Respect reduced motion. Keep the filter button, active count/chips, reset, and keyboard focus restoration usable while the sheet is closed. Search is debounced without a submit button; filters apply
immediately. Page filters use validated URL state. Do not add column-header filters or separate filter popovers.
Explicitly cleared URL fields must be removed rather than restored from the previous query. Give every
filter an accessible label and show resource names in active chips, with identifiers as secondary metadata.
Keep whole-dataset actions available without selection. Lock conflicting row and bulk mutations while
pending; on partial failure, retain failed items for retry and apply successful updates to the visible data.

Keep column visibility independent. Show bulk actions only for selected visible rows. Use
`DataGrid.rowActivation` for a clear primary row destination, preserving nested controls and providing
an accessible activation label. Use `DetailFields` for read-only metrics and key/value details.

Loading belongs to the component that owns ready-state geometry. Reuse shells, responsive grids,
sections, columns, system columns, table markup, and scroll containers; define cell placeholders
through owning column metadata. Known titles, breadcrumbs, headings, and safe actions render
immediately. Keep known search/filter chrome as real disabled UI rather than skeleton blocks.
For forms, use `FormLoadingBoundary` around the real field groups to retain labels, descriptions,
compound-control height, and responsive placement. It hides draft controls from assistive technology
and keyboard navigation; it does not stop effects or queries. Loading owners must separately disable
reads and mutations. Route loaders honor known query-selected views (for example provider Connection
or container Logs), including Docker and Orchestrator service details. Profile management retains its
profile-list layout and persistent device pane in both route and inner Suspense fallbacks. Feature
loading reuses the shell manifest for stable names, descriptions, and row count while masking
availability, enabled state, and destinations until refreshed data is ready. Unknown values
remain placeholders rather than zero counts, empty results, or inferred health states.

Loading content is monotone: use neutral surfaces and skeletons for notices, health panels, metric
markers, and resource icons. Use `Notice` with `loading` for notice placeholders so its background
and icon are neutral and it does not announce an unknown status. Semantic info, success, warning,
and error colors appear only with loaded content. Known navigation and safe actions retain their
normal chrome.

Route `loading.tsx` files are thin feature entrypoints. Explicit Suspense fallbacks reuse the same
feature loading component. Scope index-page loaders to a leaf route group when that URL also has
nested pages: the platform overview, provider list, and service inventory must not become fallbacks
for their detail pages. Route groups preserve the public URLs and the shared authorization layout.
Every renderable protected route has a feature-owned loader.

## Responsive behavior and accessibility

Use mobile-first layouts with 640 px and 1024 px breakpoints. Tables own horizontal scrolling;
pages must not overflow the document. Preserve visible focus, keyboard/pointer equivalence,
focus trapping/restoration, appropriate live regions, and reduced-motion behavior. Color cannot
be the only status signal. Public error states show a safe message and request reference only.

Page titles and actions share a row when they fit. Move the action group together when
space is tight and align it with the leading gutter on phones. Wrap within the group only
if needed. Use the same heading row and controls in ready and loading states. Keep Apps search
in one row with the shared Filters drawer and a gear menu for sort order. Use a single grid of
cards sized to match the Recently opened cards on Overview, with the icon beside the name and status. Offer ownership in Filters for admins
and show removable chips for active filters. Keep the desktop Select shortcut off touch and narrow layouts.
Touch users can long-press an app tile and choose Select app. The tile’s visible actions menu
offers the same command for keyboard and pointer users. Selection replaces search controls
with the count, bulk actions, and Done without shifting the tiles. Keep the Apps selection
bar unboxed so its count aligns with the gallery.

Keep the viewport at its natural scale. Shared buttons, tabs, text and selection fields, menu
options, and the viewer control rail use a 44 CSS px minimum touch target for coarse primary pointers. Icons retain
their compact artwork, and editable text fields use 16 CSS px on touch. The [W3C AA minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
is 24 CSS px with exceptions. The 44 px web target balances density with the touch guidance
from [Apple](https://developer.apple.com/design/human-interface-guidelines/buttons) and
[Android](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views).
Inline and standalone viewer layouts use the small viewport height so browser toolbar movement
does not resize the device. The viewer toolbar is 32 CSS px tall, with wider controls on touch
so the toolbar uses less space above the display.

On phones use 24/32 for page titles. For touch layouts use 18/24 for section titles, 16/24
for form labels, values, and primary reading text, and 14/20 for help, errors, buttons, and tabs.
Reserve 12/16 for compact status and metadata. Use weight and color to distinguish roles at the
same size. The [Material 3 type scale](https://developer.android.com/develop/ui/compose/designsystems/material3#typography)
informs this reduced set.

When changing a design-system API, migrate every consumer and remove deprecated variants and aliases
in the same change. Do not add feature-local substitutes.

Account status in user grids is read-only. Put explicit “Disable user…” and “Enable user” actions in the row menu; disabling opens the shared confirmation dialog explaining sign-out and blocked sign-in. Bulk disable uses the same confirmation and skips accounts already disabled. Keep the existing server authorization and last-active-admin protection.

## Keyboard shortcuts

Keep the visible control available to pointer and keyboard users. Show its shortcut in the
shared tooltip with keycaps, and expose it through `aria-keyshortcuts` when enabled.
App pages default to the viewer above the content. At 1024 px and wider, the layout menu and
Alt+Shift+L (Option+Shift+L on Apple keyboards) switch between top and right. Narrow screens
always place the viewer above the content and keep the saved desktop preference.
The shortcut yields to text editing, open menus and dialogs, fullscreen, and Android keyboard
capture. Preserve focus and the mounted viewer when changing its layout.

## Standard editors

Use `EditorPage` for ordinary create/edit and settings pages, including their loading states.
The canvas is left aligned and uses the available page width. Its PageHeader keeps breadcrumbs in normal
flow and the title, description, and actions in normal document flow. Workspace editors retain
StandardPage. Dialogs opt into compact form geometry with `data-editor-dialog` and keep footer actions.

Standard sections use the rounded, opaque semantic surface-editor panel (soft neutral gray in light,
slightly raised charcoal in dark, and near-black in OLED) with the heading inside,
24px outer padding (16px on mobile), and no row dividers. Keep 24px between sections and
16px between stacked fields. Use `gap-x-form-column` (32px) between side-by-side fields or field groups within a section.
FormField groups the label and description above the control, with a 4px label-to-description gap and a 12px gap before the control. Use its shared 20px label line height rather than feature-specific margins. Validation errors remain below vertical controls; preserve their ARIA associations.

Create app keeps the draft on submission failure and focuses a persistent notice above the form.
The notice explains the next step and shows the request ID for server failures. Use structured
validation fields to show corrections at their controls and expand any collapsed group containing an error.
Service outages belong in the notice. An unconfirmed create request stays on the form and directs
the user to All apps before retrying. Only a confirmed app ID opens the resource page.

App resource errors use an illustrated page state with a short explanation and a path back to All apps.
Explain invalid links separately from missing or inaccessible apps. A load failure offers a retry and
a request reference.
Text inputs, text areas, Select, and SingleSelectCombobox fill their assigned field column. Width belongs
to the form layout, not the control type: do not put a hidden maximum width on searchable pickers or
individual text fields. Related fields may share equal responsive columns. Keep numeric inputs capped
at 12rem and toolbar or table-cell controls explicitly sized for their context. Loading controls use
the same field widths as ready controls. Use SingleSelectCombobox
for searchable catalogs, Select for fixed choices, and MultiSelectCombobox for relationships.
Use FileUploadField for uploads and exact numeric inputs for quantities; sliders remain reserved
for streaming adjustments. Inline compound controls may explicitly opt out of editor field layout.

### Personal preferences

The sidebar footer shows service status and notifications above a compact account row.
The account menu offers Preferences, Security, Appearance, and Log out.
Edit your profile in Preferences and manage sign-in in Security.

Theme, accent, and viewer placement apply immediately. Profile photo and sign-in
changes have their own action buttons. Only administrators see Console defaults, linked from Administration → General,
where Save defaults and Restore defaults apply to the shared app-list and viewer defaults.

Schedule editors use labeled Frequency, Time, interval, and day controls. Keep hidden frequency-specific
draft values when switching schedules. Trigger editors use the same searchable Workflow and Target app
choices as other catalogs; call the user-facing resource a workflow rather than alternating with automation.
Trigger identity includes a persisted optional description, searchable in the grid. Workflow choices show
description, step count, and ID; app choices show package/image and ID. Keep selected context visible and
block saving missing resources. Reuse tags from the owner's complete trigger facets and workflows through
MultiSelectCombobox, with explicit creation, case-insensitive duplicate prevention, and a bounded chip area.
Typing a tag search never commits it on blur. Preserve selected tag colors and the 48-character limit.
Profile selectors use a labeled control and the shared destructive confirmation, including the profile name.
Pending saves disable draft controls and prevent dismissal; failures retain the draft for correction or retry.

Page titles and breadcrumb names wrap at narrow widths, including unbroken resource identifiers. Keep header
actions available instead of truncating the resource identity. The standard shell provides a keyboard skip link
and a scrollable sidebar so every navigation destination remains reachable.
Pagination controls wrap within the page on mobile rather than widening the document.
Changing the page size returns to the first page in the same update.

Advanced groups use collapsible Section with optional summary, controlled open/onOpenChange,
and retained mounted draft controls. Collapsed controls are inert; validation errors reveal
the section automatically. Keep essentials and permissions visible.

## Workflow workspace

Workflow editors use StandardPage, with workflow details in one shared panel above the step workspace.
Keep the sequence and selected-step inspector aligned on desktop. On smaller screens, open the inspector
only after an explicit step selection and restore focus on dismissal. Use semantic panel surfaces without
an extra border, shadow, or selection stripe. Expose Visual editor and YAML modes together above the workspace;
keep import/export and deletion in the action menu. Existing workflows share Editor / Run history resource
navigation, including their loading states. Preserve unsaved-change guards on those links.

Use the shared searchable action catalog with FormField associations and Select for fixed action choices.
Trigger dialogs group identity, workflow/target/profile, and schedule without nested panel surfaces. Use side-by-side
groups on wide screens and stack them on narrow screens. Keep footer actions visible while the form scrolls, and
retain disabled/pending behavior. Workflow and trigger grids show tags with the name.
The Workflows grid uses separate Run status and Last run columns, with the trace link beside the timestamp.
A recorded failure links directly to its full-page trace with Summary, Steps, and Events.
Use the viewer's titled summary panel for run metadata and expose the run ID and any recorded request ID.
Use ScheduleValue and DateTimeValue for recurrence and time presentation. Related workflow and app names are
ResourceLinks. Run history preserves the `?run=` selection contract.

The app's Workflows view shows persisted runs for that app in a flat grid. Open a run in the
same content area with Summary and Events, and keep the shared device pane visible. Use the
`?run=` selection and restore the run grid and focus when returning to history.

## Image builders

Google Play and custom Dockerfile builders remain workspaces on `StandardPage`. Use the feature-owned
`ImageBuilderLayout` and `ImageBuilderColumns` in ready and loading states, `ResourceNavigation` for
switching builder modes, and `PlatformResourceSection` for configuration, context, checks, status, and logs.
Keep one Build image action in the page header; show pending, cancel, and result actions in their owned areas.
Use Select for Android versions and starter templates. Selecting a template does not replace a draft until
Apply template is chosen. Saved recipes explicitly describe replacing the current recipe and selected files.

Context selection offers Choose folder and Choose files, shows detected COPY/ADD paths without truncation,
and uses MultiSelectCombobox for uploaded files. Keep manual uploads behind a flat secondary disclosure,
using FileUploadField, a relative context path, and visible progress. Deduplicate missing paths into one
build-blocking notice and group warnings separately. Preserve all existing validation and upload bounds.

Show the current build phase and completed steps without implying elapsed-time percentages. Only a real
build renders logs, using LogsConsole with a stable output height and an optional follow-output control.
Terminal results expose the built image and next actions. Prevent duplicate starts and overlapping polling;
late running responses must never replace terminal or newly selected jobs. Default-image mutations stay scoped
to the image field. Monaco follows semantic surfaces and changes theme without replacing its draft/undo model.

## Resource management

Infrastructure detail pages for containers, images, and networks use `PlatformResourceSection` for their overview, metrics, related resources, logs, labels, and inspect groups. It reuses the rounded editor section surface, padding, and theme tokens. Loading layouts use the same composition.

App and infrastructure summaries use shared `DetailFields`: labels above values, two columns when space permits, full-width technical identifiers and arguments, and copy actions beside labels on hover or keyboard focus. Keep status and ownership badges in the page header rather than repeating them inside detail sections. Detail placeholders use the same component's loading mode.

Container pages put a concise identity/configuration overview first, followed by linked application, image, and network cards in Related resources. Do not repeat those relationships in separate summary tables. Show live metrics only for running containers. Labels use readable key/value fields; raw inspect remains visible in a single `JsonViewer` section with syntax coloring and header-level wrap/copy actions, without a nested surface or disclosure.

`JsonViewer` and runtime argument previews share `CodeViewer` typography, scrolling, and wrap/copy controls. Embed argument previews directly in their existing section. Format shell arguments one per line with safe quoting and continuation backslashes between lines; copying preserves that exact text.

Container logs have a dedicated `?view=logs` destination beside Overview. Fetch logs only for that destination; the default overview does not render an empty log console or request log data.

App pages use a resource overview with local Overview, Configuration, Network, Activity, Diagnostics,
AI agent, and Workflows links. Keep headers in document flow. Use semantic Notice feedback for lifecycle
state and pending changes. Diagnostics and runtime interaction remain capability- and owner-gated.
Use AppResourceLayout and AppResourceOverviewLayout for ready and loading geometry. Operations
previews are bounded and should show snapshot/refresh semantics. See [Operator console](operator-console.md).

EditorPage supplies EditorFormContext. Section uses that context to apply the shared editor
surface to top-level sections; nested sections stay flat. Advanced expanders stay unboxed and
show their fields in a rounded panel when opened. Dialogs opt in through data-editor-dialog,
retain footer actions, and provide the containing surface themselves: sections inside stay flat,
without another panel background or outer padding. Ready and loading states share these primitives.

App resource views share one device pane in AppDeviceLayout, including configuration and profiles. Fit the live display to the available width and height using the stream's observed dimensions. Put streaming settings in the display chrome and device controls in a rail just outside the right edge. The streaming settings sheet uses the dialog surface so controls remain distinct in each theme.

Keep the embedded device frame and streaming settings visible when a session fails to open. Show
the error and a retry action inside the frame.

The Viewer layout menu beside the breadcrumbs switches between the default stacked layout and a right-hand pane. In the stacked layout, breadcrumbs stay first, then the same mounted device pane, then the full-width resource content. The layout menu and Preferences → General share one browser preference, applied on the first render. The app tab bar preserves vertical scroll on navigation. Old Viewer tab links open Overview. The device chrome can open the viewer in a separate window.

The desktop mini player keeps the same live display mounted when the viewer scrolls above the viewport.
Disable input while the preview floats. Closing docks the player, preserves the page scroll position,
and keeps the preview dismissed until the inline viewer returns.
The authorized clipboard dialog belongs in the display toolbar, with explicit read, copy, and send actions.

The embedded Files view opens in Downloads and uses one folder grid with visible location shortcuts, ancestor
breadcrumbs, current-folder search, and column sorting. Upload and New folder act on the current folder.
File details open in a drawer so the grid keeps its width. Log source choices size to their labels.

App Configuration keeps Runtime settings visible as an ordinary section container. Technical Details and Logs belong only in Diagnostics.

The device agent is a viewport-contained workspace on desktop. Its header and resource navigation stay in
normal flow; the transcript owns vertical scrolling and the composer occupies the remaining pane footer.
Do not give the chat another viewport-height calculation beneath the page chrome. Smaller screens stack the
device below a bounded conversation. Ready and loading states reuse AppResourceLayout, RuntimeToolPanelLayout,
and AiAgentConversationLayout. Keep one quiet conversation toolbar, readable neutral message bubbles, and
compact tool/observation disclosures. The empty state shows at most three quiet suggested requests; all
requests remain in the composer’s Suggestions control. Keep conversation export/clear in one action menu.
The composer groups device/setup guidance inside its surface, Suggestions at the left, and a compact model
selector beside the circular send action. Avoid a second row of routine keyboard/timeout metadata. Model
choices open directly as named rows grouped by provider, with a check on the selected model. Keep optional
vision selection and the run time limit in More options, and connection health as a flat footer without
nested cards or duplicate provider badges. Long catalogs offer search. Preserve model and provider IDs
as separate values when selecting a row.
Stopped devices allow drafting but never submission, including keyboard shortcuts. Setup guidance is neutral;
actual run/provider failures remain accessible errors. New output follows only while the reader is near the
bottom, with an explicit Latest messages action after scrolling up; do not animate repeated stream scrolling.

App and container resource navigation share `ResourceNavigation` under `shared/ui`; feature wrappers own destinations and permissions. Resource navigation uses a single overflow-safe row of routed links with aria-current, a quiet semantic background, and a compact active indicator. Use the same section names in navigation, breadcrumbs, and canonical view URLs. Keep device-specific controls next to the device, outside resource navigation.

Resource references in tables and detail content use shared `ResourceLink`: accent color at rest, underline on hover/focus, and a visible keyboard focus ring. Keep secondary metadata muted. Link only values with a known destination; context menus and section navigation retain their own interaction styling.

Application references use `ApplicationReference` with the application name as the primary link and its ID as muted secondary metadata. Resolve names in the authorized server read using one stored application-summary lookup per dataset; never fetch names from individual cells. Missing or deleted applications retain an explicit fallback destination label and the ID.

App diagnostics render container, image, and network references as `ResourceLink` only for administrators, matching infrastructure route authorization. Backend-detail permission alone leaves values as text. Keep copying available independently from navigation.

Runtime resource actions (container Stop/Remove, image Remove, network Remove) belong in the page header beside the title. Overview sections contain resource information. Keep the same action placement during loading and preserve mutation confirmations and disabled states.

Resources pages use `DetailFields` for host and managed-container metadata, matching runtime detail pages. Loading uses those same field components. Summary cards use shared `Surface` panels so dashboards, settings, and resource views follow the same theme treatment. Semantic notices retain their status colors.

Runtime Maintenance and the platform overview’s Infrastructure diagnostics are always-visible sections, with ordinary headings. Do not put these operational destinations behind expanders. Runtime loading reuses the maintenance section with disabled actions.

Overview Operations uses compact grouped counts with at most five preview rows per group, explicit shown/total text, and accent-colored directory/resource links. Use restrained text for failure descriptions and link to full diagnostics; avoid one full-width error banner per app. Fetch failures remain notices and must not appear as zero failures. When no snapshot exists, hide
the operation groups, capacity cards, and their sampling hints. On refresh failure, retain real
values with an explicit stale-data notice. Do not repeat unavailable values beneath an error notice.

Maintenance tasks uses the shared QuickGlanceCard summary surfaces and flat DataGridWorkspace. Task names open their editor; built-in/custom provenance stays secondary. Combine the last result and timestamp, keep availability on the switch, and avoid repeated name/action labels or enabled badges. Loading reuses the complete scheduler page and column definitions with disabled controls.

Maintenance task rows show availability once through the Enabled switch beside the task name. An unscheduled next run is an em dash. Built-in task metadata does not repeat its action label; custom tasks retain action context. Recurrence and time have predictable separate lines; execution timestamps use unambiguous month names and 24-hour local times, with the full timestamp and time zone available on hover and to assistive technology. Failure results open a read-only dialog with the complete error instead of stretching table rows.

Runtime inventory and detail pages use the shared server-side failure classification. An unavailable read retains its
request reference in the page notice. A missing runtime resource offers a return link. Services keeps its selected
infrastructure view and retains an existing connection draft across a failed refresh.

The Services inventory uses Service, Status, Connection, and Actions columns. Show endpoint and timeout together. Service names link to their destinations, and the non-resizable action column reserves enough space for text and icons. Configuration presence is neutral, while verified health uses semantic status colors. Loading shares ServicesGrid and ServicesPageLayout.

Administration → General groups runtime defaults under Image defaults, App behavior, and Hardware Acceleration. The default image picker accepts local images and manually entered references. The runtime pulls a saved image when it is needed and unavailable locally. Show the GPU render device field when Host GPU is selected. All three sections share the page's Save and Discard changes actions. Send changed fields and retain unsaved edits through revalidation. Deployment-managed connection details live in Services. Maintenance stays visible as a compact action list on one shared section surface. Cleanup and restoring defaults are immediate operations with a scoped confirmation, pending state, and success/error feedback. Restore applies to the default image, registry, inactivity timeout, APK upload limit, and optional service connections. Save and Restore use the values returned by the write as the saved baseline. Link to Maintenance tasks for recurring cleanup. Ready, checking, and route-loading states reuse the same layout and field groups.

Services is under System. Feature management is a direct destination under Administration. The Services inventory hides optional services whose features are off or unsupported. Enabled services remain visible during outages, and administrators can manage feature availability on Feature management. Feature gates still protect service editors. Feature management uses readable capability names, one requested-state switch, effective availability, and contextual links back to configuration or tools. Toggles persist immediately with revision checks. Service editors retain drafts until Save or Discard changes. Saves send only the fields owned by each workflow, such as connections, runtime defaults, or the selected default image. Keep deployment-managed and unsupported toggles read-only and visibly disabled. Connection status must not imply live health when only an endpoint is configured. Preserve the same navigation, actions, and metadata geometry during loading.

Services lists Orchestrator, Docker, Display, Firewall, and OCR from the same health snapshot used
by the shell indicator. A configured endpoint never substitutes for measured health. Docker combines
engine reachability with runtime suitability. The Orchestrator view is at
`/platform/services?service=orchestrator`. Docker opens at `/runtime/docker` with the Docker → Overview breadcrumb.
The inventory and shell health links point to these pages. Bookmarks to `/platform/services?service=docker` redirect to the Docker overview.
Casting is a direct Administration destination at `/platform/casting`. The Display service row and
shell health link open Casting. The page shows the service notice, Connection details, and the session grid in that order.
Service details, Casting, and Firewall use `ServiceHealthNotice` for reported health
and its neutral loading state.
OCR perception and Firewall use the same health notice and editable Connection section. OCR also
has a Settings section for recognition. Firewall is a direct Administration destination at
`/security/firewall`, with the Network policies grid below Connection. The Firewall agent service row
and health link open this page. Connection saves and policy sync actions each submit their own changes.
Connection panels and the Services inventory offer **Open Docker container** and **View logs** when the
connection resolves to a container in the deployment. **View logs** opens the container's **Logs** tab,
which reads a bounded log tail on demand. Long port values truncate to one line and expose the full value in a tooltip.
Infrastructure diagnostics and administrator-only operation limits live on the Docker view, with a
link from Overview. Keep limit changes separate from connection drafts and runtime defaults; retain
queues and in-flight work when limits change. Reads and mutations use authenticated BFF routes.
When orchestrator health is missing or offline, the Docker view shows one warning and does not mount
limits or metrics sections or issue their requests. Unknown health uses warning styling, including
inventory badges. Docker-only failures retain these orchestrator-owned diagnostics for investigation.
Refreshing rechecks health and restores dependent sections when the orchestrator responds.
General checks health before reading runtime settings and images. Initial failures use the shared
illustrated page state; retry reloads real saved settings rather than editable fallback defaults.
If a later refresh fails, retain the mounted draft with one warning and disable settings/maintenance
mutations until recovery.
Small administrative policies and limits use a read-only summary with an explicit Edit action and
a focused shared dialog, matching Password policy. Keep labels and descriptions above compact
controls in one column; Save applies the draft and Cancel discards it. Retain failed drafts, show
errors in the editor, and restore focus to Edit after closing. Operation-limit summaries use readable
durations; editing preserves exact milliseconds and existing bounds. Loading reuses the summary
with a disabled Edit action, rather than displaying an editable form.

AI provider resources separate Models from Connection through the shared resource navigation. Models show explicit defaults for Device control, Planning, and Screen understanding, a compact registered-model list, and model settings in a flat dialog. Planning also includes device control, matching API normalization; disabling or removing a default previews the first enabled eligible fallback. Purpose assignments describe intended use and must not imply verified model capabilities. Preserve exact model IDs and keep readable display names separate.

Provider setup shows the selected provider, credentials, and editable base URL first. OpenAI starts with a planning model preset and uses provider generation defaults. Put connection identity, local transport choices, and local generation overrides in collapsed sections. Workflow drafting shows the selected planning model and gives users a setup path when the planner catalog is empty.

Adding a model distinguishes searchable provider discovery, manual ID registration, and Ollama download. Exclude already configured IDs. Registration and download requests save immediately; model settings, availability, removal, defaults, and connection edits stay in the page draft until Save. Block immediate model operations while that draft is dirty, and expose Discard changes. Downloads retain background progress; transient progress-read failures do not mark the server job failed. Connection checks use the saved configuration and are disabled while edits are unsaved. Creation puts name and endpoint essentials first, with protocol and server compatibility in an optional group. Keep credentials masked, provider family separate from transport, and all mutations behind existing authorization.

User and group editors share `AccessEditorLayout` in ready and loading states. User editors separate Account,
Groups, Permissions, and Quotas through the shared keyboard-accessible tabs with resource-navigation styling.
Group editors use Details, Permissions, and Quotas. Tabs retain mounted drafts and search/page state; the header
Save persists the whole editor. Quotas have their own section and tab, separate from the permission table,
without a disclosure or nested card. Explain unlimited administrator quotas in the Quotas tab.
The Account tab groups identity, password, account status, and appearance in shared Section
containers. Group Details keeps the name and description in separate sections. Ready and loading
states use the same sections.

Permissions use the shared DataGridWorkspace, DataGrid, and pagination. Search names,
descriptions, IDs, categories, and inherited sources. Editable group settings distinguish
Grant, Deny, and Not set. The user editor previews effective access and its group source and
displays effective quotas as read-only fields. Keep cell renderer identities stable so editing
preserves keyboard focus.

The Groups tab uses a searchable, paginated membership grid with names, descriptions, priority,
and reorder and remove actions. Edit membership uses the shared MultiSelectCombobox with
removable chips and option descriptions. Cancel discards changes, Apply updates the draft,
and Save persists it. Keep the selected chip area scrollable. Reorder by the full membership order,
including when searched or paginated. Later groups' defined permissions and quotas take
precedence. The built-in Administrators group grants platform administration, full permissions,
and unlimited quotas. An empty membership list grants no group permissions.

Profile photos use UserAvatarInput with FileUploadField and a real keyboard-accessible picker button, an aligned
preview, inline validation/error feedback, a processing state, and an explicit Remove photo action. Re-selecting
the same file must work. Keep the previous photo on decoding failure and block user Save while processing. Explain
that changes apply only on Save: user editors include the photo in their draft, and the profile dialog has an
explicit Save photo action. Choosing or removing a photo only updates the local preview; closing the profile
dialog discards an unsaved preview. Loading renders the same field geometry.

## Audit activity

Audit log and app activity share one time-first grid and event inspector. Keep the matching-event
count, failure count, and latest timestamp in a compact summary. On the global audit page, show
the current retention period beside the latest timestamp and provide a separate Configure retention action.
Do not repeat these as dashboard tiles or add a redundant grid
introduction. Show readable operation names, actor names, target names/types, and outcomes in rows;
keep raw actions, IDs, exact timestamps, request metadata, and structured data in the inspector.
Operation labels describe attempts rather than claiming success. Preserve unknown action vocabulary.
Rows and event-name buttons open the same keyboard-accessible inspector; use shared DetailFields
and JsonViewer there. Avoid identical decorative event icons, repeated taxonomy badges, duplicate
actor names, ISO timestamps beneath formatted times, or literal `none` targets.

Use searchable actor/action filters with labeled inputs, validated URL state, explicit refresh,
scoped CSV export, and the existing shared filter sheet. App activity retains its enforced resource
scope through reset, search, pagination, sorting, and export; global retention/purge actions stay on
the audit page. Loading uses the same summary, toolbar, columns, and page shell.

Derive controls and export from the same validated filters as the results. Date-only filters use
inclusive UTC boundaries, labeled in the controls. Search recognizes readable operation labels as
well as stored action IDs. CSV export preserves filters and current sort order across all pages,
up to 5,000 events; make the cap explicit when more events match. App Activity links require the
same administrator access as the audit loader and export. Keep search drafts through navigation
and reset the event inspector when switching applications.

## App discovery

Apps retains a transparent icon gallery with the icon above its name and quiet status text. Apply a
surface highlight only on hover, keyboard focus, or selection. Use a responsive, bounded tile width
and consistent icon/name/status geometry. Use the shared search/selection workspace for discovery and bulk actions; keep Create app
in the header and a visible keyboard-accessible menu on each tile. Search names, package, image,
owner, and IDs; combine it with status and sorting. Bulk actions target selected visible results only.
Expose failed apps through status filtering instead of repeating their errors above the gallery.
Loading reuses the gallery toolbar, grid, and tile content.

Overview puts a bounded Recently opened row before operational summaries. Use the authenticated
per-user visit history in visit order; exclude deleted and inaccessible apps and do not substitute
unvisited running apps. Keep status secondary to the clickable app name. Loading uses the same
shortcut component; empty and unavailable histories retain access to All apps.
