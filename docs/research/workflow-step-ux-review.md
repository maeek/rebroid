# Workflow step configuration UX review

Design review · 14 November 2026

This review records the editor behavior and proposals at the time of the review. The
[operator console guide](../operator-console.md#build-and-schedule-workflows) and
[workflow design guidance](../web-design-system.md#workflow-workspace) describe the current editor.

This review covers the three supplied screenshots, the current visual editor, and **42 registered actions and three control blocks**. The proposed names, values, and layouts are design recommendations. Gesture behavior, task completion times, and keyboard interactions still need a hands-on pass.

## Start with the selectors and inspector

1. **Use the same visible groups in Add step and Change action.** Add step should open directly to the searchable catalog, including Condition, Switch, and Repeat under **Flow control**. Change action should use that catalog with action entries only. Both should show category headings before typing and keep headings for matching results while searching. Use the permission-filtered catalog, omit empty groups, and keep **Paste block** as a separate Add step menu action. The current Add step menu asks for the block kind first, and the action selector uses category names only as search keywords. [Add step menu](../../apps/web/src/features/automations/automations-page/steps/outline/automation-step-add-row.tsx) · [Action picker](../../apps/web/src/features/automations/automations-page/steps/catalog/automation-action-picker.tsx)
2. **Group by what the author wants to do.** Use a stable order such as **Touch & gestures**, **Text & clipboard**, **Device & apps**, **Timing**, **Flow control**, **Checks**, **Files**, **Screen & vision**, **Network**, **Debugging**, and **AI**. Keep one canonical home per entry. Search labels, category names, descriptions, command IDs, and intent aliases such as “scroll”, “go home”, “app drawer”, “wait”, and “OCR”. Use concise verb-led labels and short descriptions when they clarify a choice. Put permission-gated ADB shell near the end of Device & apps.
3. **Make browsing and replacement predictable.** In Add step, open on the first category and insert the chosen item at the initiating position, including inside a branch. In Change action, show the current item in view with a selected indicator. Arrow keys traverse options across headings, Enter chooses, and Escape restores focus without changing the draft. Replacing an action should be one undoable change. If downstream references break, surface which step and output need repair using the existing reference-error UX. Keep the inspector heading and put **Change action** beside it or in the step menu so the primary field appears at the top. [Action replacement](../../apps/web/src/features/automations/automations-page/steps/editors/automation-step-editor.tsx) · [Workflow workspace](../web-design-system.md#workflow-workspace)
4. **Put output references on the fields they replace.** Offer **Use step output** beside eligible fields, with a searchable list grouped by source step. Show output label, type, and units when relevant. In the field, display a token such as **Locate on screen → First match X**, with a way to reveal the source. Keep the custom form and its validation when a field is linked. Restore the previous literal in the editing session when unlinked, or show an empty required field when there is no previous literal or default. Today, one binding can switch the whole form to the generic schema editor, and unlinking restores the catalog default. Preserve the supported scalar types, branch scope, missing-output behavior, and `$ref` encoding. Nested swipe points currently lack field bindings. [Binding controls](../../apps/web/src/features/automations/automations-page/steps/value-ref/automation-input-bindings.tsx) · [Action editor](../../apps/web/src/features/automations/automations-page/steps/editors/automation-step-editor.tsx) · [Binding rules](../../packages/automation-core/src/command-registry.ts)
5. **Keep the selected step compact and readable.** Keep the sequence and neutral inspector surface. Constrain the form column inside the wide panel, place related inputs near each other, remove repeated **Action** badges, and use the spare width for a preview when it helps. Show the target or main decision first. Put tuning and overrides behind **Advanced**, with a summary when customized. Open that disclosure when a field inside it has an error. Give the outline useful summaries such as **Swipe up · 300 ms**, **Wait for “Żappka” · up to 15 s**, and **Tap “Żappka” · exact label**. A linked field should summarize its source. Mask long or sensitive text and file contents in outline labels. [Inspector header](../../apps/web/src/features/automations/automations-page/steps/inspector/automation-step-inspector-header.tsx) · [Step summaries](../../apps/web/src/features/automations/automations-page/steps/shared/automation-step-utils.ts) · [Workflow workspace](../web-design-system.md#workflow-workspace)

The third screenshot shows a list scrolled into a flat run of network and debugging entries. Visible categories and a current-selection indicator address that orientation problem. The text-wait screenshot shows four **Source for…** rows below four actual settings. Inline references and a timing disclosure would make that inspector primarily about the text target.

For example, an empty **Add step** search shows **Touch & gestures → Swipe direction or relative position, Tap relative position**, followed by **Text & clipboard → Tap text, Type text, Set Android clipboard, Read Android clipboard**. Searching **notification** narrows the list to **Device & apps → Show notifications, Close Android panels**, with any other relevant matches still grouped. Searching **repeat** shows the Repeat control in Add step. Change action shows only replacements valid for the selected action slot.

## Primary-source precedents

| Product pattern | Application to Rebroid |
| --- | --- |
| Apple Shortcuts offers category browsing, search, and action details in its action library. Earlier outputs appear as recognizable Magic Variable tokens, with a way to reveal their source. [Action library](https://support.apple.com/guide/shortcuts/navigate-the-action-list-apdc33e4f4da/ios) · [Magic Variables](https://support.apple.com/guide/shortcuts/variable-types-apdd2b316022/ios) · [Reveal Action](https://support.apple.com/en-gb/guide/shortcuts/apda36b9018b/ios) | Share category and search behavior across both selectors. Put source-aware reference tokens beside the fields they supply. Use Rebroid’s whole-field bindings. |
| Maestro separates four directional swipes from custom relative or pixel coordinates. Maestro Studio lets authors inspect a device element and generate a command. Its targeted wait can finish as soon as the element appears. [Swipe](https://docs.maestro.dev/reference/commands-available/swipe) · [Maestro Studio](https://docs.maestro.dev/maestro-studio) · [Targeted wait](https://docs.maestro.dev/reference/commands-available/extendedwaituntil) | Make a direction the shortest path to a swipe. Offer a separate precision editor. Add screen picking and label inspection in a later pass. Route “wait until ready” searches toward text wait or text tap. |
| Zapier maps earlier values from the receiving field and can evaluate Path rules against sample data. Power Automate groups its Add action pane, offers field-level dynamic content, and distinguishes fixed loops from condition-based loops. [Zapier mapping](https://help.zapier.com/hc/en-us/articles/8496343026701-Send-data-between-steps-by-mapping-fields) · [Zapier Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths) · [Power Automate designer](https://learn.microsoft.com/en-us/power-automate/flows-designer#configuration-pane) · [Power Automate loops](https://learn.microsoft.com/en-us/power-automate/desktop-flows/use-loops) | Build readable rules, show explicit loop modes, and preview the selected branch using sample input where available. Apply Rebroid’s first-matching-case behavior. |
| n8n maps previous values into an individual parameter. Its manual Execute step can also run required upstream nodes, while pinned data can supply development outputs. [UI mapper](https://docs.n8n.io/build/work-with-data/reference-data/use-the-ui-mapper.md) · [Execution modes](https://docs.n8n.io/build/understand-workflows/understand-executions/types-of-executions.md) | Start with local previews and authorized historical results. Make any future live device test explicit about its target, profile, and execution scope. |

## Per-step recommendations

Each proposed display label maps to the current command or control block shown in code. The catalog order above also gives each step a clear place to browse.

### Touch & gestures

| Step | Configure it this way |
| --- | --- |
| **Swipe direction or relative position** · `android.swipeNormalized` | Show four labeled direction choices and **Custom**. Display a compact phone diagram with a start dot and arrowhead showing finger motion. Put duration below it and exact endpoints in percentage fields when Custom is selected. Show the preset values in the table below. |
| **Swipe by pixels** · `android.swipe` | Keep a precise Start/End pair with px units, duration, and a path preview when display dimensions are known. The current Percent mode translates using a fixed 1080×1920 reference and still stores pixels. Use a labeled target resolution for conversions when available and link to relative swipe when the author means position proportional to the runtime display. |
| **Tap relative position** · `android.tapNormalized` | Offer **Center** (50%, 50%), a point on a phone diagram, and two exact percentage fields with an accessible keyboard path. Show the origin at the top left. Offer an output shortcut for a compatible `vision.locate` step that inserts both center coordinates inside the **Found** branch. |
| **Tap by pixels** · `android.tap` | Show X/Y together with px units. When selecting a point on a device screenshot, show its source dimensions and orientation. Make the current distinction from relative taps explicit in the picker. |

The fixed reference size came from the former `actions/shared/coordinate-helpers.ts` in the web
workflow editor at commit `b2a047e9`. See the [gesture schemas](../../apps/orchestrator/src/automations/commands/android-automation-command-schemas.ts)
and [runtime coordinate conversion](../../apps/orchestrator/src/automations/commands/android-input-automation-commands.ts)
for the command contracts.

#### Proposed swipe presets

| Button | Start X, Y | End X, Y | New step duration |
| --- | --- | --- | --- |
| ↑ Swipe up | 50%, 80% | 50%, 20% | 300 ms |
| ↓ Swipe down | 50%, 20% | 50%, 80% | 300 ms |
| ← Swipe left | 80%, 50% | 20%, 50% | 300 ms |
| → Swipe right | 20%, 50% | 80%, 50% | 300 ms |

Use the existing up gesture and 300 ms as the baseline. The other endpoints mirror it and stay away from the display edges. Store the existing `start`, `end`, and `durationMs` values, with percentages converted to 0–1. Derive the selected direction from matching literal endpoints and keep duration independently editable within 50–5,000 ms. **Custom** starts from the current points and shows their values. A direction click changes both endpoints in one undoable edit and leaves the current duration or its binding in place. The screenshot’s 50%, 90% → 50%, 15% at 500 ms should open as **Custom** with all values intact. Test the four defaults on supported Redroid sizes and orientations. Consider an **Open app drawer** recipe separately after checking launcher behavior. Route notification-shade and quick-settings searches to the dedicated Android actions. [Current relative swipe editor](../../apps/web/src/features/automations/automations-page/actions/android/swipe-normalized.action.tsx) · [Android panel actions](../../apps/orchestrator/src/automations/commands/android-device-control-automation-commands.ts)

### Text & clipboard

| Step | Configure it this way |
| --- | --- |
| **Tap text** · `android.tapText` | Lead with **Text or accessibility label** and an Exact / Contains choice. Show **Waits up to 10 s** by default and put the polling interval under Advanced. This action already waits for a tappable match and selects the first eligible match, so the catalog can suggest it when a user intends to wait and then tap the same label. Surface ambiguous matches in a later device preview. |
| **Type text** · `android.inputText` | Use a multiline field with an inline source selector and the 20,000-character limit. Say it types into the focused field. Use a character count in the outline. |
| **Set Android clipboard** · `android.setClipboard` | Lead with **Clipboard text** and inline source binding. Explain that the step replaces clipboard contents. Keep a blank value representable for intentional clearing and show a compact summary without exposing contents. |
| **Read Android clipboard** · `android.getClipboard` | Use a parameterless summary with prominent **Text** and **Supported** outputs. Offer **Add condition** on Supported when the next step depends on the read. |

### Device & apps

| Step | Configure it this way |
| --- | --- |
| **Device control** · `android.viewerCommand` | Put Back, Home, and Recent apps first. Group the remaining supported choices under Screen, Volume, and Panels. Use labels such as **Go to Home**, with existing enum values underneath. Include common controls as searchable Add step shortcuts that prefill this action. Label its Rotate choice as a relative action alongside the separate fixed orientation command. |
| **Show notifications** · `android.expandNotifications` | Give this schema-only action a clear purpose sentence and direct **notification shade** search alias. A parameterless step needs only the action summary and available outputs. |
| **Show quick settings** · `android.expandQuickSettings` | Use a parameterless **Open Android Quick Settings** summary. Add aliases for **quick settings tiles** and **pull down settings**. |
| **Close Android panels** · `android.collapsePanels` | Say **Closes notifications or Quick Settings**. Keep it discoverable near both opening actions and use a parameterless summary. |
| **Set screen orientation** · `android.rotateDisplay` | Show Portrait and Landscape with device orientation icons and text. Put the two reverse choices alongside them in an expanded group. Display the saved selection in the outline, including reverse orientations. |
| **Press Android key** · `android.key` | Lead with common named keys such as Back, Home, Enter, Tab, Power, and Volume. Keep **Custom Android key** for the existing string input and show an example such as `KEYCODE_ENTER`. Clearly distinguish the key event from a viewer control in search results. |
| **List installed apps** · `android.listPackages` | Start with optional **Filter package IDs** and **Include system apps**. Put the existing 50-result limit and timeout in Advanced. Show Packages, Total matches, and Truncated together so users can tell whether they saw the full set. |
| **Launch app** · `android.launchPackage` | Lead with an Android package ID, e.g. `com.example.app`, plus an inline output reference. Later offer a searchable list from an explicitly selected, authorized target while keeping manual entry for reusable workflows. Keep **If launch fails** visible with the existing continue-with-result and fail modes. Offer a branch on **Launched** and move the timeout to Advanced. |
| **Open Android Settings** · `android.openSystemSettings` | Show **Main Settings screen** as text because the schema has a single screen value. Keep timeout in Advanced and expose **Opened** and **Attempts**. Differentiate this entry from opening the Quick Settings panel and keep the existing shell permission. |
| **Read Android setting** · `android.getSetting` | Place the System, Secure, or Global namespace before **Setting key**. Show a validated example such as `system · screen_brightness`. Put timeout in Advanced and expose the returned string as **Setting value**. Keep the existing shell permission. |
| **Run ADB shell command** · `android.adbShell` | Use a monospaced command field with a read-only example such as `getprop ro.build.version.release`. Describe the Android-device target, put timeout in Advanced, and show stdout, stderr, and exit code in results. Keep raw command entry literal and permission-gated. |

### Timing

| Step | Configure it this way |
| --- | --- |
| **Wait for a duration** · `android.wait` | Offer 0.5 s, 1 s, 2 s, 5 s, and Custom, with the existing 1 s initial value. Let users enter fractional seconds while storing whole milliseconds. Keep a clear route to Wait for text when the next step depends on the screen. |
| **Wait for text** · `android.waitForText` | Put **Text or accessibility label** first and show Exact / Contains beside it. Use **Wait up to** in seconds, defaulting to 10 s, with quick picks such as 5, 10, 15, and 30 s. Put the 1 s default **Check every** interval in Advanced. Explain that it completes when the first eligible tappable match is found. Retain imported timing and case-sensitive exact matching. |

Text operations distinguish enabled, tappable labels from single checks of visible labels. A text wait or tap can fail with no match or an uncertain result, and tap confirmation can be lost after dispatch. Keep that distinction in results and avoid representing a lost acknowledgement as permission to send a second tap. [Workflow device steps](../operator-console.md#workflow-device-steps) · [Text timing schemas](../../apps/orchestrator/src/automations/commands/android-automation-command-schemas.ts)

### Flow control

| Step | Configure it this way |
| --- | --- |
| **If / Otherwise** · `condition` | Start with a single editable sentence such as **If Launch app → Launched is true**, then show named **Then** and **Otherwise** lanes. Clarify that all rules in a group must match and any group may pass. Offer **Add AND rule** and **Add OR group** where each applies. Keep type-specific operators and show the comparator only when needed, with literal or reference entry as the contract allows. Preserve imported literal operands and referenced comparisons when rendering. Offer branch starters from earlier outcomes, such as **If File exists → Exists**. |
| **Choose a branch by value** · `switch` | Show **Value to match**, typed case rows, and **Otherwise**. Use the selected input type to guide new cases and flag duplicates or obvious type mismatches. Use quoted labels for strings so `"2"` and `2` are distinguishable. Preserve imported literals in the picker. Explain that the first exact typed match wins and the flow continues after the block when no case or fallback has steps. |
| **Repeat** · `repeat` | Use **Repeat N times** and **While condition is true** choices. In count mode, lead with the count and show an existing lower cap if it changes the effective number. In while mode, put the iteration cap next to the predicate and explain it is checked before each pass, so zero executions are possible. Keep the validated cap of 1–1,000 and label the repeated body. Explain that the predicate can use outputs from before the loop and that those outputs are snapshots. A screen check inside the loop body cannot supply the loop’s own predicate under the current scope rules. Prefer explicit **Add step** prompts over inserting placeholder executable steps into new blocks. |
| **End workflow successfully** · `flow.stop` | Make **Success** visible in the heading or summary. Show an optional **Reason shown in run history** field and caption that subsequent steps are skipped. |
| **Fail workflow** · `flow.fail` | Require a clear **Failure message**, with a contextual example. Use unmistakable failure copy and make the outline show the intended outcome before the workflow runs. |

Sources for current behavior. [Control block editor](../../apps/web/src/features/automations/automations-page/steps/editors/automation-step-block-settings-editor.tsx) · [Condition builder](../../apps/web/src/features/automations/automations-page/steps/editors/automation-condition-builder.tsx) · [Runner](../../apps/orchestrator/src/automations/runner/automation-step-executor.service.ts) · [Definition normalization](../../apps/orchestrator/src/automations/definition/automation-definition-normalizer.service.ts)

### Checks

| Step | Configure it this way |
| --- | --- |
| **Require text on screen** · `assert.textExists` | Reuse the label and Exact / Contains controls. Say **Checks the current screen once. Fails if missing.** Put raw UI XML in Advanced and display a clear full-document versus substring hint for XML matching. |
| **Require text off screen** · `assert.textMissing` | Use the same form and say **Checks the current screen once. Fails if found.** Distinguish **Check now** from waiting for a label to disappear. |
| **Require Android file** · `assert.fileExists` | Reuse the absolute **Android file path** field. Say **Fails if the file is missing**, with a shortcut to **Check whether file exists** when the user wants to branch. |

### Files

Use absolute Android paths and show a device-side example such as `/sdcard/Download/example.txt` in these forms. For a later device picker, make the authorized target and current profile visible.

| Step | Configure it this way |
| --- | --- |
| **Write file to Android** · `android.pushFile` | Separate **Destination path** from **File contents**. Offer **From previous step**, a local file picker that encodes to the existing base64 input, and **Paste base64** in Advanced. Show file name and decoded size in the editor. Validate against the existing size constraints and explain the payload is embedded in the workflow definition. |
| **Read file from Android** · `android.pullFile` | Lead with **Source file path**. Show **File content**, **Path**, and **Size** as outputs. Offer **Write this file to Android** as a next-step recipe that links the content field and asks for a destination. |
| **Delete Android file** · `android.deleteFile` | Show the exact file path in the outline. Use explicit delete copy and explain that the deletion occurs on the workflow’s target at run time. In a future live-test flow, separate it from configuration preview. |
| **Check whether file exists** · `android.fileExists` | Show **Android file path** and **Exists (yes/no)**. Suggest a Condition using the boolean output so a missing file can take an alternate branch. |
| **List Android files** · `android.listFiles` | Label the input **Android directory path**. Show the returned Files array or a bounded sample from an authorized result. Offer array predicates such as **is empty** or **length is greater than** when building a condition. |

### Screen & vision

| Step | Configure it this way |
| --- | --- |
| **Capture screenshot** · `android.screenshot` | Use a parameterless summary and show image, capture time, and media type as outputs. Provide the image preview from the selected run result. Both current screenshot commands return equivalent image fields. Prefer this entry when searching for “screenshot” and give the debugging variant a distinct label and group. |
| **Observe screen** · `vision.observe` | Summarize what comes back, including detections, OCR status and count, and a vision summary when available. Put the 40-per-list result limit and model overrides in Advanced. Preview outputs from an authorized run with distinct OCR availability and zero-detection states. |
| **Find on screen** · `vision.locate` | Start with **Text or element to find** and an example. Offer full screen or a region picker driven by the existing normalized region fields. Move the default 0.5 confidence threshold, five-result limit, and model overrides into Advanced. Explain **Found**, **No match**, and **Inconclusive**. Offer a **Tap first match when found** recipe that branches on `outcome` before referencing the center coordinates. |

Sources for current behavior. [Vision schemas and outputs](../../apps/orchestrator/src/automations/commands/vision-automation-commands.service.ts) · [Locate editor](../../apps/web/src/features/automations/automations-page/actions/vision/locate.action.tsx)

### Network

Use plain action names and show the impact on the selected app container. Keep the existing permission checks and policy validation. Render IPv4 addresses and CIDRs in a code font with the same normalization as the backend.

| Step | Configure it this way |
| --- | --- |
| **Allow IPv4 address or range** · `container.network.allowCidr` | Accept an address or CIDR and show its normalized value, e.g. `192.0.2.10` → `192.0.2.10/32`. Say this adds a custom allowlist entry. |
| **Remove allowed IPv4 address or range** · `container.network.removeAllowedCidr` | Reuse the same field and preview. A later target-aware picker can offer current custom entries with manual entry for workflows that run on different targets. |
| **Clear custom allowlist** · `container.network.clearAllowedCidrs` | Give this parameterless action the concrete summary **Remove every custom allowed range**. Explain what it changes so users can distinguish it from resetting the policy. |
| **Set network restrictions** · `container.network.setRestrictions` | Use a plainly labeled **Enable restrictions / Disable restrictions** choice and show the resulting state in the outline. When adding the step, ask the author to choose a state explicitly. Keep imported `enabled` values visible and editable. |
| **Reset network policy** · `container.network.resetPolicy` | Use a parameterless statement of both effects **Enable restrictions and clear the custom allowlist**. Include those effects in the picker description and outline. |

Source for policy effects. [Network commands](../../apps/orchestrator/src/automations/commands/container-network-automation-commands.service.ts)

### Debugging

| Step | Configure it this way |
| --- | --- |
| **Write to run log** · `debug.log` | Offer a compact message field and inline whole-value reference, with the 2,000-character limit. Say where the message appears in run results. |
| **Save screenshot in run** · `artifact.saveScreenshot` | Show **Captures a fresh screenshot for this step’s output** and give the trace author an image preview. Keep it discoverable under Debugging and by its command ID. |

### AI

| Step | Configure it this way |
| --- | --- |
| **Run a device agent task** · `ai.run` | Lead with **Task for the device agent**, a prompt example with a verifiable outcome, and an inline prompt reference. Show the configured/default Device control model in a compact row. Put Device control and vision overrides, mode, action limit, and timeout behind Advanced. Use the shared searchable multi-select for permission-filtered capabilities, with a clear **Use defaults** state and removable overrides. Keep read-only shell escalation explicitly permission-gated and raw ADB shell out of the capability picker. Show inherited/imported settings and unavailable models clearly. Expose **Completed**, **Status**, and **Blocked reason** for branching. |

Sources for current behavior. [AI editor](../../apps/web/src/features/automations/automations-page/actions/ai/ai-run.action.tsx) · [AI step contract](../../apps/orchestrator/src/automations/commands/ai-automation-commands.service.ts)

## Implementation order and acceptance checks

1. **Catalog and inspector.** Prioritize visible groups in both selectors, direct insertion, clearer labels and summaries, inline output binding, duration fields, and directional swipes. Add semantic field labels, default summaries, and useful parameterless layouts to the five actions currently served by generic forms: Show notifications, Show quick settings, Close Android panels, Open Android Settings, and Read Android setting. [Registered Android actions](../../apps/orchestrator/src/automations/commands/android-automation-commands.service.ts) · [Custom editor registry](../../apps/web/src/features/automations/automations-page/actions/action-registry.tsx)
2. **Control blocks and recipes.** Improve Then/Otherwise lanes and the repeat and switch editors. Add recipes that expand into editable existing steps, such as **Find text and tap if found**, **Copy a file**, and **Launch app and branch on result**. Generate valid, scoped references and treat each recipe as one undoable edit.
3. **Device context and preview.** Start with local gesture diagrams, format checks, and linked run results. Later add on-demand package, file, and element pickers using the authorized target and profile. Device picking can read existing screen evidence and fill the form without dispatching a gesture. A live step test needs an explicit target and execution scope because prior steps and the current Android screen affect the result. Use a fresh screen observation before acting on any captured target.

- Measure elapsed time, interactions, and corrections for adding **Swipe up**, finding a network action by browsing, configuring **Tap text** with a custom timeout, and linking **Find on screen** to a tap. Compare against the current editor with the same tasks.
- Exercise keyboard and touch paths for both selectors, preview controls, focus restoration, and branch insertion. Match the repo’s neutral panel tokens and shared `Section`, `FormField`, and disclosure patterns. Use inline errors and fix instructions for paths, coordinates, and numeric limits. The shared numeric control currently turns an empty input into zero and uses a numeric keyboard even for decimal coordinates. [Shared action fields, lines 26–36](../../apps/web/src/features/automations/automations-page/actions/shared/action-fields.tsx#L26) · [Web design system](../web-design-system.md#controls-and-forms) · [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
- Round-trip representative Visual editor → YAML → Visual workflows with custom gestures, zero and false values, imported overrides, branch-scoped references, hidden settings, and both repeat modes. Verify that opening a step preserves its values, and that one preset click or catalog replacement can be undone in one operation.
- Verify every permission-filtered action appears in its group exactly once and that search aliases resolve from both selectors where applicable. Exercise broken references after an action change or reorder and verify the inspector identifies the unavailable output.
