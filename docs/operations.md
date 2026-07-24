# Operations

## Health Endpoints

- Edge `/edge-health`: nginx ingress liveness over HTTPS.
- Orchestrator `/health/live`: process liveness only.
- Orchestrator `/health/ready`: required Docker dependency readiness.
- Orchestrator `/api/v1/diagnostics`: authenticated aggregated diagnostics.
- Orchestrator `/api/v1/diagnostics/summary`: authenticated shallow diagnostics for routine polling.
- Orchestrator `/api/v1/metrics`: Prometheus metrics.
- Orchestrator `/api/v1/metrics/docker`: authenticated Docker access snapshot used by the web dashboard.
- Display sidecar `/health/live`: process liveness.
- Display sidecar `/health/ready`: process readiness.

Docker healthchecks use liveness endpoints so an optional downstream outage does not restart a healthy process.

## Docker Socket Stability

The supported production target is native rootful Linux Docker Engine. Docker Desktop VM mode, Podman machine VM mode, and rootless engines are unsupported.

Use **Orchestrator > Overview** first. The dashboard shows Docker API retries, slow operations, failures, active work, queue depth, and the latest sanitized failure events. Local Unix-socket requests intentionally log slow operations without terminating them.

When a socket reset remains, collect the host evidence around the same timestamp:

```bash
curl --unix-socket /var/run/docker.sock http://localhost/_ping
docker version
docker info
curl -H "x-orchestrator-secret: $ORCHESTRATOR_SHARED_SECRET" http://127.0.0.1:4100/api/v1/metrics
systemctl status docker
journalctl -xu docker.service --since "15 minutes ago"
dmesg -T | grep -Ei 'oom|killed process|dockerd|containerd'
df -h /var/lib/docker
df -i /var/lib/docker
docker events --since 15m
```

Classify the failure before tuning the host:

- Repeated slow-operation warnings without daemon restart usually mean the engine is busy.
- Daemon restart, panic, or OOM evidence means the reset originated below Rebroid.
- Disk or inode exhaustion must be corrected before retrying lifecycle operations.
- Failures immediately after an engine upgrade should include `docker version` output so API compatibility can be checked.

If registry or build traffic is the bottleneck, consider lowering dockerd `max-concurrent-downloads` or `max-concurrent-uploads`. Enable Docker `live-restore` when standalone containers should remain running during daemon restarts; it does not make the Docker socket itself reliable.

## Stored State

Rebroid is pre-release software. Database layouts are initialized from one baseline migration per application. Schema upgrades intentionally do not repair or migrate existing volumes.

Stop the orchestrator, inspect the reset as a dry run, then execute it:

```bash
pnpm reset:orchestrator-state
pnpm reset:orchestrator-state -- --execute
```

The targeted reset removes the orchestrator SQLite database (including WAL files), orchestrator uploads/build contexts, and Docker containers, networks, volumes, and managed images marked as Rebroid-managed. It handles both local paths and Compose named volumes; named-volume cleanup uses the existing orchestrator image as a short-lived reset helper. It preserves web data, shared secrets, and the orchestrator settings file. Environment overrides for `DATABASE_PATH`, `UPLOADS_DIR`, and `RESET_HELPER_IMAGE` are honored. Do not use `docker compose down -v` for this migration because that also removes unrelated persistent data.

After the reset, start the orchestrator normally. The single initialization migration recreates the complete current schema.

The current baseline includes workload indexes, the unique active-automation-target reservation, and transactional event sequence counters. Existing state created from an older baseline must be reset with the operation above; the application does not apply an in-place schema upgrade.

## Google Play Image Patching

The managed patcher supports Android 14 (`upsilon`) and Android 13 (`tau`) on
Linux amd64 with rootful Docker. It requires 10 GB free storage and 3 GB Docker
memory; 4 GB RAM and 2 CPUs are recommended. CPU count is informational and
never blocks a build.

Each job pins the pulled ReDroid digest and the resolved MindTheGapps commit.
The package SHA-256 is calculated locally and stored with the job. The worker
runs non-root without the Docker socket, host paths, or application secrets.
Generated packages are limited to 2 GB; extraction is limited to 4 GB and
50,000 entries. Traversal paths, device entries, escaping symlinks, and
setuid/setgid modes are rejected.

