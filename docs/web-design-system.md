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

| Element                       | Radius                         |
| ----------------------------- | ------------------------------ |
| Inputs, buttons, compact rows | `rounded-control` — 0.625rem.  |
| Cards, sections               | `rounded-panel` — 0.875rem.    |
| Data table header bands       | Control radius; no outer card. |
| Dialogs, sheets, menus        | `rounded-overlay` — 1rem.      |
| Branded/immersive surfaces    | `rounded-feature` — 1.25rem.   |
| Avatars, dots, genuine pills  | `rounded-full`.                |

Controls use solid surfaces and subtle resting borders. Regular panels, editor sections, and summary cards share the semantic `surface-editor` fill, panel radius, and no visible perimeter border, decorative shadow, or backdrop blur. Reserve `shadow-floating` for menus and dialogs. Hover strengthens the control boundary; keyboard focus retains a visible ring. Sheets have straight edges and a dimmed, unblurred backdrop. OLED mode removes
decorative elevation. Glass effects belong to shared elevated panels and overlays.
Canvas, panels, controls, secondary actions, and floating layers use one low-saturation neutral
family. These surfaces stay stable when the accent changes; use accent color for primary actions,
links, focus, and selection. The default page backdrop is transparent, with no global accent wash.
Editor panels are opaque so image backdrops do not tint their fields inconsistently. Light controls
are white on a soft gray panel; dark controls sit one restrained step above their panel.
Dialogs use `surface-dialog`: a soft gray surface in light mode and a darker neutral surface in dark
and OLED modes so controls remain distinct. Menus retain `surface-elevated`. Combobox empty-state
live regions stay mounted; put spacing on the message content so populated menus have no blank row.
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

`PageHeader` owns breadcrumbs and the single page title, with one action slot. The top-level Overview
omits `section` to render without breadcrumbs or an empty breadcrumb gap. Keep `PageContent`
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
and optional structured filtering. Use filter sheets only for page-level datasets with
meaningful facets; embedded or small fixed datasets use search-only mode.

Grids are flat data surfaces. Keep the toolbar unboxed, the table body transparent,
and the header on a quiet semantic editor surface with the shared control radius at all four corners.
Keep that radius consistent with inputs and buttons rather than introducing square header bands.
Use only subtle horizontal separators, with
no perimeter frame, vertical rules, or shadow. Shared cells use compact vertical spacing, including
loading placeholders; hover and selection supply row emphasis. Keep pagination unboxed and table
utilities as ghost actions. Apply this composition to both page-level and embedded grids rather than
adding feature-specific wrappers.

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
an accessible activation label. Read-only metrics/key/value tables use `DefinitionTable`.

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

Account status in user grids is read-only. Put explicit “Disable user…” and “Enable user” actions in the row menu; disabling opens the shared confirmation dialog explaining sign-out and blocked sign-in. Bulk disable uses the same confirmation and skips accounts already disabled. Keep the existing server authorization and last-active-admin protection.

## Standard editors

Use `EditorPage` for ordinary create/edit and settings pages, including their loading states.
The canvas is left aligned and uses the available page width. Its PageHeader keeps breadcrumbs in normal
flow and the title, description, and actions in normal document flow. Workspace editors retain
StandardPage. Dialogs opt into compact form geometry with `data-editor-dialog` and keep footer actions.

Standard sections use the rounded, opaque semantic surface-editor panel (soft neutral gray in light,
slightly raised charcoal in dark, and near-black in OLED) with the heading inside,
24px outer padding (16px on mobile), and no row dividers. Keep 24px between sections and
16px between fields. FormField groups the label and description above the control, with a 4px label-to-description gap and a 12px gap before the control. Use its shared 20px label line height rather than feature-specific margins. Validation errors remain below vertical controls; preserve their ARIA associations.
Text and selection controls cap at 40rem; numeric inputs at 12rem. Use SingleSelectCombobox
for searchable catalogs, Select for fixed choices, and MultiSelectCombobox for relationships.
Use FileUploadField for uploads and exact numeric inputs for quantities; sliders remain reserved
for streaming adjustments. Inline compound controls may explicitly opt out of editor field layout.

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
and a sidebar constrained between the application bar and viewport bottom so every destination remains reachable.
Pagination controls wrap within the page on mobile rather than widening the document.

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
Trigger dialogs group identity, workflow/target/profile, and schedule without nested panel surfaces. Keep save
actions in the footer and retain disabled/pending behavior. Workflow and trigger grids show tags with the name
and one last-run result; open full failures on demand. Use ScheduleValue and DateTimeValue for recurrence and
time presentation. Related workflow and app names are ResourceLinks. Run history keeps execution details in its
inspector and preserves the `?run=` selection contract.

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

