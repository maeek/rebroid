# Operator console

Rebroid organizes everyday work around apps and automation runs. Administrative configuration
stays available in expandable sidebar groups. Existing role and capability checks remain authoritative.
Use the desktop sidebar toggle beside the Rebroid wordmark to reclaim the navigation width. The
browser remembers the choice. The Images shortcut opens the builder when the feature is available.
Administrator shortcuts beside Users and Groups open the corresponding creation dialogs.

## Runtime images

Administrators can use **Pull image** above the Images grid to download or update an image from
Docker Hub. Choose **Other registry** and enter a full reference such as `ghcr.io/owner/image:tag`
to pull from another registry. Both options use anonymous access. Successful pulls refresh the
managed image inventory and are recorded in the audit log.

## App lifecycle

- `/apps` shows app failures and in-progress lifecycle operations above the inventory.
- `/app/[id]` opens the resource overview with stored status, configuration, pending runtime changes,
  and relevant destinations. Reading this page does not reconcile Docker or create a viewer session.
- Resource destinations share `/app/[id]?view=<section>`, including `configuration`, `network`, `profiles`, `activity`, `diagnostics`, `ai-agent`, `workflows`, and `files`. The separate viewer window uses `/viewer/apps/[id]`.
- The resource navigation is one row, with permission-based destinations kept consistent across views.
- `?view=activity` displays the audit grid scoped to this application for administrators.
- `?view=diagnostics` exposes permitted logs and backend details. Foreign-owned app interaction
  remains restricted. Error references and technical hints require backend-detail permission.
  Administrators see the container command from Docker inspect, including arguments generated
  by the platform's rendering policy.
- On desktop, scrolling past the top of the embedded live viewer floats a read-only preview. Closing
  it docks the player and preserves your scroll position. The device toolbar opens a clipboard dialog for authorized users.
- Files opens in Downloads. Use the location shortcuts or breadcrumbs to change folders. Uploads,
  including drag-and-drop, go into the current folder.

Creation lands on the resource overview, allowing provisioning to be observed without opening media.
Saved runtime changes are distinguished from the currently active runtime; recreation is reported
as pending until the next start. Lifecycle commands keep their existing server-side authorization.

If Start or Restart cannot recover an app, stop it and choose **Runtime actions → Recreate runtime**.
Rebroid replaces the app container and its network and starts it with the active profile. Persistent
profiles and app settings are kept. Changes stored only in the old container are lost.
Recreate requires ownership and permission to start and stop the app.

## Outbound network access

Use the app's **Network** tab to change where Android can connect. **Approved destinations only**
includes Rebroid's managed destinations and any additional IPv4 addresses or CIDR ranges in the
editable list. Paste entries separated by commas or new lines, or delete entries to remove them.
**Unrestricted** requires internet access permission. **Create app** saves the list with the app.

**Save network access** saves the policy and attempts enforcement for a running app. A stopped app
uses the saved policy on its next start. If the firewall cannot confirm enforcement, the Network
tab shows the last reported state and offers **Retry enforcement** for the saved policy.
Administrators can monitor apps under **Network policies**, open an app's policy from its row,
or use **Sync all rules** to refresh host rules and remove stale entries.

## Workflow device steps

The workflow editor and AI workflow drafting use the registered commands permitted for your
account. Network policy steps manage restrictions and the CIDR allowlist. Deny-list steps
are unavailable.

`android.waitForText` and `android.tapText` match enabled Android UI labels or accessibility
descriptions with tappable bounds. Both use case-sensitive exact matching by default and treat
canonically equivalent Unicode spellings, such as composed and decomposed `Żappka`, as equal.
Set `match: contains` on both steps when a label includes surrounding words. Saved waits that
previously relied on substring matching need this setting. When several nodes match, both commands
choose the first eligible node in the current UI hierarchy.

`assert.textExists` and `assert.textMissing` check the current visible labels and accessibility
descriptions once, using the same Unicode and match modes. They can find disabled labels that
are still visible. To check an XML attribute deliberately, set `source: xml` and `match: contains`.

