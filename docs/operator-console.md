# Operator console

Rebroid organizes everyday work around apps and automation runs. Administrative configuration
stays available in expandable sidebar groups. Existing role and capability checks remain authoritative.

## App lifecycle

- `/apps` shows app failures and in-progress lifecycle operations above the inventory.
- `/app/[id]` opens the resource overview with stored status, configuration, pending runtime changes,
  and relevant destinations. Reading this page does not reconcile Docker or create a viewer session.
- Resource destinations share `/app/[id]?view=<section>`, including `configuration`, `profiles`, `activity`, `diagnostics`, `ai-agent`, `workflows`, `clipboard`, and `files`. The viewer remains at `/viewer/apps/[id]`.
- The resource navigation is one row, with permission-based destinations kept consistent across views. Legacy manage/profile paths and workspace queries redirect to the canonical section URLs.
- `?view=activity` displays the audit grid scoped to this application for administrators.
- `?view=diagnostics` exposes permitted logs and backend details. Foreign-owned app interaction
  remains restricted. Error references and technical hints require backend-detail permission.

Creation lands on the resource overview, allowing provisioning to be observed without opening media.
Saved runtime changes are distinguished from the currently active runtime; recreation is reported
as pending until the next start. Lifecycle commands keep their existing server-side authorization.

## Automation investigation

Workflow Run history opens the existing traces URL. Activate a row to inspect its persisted failure,
step results, target, profile, and recorded events. `?run=[id]` provides a shareable selection; an older
run is loaded independently of the latest 50 only after checking ownership and workflow membership.
The inspector does not retry or cancel a run. Existing live-run controls retain their own authorization.
Historical replay cannot regress a known terminal status to running.

## Platform overview

The administrator overview prioritizes app failures, current lifecycle operations, active workflow
runs, and capacity. Detailed Docker metrics are in a collapsed diagnostics section.
`GET /api/bff/platform/operations` returns bounded previews and totals through the standard operation
result. It requires administrator access, sanitizes app data, and queries active workflow runs only
when both run and management permissions are present. The snapshot refreshes on request; it does not
add background polling. It does not aggregate image builds or retain a global historical job ledger.

Android notifications remain distinct from platform operations. Health popovers identify which
capability an unavailable service can affect and link to the relevant diagnostic destination.

## Layout and verification

Resource pages share the feature-owned AppResourceLayout and overview grid with their route loader.
Page headers remain in normal document flow. Lists and technical workspaces use available width;
configuration forms use the bounded editor canvas. Query-selected app sections use ordinary links
with aria-current; they are navigable destinations rather than local ARIA tab panels.

The gated skeleton-contract-test route includes real app-resource and failed-run fixtures for
responsive/theme checks without provisioning containers or running workflows.

App Activity reuses the administrative audit grid with a fixed application resource ID and type. Search, sorting, pagination, event inspection, and CSV export preserve that scope; resets stay in the app. Global retention and purge actions remain on the administrative audit page, and audit access remains administrator-only.

Diagnostics shows grouped, left-aligned technical details before Application logs. Preserve full identifiers and argument text, wrapping long values and exposing labeled copy actions beside each field label on field hover or keyboard focus (always visible on touch). Failure messaging stays in the page status notice.

Application logs use the same editor section surface and heading spacing as Details. The source is labeled above its selector. Application log output uses a stable viewport with a 20rem minimum, scrolling long output so changing sources does not resize the console.

Streaming quality, transport, and audio open from the device pane in a focused sheet; these controls are no longer a resource section. Diagnostic logs load on entry and source changes; Live controls ongoing refresh only.
