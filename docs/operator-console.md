# Operator console

Rebroid organizes everyday work around apps and automation runs. Administration starts with
General, Casting, External ADB, Firewall, and OCR perception when enabled, followed by Feature management and AI.
The Docker group keeps Containers, Images, and Networks together. Users & groups contains the
account and group lists.
Select System to open System overview, which shows host and container resources. Use its chevron to show
or hide Services and Maintenance tasks. These groups start expanded in the
desktop sidebar and mobile drawer.
Use the desktop sidebar toggle beside the Rebroid wordmark to reclaim the navigation width. The
browser remembers the choice. The Images shortcut opens the builder when the feature is available.
Administrator shortcuts beside Users and Groups open the corresponding creation dialogs.
On mobile, the bottom bar links to Apps and, when enabled, Workflows. Tap **More** for the full navigation list.
Swipe down from the grip or tap **Close navigation** to dismiss the drawer.
The recent app list refreshes while the desktop sidebar or mobile drawer is visible.
Right-click or long-press a running app shortcut and choose **Stop app…** to stop it from the current
page. This action requires ownership of the app and permission to stop apps.

## Finding permissions

Open a user or group under **Users & groups**, then choose **Permissions** to browse by category. Use
**Permission category** to narrow the list or **Search permissions** to find a specific capability.
The group editor lets you set each permission individually. The user editor shows the effective
permission and the group that supplies it.

## Preferences and platform settings

Open **Preferences** from the account menu to manage settings for your own account and browser.
Open **Security** from the same menu to manage sign-in settings.

- **General** (`/preferences/general`): theme, accent color, viewer layout, and profile photo.
- **Security** (`/preferences/security`): change your password, manage multi-factor authentication and
  recovery codes, and sign out one or all other browser sessions.

Platform administrators can open **Users & groups → Users**, edit another account, and sign out its
browser sessions individually or together. Signing out a session also disconnects its Android viewers.

Administrators manage shared list refresh and streaming defaults in
**Administration → General → Console defaults** (`/platform/console`). Save defaults and Restore defaults
apply to everyone. Android app defaults are on **Administration → General**.

## Casting

Open **Administration → Casting** (`/platform/casting`) to check display service health, view logs,
restart the display sidecar, or manage app viewer sessions. The Display service row in **System → Services**
also opens Casting. **View logs** in Connection opens the sidecar's Docker **Logs** tab.

## External ADB

Open **Administration → External ADB** to see broker readiness, USB availability, and external
device viewer sessions. Platform administrators can choose **Allow network** and enter an IPv4 CIDR.
One range allows TCP ADB enrollment for multiple devices regardless of port. Registration
prefills port `5555`. Change it if the device uses a different port. Use **Remove** and confirm
to disconnect devices that lose access.
The broker also rejects hosts on its directly attached networks.

## Feature management

Open **Administration → Feature management** to change a capability and see its effective status.
The switch updates the saved setting. **Waiting for display service** means the display service
has yet to acknowledge it. **Unavailable** means the deployment lacks the required support.
Enable **AI** here before configuring a provider under **Administration → AI**.

## Runtime images

Administrators can use **Pull image** above the Images grid to download or update an image from
Docker Hub. Choose **Other registry** and enter a full reference such as `ghcr.io/owner/image:tag`
to pull from another registry. Both options use anonymous access. Successful pulls refresh the
managed image inventory and are recorded in the audit log.

On an image’s detail page, **Pull again** pulls its first listed tag or, for an untagged image,
its first registry digest. Both pull actions show when Docker is waiting, contacting the registry,
transferring layers, or registering the image locally. On success,
the page opens the pulled reference so it shows the image the tag now points to. A local image
with no registry tag or digest cannot be pulled again.

## App lifecycle

- **Apps** (`/apps`) lists managed Android container apps and their lifecycle status.
  Choose **Create app** to provision a managed app. The gallery supports search, filters, and app
  bulk actions.
- **Devices** (`/devices`) lists external USB phones and TCP VMs. Choose **Register device** to
  enroll a device owned by your account. The page distinguishes missing broker configuration, a
  disabled feature flag, and a failed broker readiness check. Administrators can grant
  **Enroll external devices** and **Use external devices** separately in group permissions.
  Both are off for standard users. Registration opens the device's **Connection** view.
- External device details at `/devices/external/[id]` include **Overview**, **Connection**, and permission-aware **Activity**,
  **Diagnostics**, **Workflows**, and **AI agent** views. Viewer and device tooling require an
  eligible verified attachment.
- **Casting** opens the managed display connection and app viewer sessions.
  Session rows link to the corresponding app.
- `/apps/[id]` opens the resource overview with stored status, configuration, pending runtime changes,
  and relevant destinations. The embedded viewer requests its own display session for running apps
  while the browser tab is visible.