Container logs have a dedicated `?view=logs` destination beside Overview. Fetch logs only for that destination; the default overview does not render an empty log console or request log data.

App pages use a resource overview with local Overview, Configuration, Activity, Diagnostics,
AI agent, and Workflows links. Keep headers in document flow. Use semantic Notice feedback for lifecycle
state and pending changes. Diagnostics and runtime interaction remain capability- and owner-gated.
Use AppResourceLayout and AppResourceOverviewLayout for ready and loading geometry. Operations
previews are bounded and should show snapshot/refresh semantics. See [Operator console](operator-console.md).

EditorPage supplies EditorFormContext. Section uses that context to apply the shared editor
surface to top-level sections; nested sections stay flat. Advanced expanders stay unboxed and
show their fields in a rounded panel when opened. Dialogs opt in through data-editor-dialog,
retain footer actions, and provide the containing surface themselves: sections inside stay flat,
without another panel background or outer padding. Ready and loading states share these primitives.

App resource views keep the device in AppDeviceLayout alongside the active content, including configuration and profiles. The sticky device pane uses the available viewport height and preserves the display aspect ratio; narrow screens stack content and device. Log source choices size to their labels.

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

Overview Operations uses compact grouped counts with at most five preview rows per group, explicit shown/total text, and accent-colored directory/resource links. Use restrained text for failure descriptions and link to full diagnostics; avoid one full-width error banner per app. Fetch failures remain notices and must not appear as zero failures.

Scheduler uses the shared QuickGlanceCard summary surfaces and flat DataGridWorkspace. Task names open their editor; built-in/custom provenance stays secondary. Combine the last result and timestamp, keep availability on the switch, and avoid repeated name/action labels or enabled badges. Loading reuses the complete scheduler page and column definitions with disabled controls.

Scheduler rows show availability once through the Enabled switch beside the task name. An unscheduled next run is an em dash. Built-in task metadata does not repeat its action label; custom tasks retain action context. Recurrence and time have predictable separate lines; execution timestamps use unambiguous month names and 24-hour local times, with the full timestamp and time zone available on hover and to assistive technology. Failure results open a read-only dialog with the complete error instead of stretching table rows.

The Services inventory uses Service, Status, Connection, and Actions columns. Show endpoint and timeout together; keep optional tuning in its editor. Service names are explicit resource links or edit buttons, with a non-resizable action column that reserves enough space for text and icons. Configuration presence is neutral, while verified health uses semantic status colors. Managed-only inventories omit Save/Reset; editable inventories enable Save only for a changed draft. Dialog Done retains the draft for the page-level Save. Loading shares ServicesGrid and ServicesPageLayout.

Runtime defaults group image selection and registry separately from app behavior and upload limits. Show the deployment-owned API URL as a read-only detail with a copy action, not an editable-looking input. Keep Save and Discard changes tied to a saved baseline; maintain local drafts through maintenance revalidation. Maintenance stays visible as a compact action list on one shared section surface, without nested action cards. Cleanup and restoring defaults are immediate operations with a scoped confirmation, pending state, and success/error feedback. Restoring runtime defaults also resets optional service connections; it does not reset the web-owned app data deletion policy. Link to Scheduler for recurring cleanup. Ready, checking, and route-loading states reuse the same layout and field groups.

Services is the entry point for Connections and Features, using the shared ResourceNavigation on both existing routes. Keep feature management under Services in breadcrumbs and sidebar selection rather than a competing sidebar entry. Connections show disabled or unsupported services as discoverable rows with links to their feature setting; feature gates still protect their editors. Features use readable capability names, one requested-state switch, effective availability, and contextual links back to configuration or tools. Toggles persist immediately with revision checks; connection dialogs retain drafts until Save or Discard changes. Saves send only workflow-owned fields: connections, runtime defaults, or the selected default image, without replaying hidden settings. Keep deployment-managed and unsupported toggles read-only and visibly disabled. Connection status must not imply live health when only an endpoint is configured. Preserve the same navigation, actions, and metadata geometry during loading.

