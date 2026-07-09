# Operations

## Health Endpoints

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

## Manual Scrcpy Harness

Scrcpy integration work requires a Linux Docker-compatible host with Redroid support, binder devices, and the display-sidecar image. Start the appliance, create an Android application, and manually verify launch, video, input, disconnect, retry, and shutdown before and after any scrcpy change. Record the host configuration and test result in the change description.

For Redroid display changes, verify both WebRTC and WebSocket streams on supported Redroid 13 and 14 images. Confirm the sidecar reports scrcpy server 4.0 or newer, collect the compatibility mode shown by the viewer, and capture sidecar log lines for any fallback. Verify the horizontal viewer workspace, one virtual display, virtual display release, minimal popout viewer, and video-only MP4 recording download. Redroid 15 and 16 are intentionally unsupported until their scrcpy video startup issues are resolved upstream; verify they fail with a clear unsupported-version message rather than a reconnect loop.
