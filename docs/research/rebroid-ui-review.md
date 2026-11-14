# Rebroid UI review

14 November 2026

This review records the interface observed on that date. For current behavior, see the
[operator console guide](../operator-console.md) and [web design system](../web-design-system.md).

Rebroid looks most distinctive when the operator can see the Android display, the decisions a workflow will take, or the evidence behind an agent’s result. Some of the interface gives equal weight to routine status, repeated labels, and generic panels. The biggest improvements are in the paths operators use when something goes wrong or when they switch between the device and their work.

## Fix first

### Give viewer failures a way forward

The pop-out says “The app must be running” for every app lookup failure. A stopped runtime, an inaccessible app, and a service failure can therefore lead to the same advice. The session-grant catch has a similar fallback. The splash shows two device motifs and offers no action. The embedded viewer directs people viewing someone else’s app to open a copy even when they lack permission to create one.

Use one recovery treatment with a reason and a permitted next step. For a confirmed stopped app, offer **Open app** to reach its lifecycle controls. For a temporary service failure, offer **Try again** with a request reference if available. For missing or inaccessible apps, provide a safe way back to **Apps** without revealing ownership or existence. Where copying is allowed, use the same label in the gallery, viewer, and confirmation, such as **Copy to my apps**, and explain that it creates a separate app. Put the splash on a semantic surface and check its light-theme contrast. The current fixed black background sits behind theme-dependent text.