Services lists Orchestrator, Docker, Display, Firewall, and OCR from the same health snapshot used
by the shell indicator. A configured endpoint never substitutes for measured health. Docker combines
engine reachability with runtime suitability. Orchestrator and Docker have resource views at
`/platform/services?service=orchestrator` and `?service=docker`; shell health links point there.
Infrastructure diagnostics and administrator-only operation limits live on the Docker view, with a
link from Overview. Keep limit changes separate from connection drafts and runtime defaults; retain
queues and in-flight work when limits change. Reads and mutations use authenticated BFF routes.

AI provider resources separate Models from Connection through the shared resource navigation. Models show explicit defaults for Device control, Planning, and Screen understanding, a compact registered-model list, and model settings in a flat dialog. Planning also includes device control, matching API normalization; disabling or removing a default previews the first enabled eligible fallback. Purpose assignments describe intended use and must not imply verified model capabilities. Preserve exact model IDs and keep readable display names separate.

Adding a model distinguishes searchable provider discovery, manual ID registration, and Ollama download. Exclude already configured IDs. Registration and download requests save immediately; model settings, availability, removal, defaults, and connection edits stay in the page draft until Save. Block immediate model operations while that draft is dirty, and expose Discard changes. Downloads retain background progress; transient progress-read failures do not mark the server job failed. Connection checks use the saved configuration and are disabled while edits are unsaved. Creation puts name and endpoint essentials first, with protocol and server compatibility in an optional group. Keep credentials masked, provider family separate from transport, and all mutations behind existing authorization.

User and group editors share `AccessEditorLayout` in ready and loading states. User editors separate Account,
Groups, and Permissions & quotas through the shared keyboard-accessible tabs with resource-navigation styling.
Group editors use Details and Permissions & quotas. Tabs retain mounted drafts and search/page state; the header
Save persists the whole editor. Quotas are visible within the access panel, without a disclosure or nested card.
Administrator access and unlimited quotas are explained together, without a redundant quota-only notice.
The Account tab groups identity, password, account status, appearance, and access role in separate shared Section
containers. Group Details keeps name and role together and gives description its own Notes section. These sections
are owned by the same components in ready and loading states, without an enclosing Account card.

Permissions use the shared DataGridWorkspace, DataGrid, and pagination rather than a feature-local table/list.
Search names, descriptions, IDs, categories, and inherited sources; category and override filters combine with
search. Group settings distinguish Grant/Deny/Not set, with Not set removing the stored decision so other groups
can supply access. User rows show effective access, its source, and Inherit/Allow/Deny overrides. Inherit deletes
the override, including explicit false values. Admin access stays read-only without a repeated action column.
Keep cell renderer identities stable so editing a setting preserves keyboard focus. Avoid category-wide mutations
that silently affect hidden search results.

The Groups tab uses a searchable, paginated membership grid, with names, descriptions, priority, and reorder/remove
actions. Edit membership opens a bounded dialog using the shared MultiSelectCombobox, removable chips, and option
descriptions. Cancel discards dialog changes; Apply updates the user draft, and Save persists it. Keep the selected
chip area scrollable so large memberships do not grow the dialog. Preserve stored membership order: later groups'
defined permissions and quotas take precedence, then user overrides apply. Reorder by the full membership order,
including when searched or paginated. When empty, preview the same fallback group as the server. Group editors and
links remain administrator-authorized; do not change grant semantics to imitate another console.

Profile photos use UserAvatarInput with FileUploadField and a real keyboard-accessible picker button, an aligned
preview, inline validation/error feedback, a processing state, and an explicit Remove photo action. Re-selecting
the same file must work. Keep the previous photo on decoding failure and block user Save while processing. Explain
that changes apply only on Save: user editors include the photo in their draft, and the profile dialog has an
explicit Save photo action. Choosing or removing a photo only updates the local preview; closing the profile
dialog discards an unsaved preview. Loading renders the same field geometry.

## Audit activity

Audit log and app activity share one time-first grid and event inspector. Keep the matching-event
count, failure count, and latest timestamp in a compact summary, with retention as a secondary
action on the global audit page. Do not repeat these as dashboard tiles or add a redundant grid
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