- Resource destinations share `/apps/[id]?view=<section>`, including `configuration`, `network`, `profiles`, `activity`, `diagnostics`, `ai-agent`, `workflows`, and `files`. The separate viewer window uses `/viewer/devices/[id]`.
- In **Configuration**, choose an image or select **Remove icon**, then click **Save** to apply the icon change.
- The RAM and CPU fields in **Configuration**, **Create app**, and group quotas show the Docker host's
  total RAM and logical CPU count. Account quotas still apply when setting app limits.
- **Create app** checks the editable timeout, RAM, and CPU fields before provisioning.
  **Configuration** saves only changed settings. Clear a saved RAM or CPU limit to restore its default.
- `?view=activity` displays the audit grid scoped to this application for administrators.
- `?view=diagnostics` exposes permitted logs and backend details. Foreign-owned app interaction
  remains restricted. Error references and technical hints require backend-detail permission.
  Administrators see the container command from Docker inspect, including arguments generated
  by the platform's rendering policy.
- On desktop, scrolling past the top of the embedded live viewer floats a read-only preview. Closing
  it docks the player and preserves your scroll position. The device toolbar opens a clipboard dialog for authorized users.
- Files opens in Downloads. Use the location shortcuts or breadcrumbs to change folders. Uploads,
  including drag-and-drop, go into the current folder.

After creating an app, follow provisioning in the resource overview. On narrow screens, open
**Device** once Android is ready to use the live display.
Saved runtime changes are distinguished from the currently active runtime; recreation is reported
as pending until the next start. Lifecycle commands keep their existing server-side authorization.

If Start or Restart cannot recover an app, stop it and choose **Runtime actions → Recreate runtime**.
Rebroid replaces the app container and its network and starts it with the active profile. Persistent
profiles and app settings are kept. Changes stored only in the old container are lost.
Recreate requires ownership and permission to start and stop the app.

## External Android devices

Open **Devices → All devices**, then choose **Register device**. Accounts with
**Enroll external devices** permission can register an approved TCP address and port. Only
administrators can enroll USB phones. Select **Find USB devices** to choose a phone connected
to an approved port on the Rebroid host. USB access belongs to the administrator who enrolled it.
After registration, select **Connect** from the device’s **Connection** view. Connecting and
using the device require **Use external devices** permission.

TCP enrollment requires an existing ADB listener at an approved address and port. Android wireless
pairing codes are unsupported. Use **Check connection** to test reachability, then verify the device
after registration.

For USB, approve debugging on the handset. If it already trusts the broker, unplug it and use
**Check connection** before plugging it back into the same port. Check again and confirm the
phone. For a preconfigured TCP phone, compare the broker fingerprint with a fresh Android
approval prompt. For a VM or an already trusted TCP target, use **Verification details** and
place the one-time code in the indicated file from the guest console. **Check connection**
refreshes the current state. An interrupted attachment requires a new attempt and verification.

After verification, the owner can select **Open viewer**. Opening the viewer leaves screen power
and clipboard synchronization under the device owner's control. Use the viewer controls to send
input or manually transfer clipboard text. Select **Device audio** to turn on playback when
the verified attachment supports it. **Capture screenshot** and **Read Android logs**
operate on the current attachment and require their corresponding account permissions.
Live external sessions appear under **Administration → External ADB**.