[Viewer state](../../apps/web/src/features/applications/viewer/display/display-viewer-page-state.ts#L100) · [Pop-out splash](../../apps/web/src/features/applications/viewer/display/display-viewer-splash.tsx#L18) · [Embedded viewer](../../apps/web/src/features/applications/detail/app-viewer-pane.tsx#L117) · [Copy action permission](../../apps/web/src/features/applications/viewer/actions/app-viewer-actions.tsx#L44)

### Put the selected tool within reach on a phone

Below 1024 px the app layout puts the viewer before the app title, tabs, and work area. In the 390 × 844 touch fixture, a failed display still occupied 700 px, the app heading began at 880 px, and the AI composer began at 1,515 px. The desktop viewer placement control is hidden at those widths. The fullscreen, pop-out, and close buttons in display chrome also have a 30 px height override for coarse pointers.

Prototype a compact app header with a **Device** switch and immediate access to the selected tool. Keep the viewer mounted across switches and preserve scroll and keyboard focus. Give the display controls 44 px touch targets through a taller touch toolbar or overflow for secondary actions. Check this with a portrait display and a running session at 390 px, and test the handoff to the split layout at 1024 px. The repository currently tests viewer-first order, so any change should update that interaction contract deliberately.

[Device layout](../../apps/web/src/features/applications/detail/app-device-layout.tsx#L25) · [Placement control](../../apps/web/src/features/applications/detail/app-viewer-placement-button.tsx#L89) · [Touch override](../../apps/web/src/app/globals.css#L33) · [Current layout contract](../../apps/web/e2e/ai-agent-layout.spec.ts#L10)

### Make navigation match the user’s access

The Apps page checks create permission and the sidebar still exposes **Create app**. The create route presents a form whose mutation can reject the user later. Gallery lifecycle actions also use different conditions from the viewer. Overview links to **All workflows** even when the shell hides the destination and the workflow route returns 404. Its “No active workflow runs” message can also represent a permission-filtered or unavailable read.

Use the same UI capabilities across the sidebar, routes, gallery menus, bulk actions, and app header. Keep server-side authorization. Hide links into disabled catalogs and distinguish a successful zero count from unavailable data. Preserve authorized access to active runs where workflow creation and execution are disabled.

[Sidebar](../../apps/web/src/features/shell/components/protected-navigation.tsx#L92) · [Create route](../../apps/web/src/features/applications/pages/create-app/page-entry.tsx#L12) · [Gallery actions](../../apps/web/src/features/applications/list/components/apps-list-item.tsx#L46) · [Overview links](../../apps/web/src/features/platform/components/platform-operations-content.tsx#L100) · [Active runs query](../../apps/web/src/server/orchestrator/automations/active-workflow-runs-query.ts#L7)

### Separate an agent task’s result from its activity

Every queued prompt says it is waiting for the active run to finish, even when the queue is idle and an operator must choose **Run next**. A failed turn with no visible events can display “Waiting for the agent to start…” alongside the error. “Save as workflow” opens an unsaved draft. The completion event already includes accepted evidence IDs, but the chat renderer displays only response text and puts routine processing activity ahead of it.

Show **Queued behind current task** while busy and **Ready to run** once the oldest prompt can be dispatched. Keep dispatch explicit and name the action **Run next task**. Show stopped-device and missing-model blockers beside the composer with the action the user can take. Rename the drafting action **Draft workflow**. Present a completed result with links to accepted observations already visible to the operator. Collapse routine model and tool activity and keep approvals, failures, and blocked outcomes visible.

[Queue wording and event order](../../apps/web/src/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-chat-events.tsx#L32) · [Run next control](../../apps/web/src/features/applications/viewer/tools/runtime-tools-panel/ai-agent/ai-agent-tools-section.tsx#L164) · [Draft handoff](../../apps/web/src/features/applications/viewer/tools/runtime-tools-panel/ai-agent/use-ai-agent-workflow-draft.ts#L33) · [Completion event](../../apps/orchestrator/src/automations/ai/automation-ai-harness.service.ts#L314) · [Completion renderer](../../apps/web/src/features/applications/viewer/tools/runtime-tools-panel/ai-agent/chat-event-views/chat-event-view.tsx#L26)

## Remove clutter from everyday work

### Let the gallery use real device imagery

The gallery currently uses horizontal cards with a surface fill. Its tests expect that fill, while the design-system guide still describes a transparent launcher with the icon above the name and a visible action menu. The snapshot component returns no content until fetch succeeds, then adds a 128 px area plus margin. A later fetch error can take it away again. In the rendered gallery, “No filters applied” also takes a full row before the first app in the default view.

Keep one compact, stable card layout for browsing and use authentic device thumbnails when they help identify or monitor running apps. Reserve the preview area while a permitted capture loads, or place it in a separate preview that leaves the grid stable. Show the existing capture timestamp and use neutral language when an eligible preview is unavailable. Verify that a user without screenshot access sees no image or preview metadata. Use the filter summary for active chips and clear actions. Decide where the card menu should be visible while idle, then update the guide and tests to match.

[Gallery guidance](../web-design-system.md#app-discovery) · [Card contract](../../apps/web/e2e/apps-gallery.spec.ts#L77) · [Card layout](../../apps/web/src/shared/ui/app-icon/app-gallery-tile.tsx#L12) · [Current snapshot preview](../../apps/web/src/shared/ui/app-icon/app-snapshot-preview.tsx) · [Filter summary](../../apps/web/src/shared/ui/data-grid/data-grid-filter-summary.tsx#L17)

### Make workflow rows say what the workflow does

The outline and inspector repeat type labels such as **Condition**, **Switch**, and **Repeat** after titles with the same wording. A condition summary shows the first operand and operator, omitting the comparison and further rules. Empty branches display both “Drop steps here” and “Drop or add step.” The action inspector puts the action picker above the fields for the action already selected. Failed run details lead with a shortened run ID and can surface a command ID where the operator needs the failed step.

Use sequence and branch indentation to show structure. Give each row an effect or readable predicate, for example **If package is com.example.inventory · 2 more rules**. Give each empty branch one **Add step** action and show the drop cue during a drag. Lead the inspector with the parameter the operator came to edit and keep action replacement as a labeled header control. On a failed run, show the workflow, target, and failed step first, with a direct link to the relevant step or event. Keep identifiers copyable in details. The [workflow step UX review](workflow-step-ux-review.md) covers deeper action-specific changes.

[Step summaries](../../apps/web/src/features/automations/automations-page/steps/shared/automation-step-utils.ts) · [Outline](../../apps/web/src/features/automations/automations-page/steps/outline/automation-step-outline-row.tsx) · [Empty branch](../../apps/web/src/features/automations/automations-page/steps/outline/automation-step-outline-list-view.tsx) · [Inspector fields](../../apps/web/src/features/automations/automations-page/steps/editors/automation-step-editor.tsx) · [Trace title](../../apps/web/src/features/automations/automations-page/traces/automation-traces-page.tsx)

### Spend status color on changes and exceptions

The gallery uses an informational tone for routine provisioning and removal, while the app header uses a warning treatment for those states. App Overview can follow a lifecycle badge with a full notice repeating the same steady status. Feature management repeats an adjustment icon in each row and restates routine states in sentences beneath **Active** and **Off**. The same layout gives a sync failure little additional weight.

Use a shared lifecycle vocabulary across the gallery, sidebar, and app header. Keep state visible once near the resource name. Use a notice for progress that needs explanation, an exception, or the next action. In Feature management, preserve configured and effective state as separate facts, with routine matches quiet and failed or pending synchronization accompanied by its cause and next destination. This uses the existing neutral canvas and semantic tokens.

[Gallery lifecycle tone](../../apps/web/src/shared/ui/app-icon/app-status-indicator.tsx#L4) · [App heading](../../apps/web/src/features/applications/viewer/components/heading.tsx#L12) · [Overview notice](../../apps/web/src/features/applications/detail/app-viewer-status-section.tsx#L16) · [Feature cells](../../apps/web/src/features/platform/features/feature-grid-cells.tsx#L15)

### Make empty screens specific to the situation

Workflows and Triggers replace the grid with a large illustration and repeat the page header’s creation action. The trigger prerequisite state routes to workflow creation even when the missing prerequisite is an app. The empty Apps page uses a second H1 with a different header treatment from the populated page.

Keep the page title and useful search or filter controls stable. Give each state a specific explanation and one next action. Feature management already shows **Clear search** after zero matches, and Apps offers **Clear search and filters**. Apply the same clarity to first use. Link to the missing app or workflow for a new trigger, show one permission-aware creation action for a genuinely empty collection, and use an H2 for the message under the page heading.

[Workflows](../../apps/web/src/features/automations/automations-page/list/automations-list-page.tsx) · [Triggers](../../apps/web/src/features/automations/automations-page/triggers/automation-triggers-table.tsx) · [Feature search](../../apps/web/src/features/platform/features/features-grid.tsx) · [Empty Apps](../../apps/web/src/features/applications/list/components/apps-list-empty-state.tsx)

## Fill the gaps in operational diagnostics

- **Overview should show where to act.** Keep **Recently opened** first. Follow it with compact rows for the few authorized apps or runs that need attention, each with a name, impact, and link. Keep aggregate counts secondary and use the snapshot time in place of “Open a resource for details.” [Current operations section](../../apps/web/src/features/platform/components/platform-operations-content.tsx#L127)
- **Show which display the streaming metrics describe.** A warning identifies its display, but the settings sheet takes the latest sample across all surfaces. With a main and a virtual display open, a warning can sit beside readings from a different display. Select or label the surface for every sample and show its capture time, including collecting and stale states. [Sample selection and issue placement](../../apps/web/src/features/applications/detail/app-viewer-streaming-settings.tsx#L21)
- **Make Docker charts readable at a glance.** The charts have no visible legend or vertical scale and use color by series position. The Errors total and per-operation Errors use different timeout semantics. The history plots cumulative counts, which can look like current activity. Move recent failures above routine counters, show labeled series and units, and define **Errors** and **Timeouts** consistently. Plot per-interval changes or label cumulative totals explicitly. Retain last successful data with its timestamp on a refresh failure. [Dashboard](../../apps/web/src/features/platform/metrics/docker-metrics-dashboard.tsx#L140) · [Charts](../../apps/web/src/features/platform/metrics/docker-metrics-dashboard.tsx#L253) · [Counter history](../../apps/web/src/features/platform/metrics/docker-metrics-history.ts#L15)

## Implementation order

1. **Recovery and access.** Land viewer error states, consistent action visibility, and truthful empty and queued states. Validate owner, limited user, and administrator paths, including stopped, inaccessible, and offline cases.
2. **Device and workflow workspaces.** Prototype the mobile device and tool switch and stable gallery previews. Simplify the outline, inspector, and trace hierarchy in the existing page families. Check long workflows, keyboard focus, touch target sizes, and reduced motion in the viewer.
3. **Evidence and monitoring.** Surface verified agent observations, make Overview exception-led, and fix stream and Docker metric attribution. Exercise two displays, first sample, stale data, and a counter reset. Check shared semantics in light, dark, and OLED.

## Review scope

Three independent passes informed this report. Awesome DESIGN.md used the bundled Linear and Cursor references for restrained controls around the work and clearer presentation of evidence. Design Taste Frontend examined copy, repetition, hierarchy, and interaction feedback in an authenticated console. Frontend Design examined product identity, terminology, responsive composition, and action discoverability. The repository’s existing design system governs the proposed changes. Marketing-page gates and effects were outside the scope of this console review.

The review used current working-tree source and Chromium fixtures at 1440 × 900 and 390 × 844. The browser checks covered the Apps gallery and create form, app Overview and Diagnostics, AI agent, workflow list, editor and failed trace, Feature management, service states, sign-in, and the shell. Search recovery was verified in Apps and Feature management. The README screenshots show earlier layouts. Viewer permissions, real Redroid streams, and live agent and Docker behavior require deployment verification.