Canceling a job removes its worker and temporary extraction data while keeping
the last verified cache. Queued jobs run one at a time. A running job found
after an orchestrator restart is marked failed; a retry can reuse the verified
package cache. Use **Advanced cache options** on the builder page to remove the
Android 13 or 14 cache.

CI can exercise the worker without cloning upstream by running
`pnpm test:gapps-patcher`; set `CONTAINER_ENGINE=podman` when Docker is not the
local CLI. The test creates a temporary MindTheGapps-shaped Git repository and
verifies that the worker produces an x86_64 package.

The deployment image transfer scripts include the isolated
`rebroid/gapps-patcher:latest` worker. Run `deploy/save-docker-images.sh` to
build and export the complete application image set, then run
`deploy/load-docker-images.sh` on the target host. Both scripts prefer Docker,
fall back to Podman, accept an optional archive directory as their first
argument, and support an explicit engine path through `CONTAINER_ENGINE_BIN`.
The Compose deployment explicitly passes the same worker tag to the
orchestrator. The worker is not a Compose service: the orchestrator creates a
short-lived, isolated job container only while a GApps package is being built.

Before release, manually complete one build for each Android version and record
host disk usage, peak Docker memory, duration, payload validation, final image
ID, and labels. Static success does not prove Google login, Play Protect
certification, or Play Integrity behavior.

## Manual Scrcpy Harness

Scrcpy integration work requires a Linux Docker-compatible host with Redroid support, binder devices, and the display-sidecar image. Start the appliance, create an Android application, and manually verify launch, video, input, disconnect, retry, and shutdown before and after any scrcpy change. Record the host configuration and test result in the change description.

For Redroid display changes, verify both WebRTC and WebSocket streams on
supported Redroid 13 and 14 images. Confirm the sidecar reports scrcpy server
4.0 or newer and `scrcpy-server-v4-rbd1`, collect the requested and effective
stream profiles, and capture sidecar queue and Pion feedback metrics. Verify
video with and without audio; touch, keyboard, actions, and clipboard through
scrcpy control and ADB fallback; direct and forward connection paths;
disconnect/reconnect/final cleanup; and repeated session create/release.
Confirm virtual-display creation fails while `feature.display-virtual` is
disabled, then enable it through the feature API and verify creation and
release. Redroid 15 and 16 are intentionally unsupported until their scrcpy
video startup issues are resolved upstream; verify they fail with a clear
unsupported-version message rather than a reconnect loop.

For the native 1080×2340@60 gate, run the deterministic motion workload for 10
minutes in current stable Chromium and Firefox over wired LAN through the
direct-sidecar, Rebroid edge, and VPS master-proxy paths. Record one-second
`ViewerStreamMetricsV4` windows, stage sequence watermarks,
source/relay/bridge/RTP/browser drops, Firefox MSE buffered lead, adaptive
jitter target, freezes, RTT, loss, NACK/PLI, audio skew, CPU, and
display-sidecar event-loop utilization. Repeat WebRTC at 50 ms RTT and 1% packet
loss. The exact targets and native gateway escalation gate are documented in
[display streaming](display-streaming.md#acceptance-and-escalation).

## Local AI Provider Compatibility

- Configure llama.cpp and Lemonade with the `openai-chat-completions` protocol. Use server flavor `auto` unless an explicit override is needed; auto-detection checks Lemonade before Ollama compatibility endpoints.
- Model IDs are exact transport IDs. Do not append Ollama-style `:latest` tags to IDs returned by `/v1/models`.
- Controller models need structured output or tool calling. The user-invoked provider diagnostic requires a real structured controller response and validates vision against a supplied image instead of treating HTTP 200 as success.
- Automated tests use recorded SSE/NDJSON and perception fixtures only. They must not call live language or vision models.
- OCR is adapter-backed and receives the original lossless screenshot. PaddleOCR remains the default adapter; preprocessing selection favors confidence, unique text, and useful coverage instead of raw box count.
- Raw ADB remains disabled by default in device chat. An approval card starts one allowlisted follow-up only after the server verifies `automations:run-adb-shell`; rejecting it keeps the request blocked, and approval is never persisted to later runs.