**Disconnect** retires the connection. **Forget device** also removes the registration.
To remove host-key trust from a phone, revoke debugging authorization on Android.
[External ADB deployment](deployment.md#external-android-devices)

## Container terminal

Under **Docker → Containers**, open a running managed Android container and select **Terminal**.
Use **Container user** to enter a name or UID, optionally followed by a group such as
`1000:1000`. A blank field uses the container's configured user. Select **Connect**
to start a new shell. **Disconnect** ends it.

The built-in Administrators group grants `docker:open-terminal`. Shells close on
account-session revocation, runtime changes, five minutes without input, or after
30 minutes. A shell in a privileged ReDroid container can access host resources.

## Outbound network access

Use the app's **Network** tab to change where Android can connect. **Approved destinations only**
includes Rebroid's managed destinations and any additional IPv4 addresses or CIDR ranges in the
editable list. Paste entries separated by commas or new lines, or delete entries to remove them.
**Unrestricted** requires internet access permission. **Create app** saves the list with the device.

**Save network access** saves the policy and attempts enforcement for a running app. A stopped app
uses the saved policy on its next start. If the firewall cannot confirm enforcement, the Network
tab shows the last reported state and offers **Retry enforcement** for the saved policy.
Administrators can manage the firewall agent connection under **Firewall** (`/security/firewall`). The
**Network policies** table below **Connection** shows app access and enforcement. The **Application**
column shows the owner's username beside the app name when available. Open an app's policy from its
row, or use **Sync all rules** to refresh host rules and remove stale entries.

## Build and schedule workflows

Open **Workflows** and select **New workflow**. In **Visual editor**, select **Add step** and
search or browse the catalog. Select a step in **Step sequence** to configure it. Use the move
controls or drag to reorder steps. Switch to **YAML** to edit the same draft as text.
**Save** and **Export workflow** use the draft in the active editor. Fix invalid step inputs or
broken references before saving or exporting from Visual. You can open YAML to repair broken
references. In YAML, wait for validation before saving, exporting, or applying edited text to Visual.

For a managed device, open **Workflows** on that device and select **Run workflow**. The accepted run
opens immediately with a summary and event timeline. For a USB phone or TCP VM, open its verified
viewer and select a workflow in **Run workflow**.

For recurring runs, open **Triggers → New trigger** and choose a workflow, target device, and
schedule. Managed targets offer a profile and **Start app if needed**. External targets require a
verified connection when the run is queued. Reconnecting creates a new attachment, so a run queued
for the old attachment fails. Using **Run now** links to the accepted run.

Workflow exports use `rebroid.io/automation/v2`. To update a v1 YAML export, change its version,
replace `targetApplicationId` with `targetDeviceId`, and rename run-context keys such as
`app.id` to `device.id`. Package and profile context is available for managed targets.

Schedules saved with an advanced cron expression show that expression in workflow trigger and
maintenance task editors. Edits to other fields preserve it. Use **Replace schedule** to choose
a new schedule with the standard controls.

## Workflow device steps

The workflow editor and AI workflow drafting use the registered commands permitted for your
account. Network policy steps manage restrictions and the CIDR allowlist. Deny-list steps
are unavailable.

Verified external devices support authorized screenshots and observations, taps, swipes, key and
text entry, explicit package launch, and supported viewer and clipboard controls. Rebroid validates
all branches of the workflow against the external target before dispatch. Files, raw ADB shell,
network changes, managed profiles, and startup require managed targets. The external AI viewer
can send screen images and recognized text to the AI providers selected for the task.

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

An action can use an earlier step's output through the field's **Use step output** button or a
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

Platform administrators can open **Run history retention** on the **Workflows** page to set how
many days to keep finished workflow runs. The default is seven days from completion. Existing saved
retention periods carry forward on upgrade.

The **Workflow history retention** task under **System → Maintenance tasks** uses the same value
and runs daily by default. Use the task editor to change its schedule or pause automatic cleanup.
For older finished runs without a completion timestamp, the task uses their last update.
It removes expired runs together with their step results and events, including OCR previews and
responses. The task covers saved workflow runs, including runs of workflows that were later
deleted. Active runs and ad hoc AI conversations are outside its scope.

## Image build maintenance

Each image builder shows the latest job for its build kind. Saved Dockerfile recipes and direct builds
use the same metadata defaults. Redroid defaults to microG and external signature spoofing.
Generic images default to no Google Mobile Services and mark signature spoofing as inapplicable.
On restart, the orchestrator marks interrupted Dockerfile builds and running GApps builds as failed.
Queued GApps builds remain eligible to run.
**Cancel** returns after the job status is recorded. The build may still be releasing its
Docker resources and staging files. The next GApps build waits for cleanup to settle and for
Docker to confirm that earlier managed GApps workers have stopped or been removed. The queue
rechecks Docker while that confirmation is pending.

In **System → Maintenance tasks**, **Clean interrupted image builds** runs daily at 02:15
by default. It removes temporary GApps package archives and extraction directories older than
24 hours for builds that are no longer active. Queued and running builds and verified package
caches are kept.

**Image build history retention** runs daily at 02:45 by default. Edit the task to change its
30-day retention period. It removes completed build records and their logs based on completion
time, keeping the latest completed build for each target image. The task leaves built images in Docker.

## Platform overview

**App operations** opens the filtered inventory. **Active workflow runs** lists the current
account’s queued and running executions and links to their traces. Authorized operators can
inspect active runs even while the workflow catalog is disabled. Check the snapshot timestamp
after a failed refresh.

Health popovers link to the affected service. In Docker metrics, compare queued and in-flight
operations with errors and timeouts for the same interval. A gap in event counts can indicate
the first sample or a counter reset.

## App diagnostics

On a narrow screen, select **Device** to see the display and select the section name to return.
Open **Streaming settings** in the device pane for transport, audio and per-display metrics.
[Display diagnostics](display-streaming.md#diagnostics)

In **Diagnostics**, select a log source and enable **Live** for ongoing refresh. Copied log
output is plain text. **Startup timings** shows recorded milestones with copyable timestamps.
Administrators can search and export app-scoped events in **Activity**. Retention and purge
actions are on the global audit page.