`timeoutMs` covers target preparation, hierarchy polling, and tap dispatch. A dispatched tap has
up to two additional seconds to acknowledge completion or cancellation. The workflow reports an
uncertain outcome if confirmation is lost. Deploy the orchestrator and display sidecar together
to use the text commands.

Use `android.launchPackage` when the Android package ID is known and the workflow only needs to
launch it. Set `requireSuccess: true` to fail the step if the package is missing or Android rejects
the launch. The default returns `installed` and `launched` outputs for workflows that branch on them.

`vision.observe` exposes `ocrStatus`, `ocrTextCount`, and `ocrDetections` to workflow conditions.
`visionSummary` contains the model's description when one is available.
`maxDetections` limits each returned detection list. `ocrTextCount` reports the total before that limit.
For text drawn on the screen, use `vision.locate` and branch on `outcome`. It reports `found` for a
match, `not_found` when screenshot recognition completes without a match, and `inconclusive`
when the available evidence has no match and screenshot recognition is unavailable. `ocrStatus`
explains whether OCR ran, and each match identifies its source.
Hierarchy text matches use visible labels and accessibility descriptions.

When an AI run invokes `vision.locate`, it searches the active snapshot. The next turn can use
the returned candidate IDs until a new screen observation replaces that snapshot.
For a task such as “Open Żappka,” the agent can look up the visible label and discover installed
packages. The run's **Device agent started** event lists the tools selected for the task.
To let a workflow's AI step perform optional actions such as file deletion or network policy
changes, grant the specific capability in that step.

The visual AI step editor preserves YAML settings, including conversation context and model IDs.
Open the AI step to change its agent mode or read-only shell escalation policy.

An action can use an earlier step's output through the field's **Source** selector or a
`$ref` in YAML. The input and output must have the same scalar type. A branch can use earlier
steps in its own scope and the outputs of its enclosing condition or switch. If a selected
output is missing at runtime, the receiving step fails before dispatch.

```yaml
- id: tap-match
  uses: android.tapNormalized
  with:
    x:
      $ref: { source: stepOutput, stepId: locate, outputKey: centerX }
    y:
      $ref: { source: stepOutput, stepId: locate, outputKey: centerY }
```

Place the tap after `vision.locate` and use a condition to check that its search outcome is
`found` before tapping. To copy a file, use `android.pullFile`'s `contentBase64` output in the
corresponding `android.pushFile` input.

Action outputs include `commandOutcome`. A completed step can report a negative observation
such as `not_found`, an unsupported operation, or an uncertain result. Branch on that output
when the command reports an outcome for the workflow to handle.

## Automation investigation

Workflow Run history opens the existing traces URL. Activate a row to inspect its persisted failure,
step results, target, profile, and recorded events. `?run=[id]` provides a shareable selection; an older
run is loaded independently of the latest 50 only after checking ownership and workflow membership.
The inspector does not retry or cancel a run. Existing live-run controls retain their own authorization.
Historical replay cannot regress a known terminal status to running.
Cancel stops dispatching new commands. If a command has already reached Android, cancellation can take
until the command settles. If the device restarts or switches profiles, the next device command fails
against the original workflow target.

Open an OCR event to inspect the submitted image preview, request settings, response status,
preprocessing passes, and returned text boxes. In the full trace, **Steps → OCR events** filters the
log to that execution of the step. Each event keeps a resized preview and up to 30 detections.

## Workflow history retention

In **Platform settings → Scheduler**, edit **Workflow history retention** to set how many days to
keep finished workflow runs. The built-in task runs daily and defaults to 30 days from completion.
For older finished runs without a completion timestamp, the task uses their last update.
It removes expired runs together with their step results and events, including OCR previews and
responses. The task covers saved workflow runs, including runs of workflows that were later
deleted. Active runs and ad hoc AI conversations are outside its scope.

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
