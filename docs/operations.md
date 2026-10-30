# Operations

Use **Platform → Overview** and **Platform → Services** for routine diagnostics.
For installation and host requirements, see [Deployment](deployment.md).

## Health checks

The paths below belong to each service; only the edge is published by Compose.
Use the internal service network or a local development listener for the other checks.

| Service         | Endpoint                                                | Meaning                                              |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Edge            | `/edge-health`                                          | HTTPS ingress liveness.                              |
| Orchestrator    | `/health/live`                                          | Process liveness.                                    |
| Orchestrator    | `/health/ready`                                         | Required Docker dependency readiness.                |
| Orchestrator    | `/api/v1/diagnostics` and `/api/v1/diagnostics/summary` | Authenticated full and shallow diagnostics.          |
| Orchestrator    | `/api/v1/metrics` and `/api/v1/metrics/docker`          | Authenticated metrics and Docker access diagnostics. |
| Display sidecar | `/health/live` and `/health/ready`                      | Process health.                                      |
| OCR sidecar     | `/health/live` and `/health`                            | Liveness and model readiness.                        |

Docker health checks use liveness, so an optional downstream outage does not restart a healthy process.
OCR readiness stays false until its model has warmed up.

## Docker troubleshooting

Start with the overview's failures, retries, queue depth, and slow operations. Local engine requests
log slow work without terminating it; remote HTTP/TCP requests have bounded ordinary request timeouts.
Archive transfers, image pulls, builds, and exec streams have separate concurrency limits and deadlines.

On the Linux host, collect evidence around the failure time:

```bash
curl --unix-socket /var/run/docker.sock http://localhost/_ping
docker version
docker info
journalctl -xu docker.service --since "15 minutes ago"
df -h /var/lib/docker
df -i /var/lib/docker
```

| Evidence                               | Next check                                                 |
| -------------------------------------- | ---------------------------------------------------------- |
| Slow requests without a daemon restart | Image builds, transfers, cleanup, and competing host work. |
| Daemon restart or OOM                  | Docker service and kernel logs, host memory limits.        |
| Disk or inode exhaustion               | Engine storage capacity before retrying.                   |
| Failure after an engine update         | Engine version and API compatibility.                      |
| Android exits immediately              | [ReDroid host checks](deployment.md#redroid-host-checks).  |
| Viewer reconnects repeatedly           | [Display diagnostics](display-streaming.md#diagnostics).   |

## Stored state

Pre-release databases do not have an in-place schema upgrade path. Reset only the state affected
by a schema change. The commands below delete data when `--execute` is supplied; preview the
reported paths and resources first.

### Orchestrator reset

This removes the orchestrator database, uploads/build contexts, and Rebroid-managed runtime
containers, networks, volumes, and managed images. It preserves web data, shared secrets,
and the orchestrator settings file.

```bash
docker compose -f deploy/compose.yaml stop orchestrator
pnpm reset:orchestrator-state
pnpm reset:orchestrator-state -- --execute
docker compose -f deploy/compose.yaml up -d orchestrator
```

For local development, stop the orchestrator process instead of the Compose service. The reset
supports local paths and Compose volumes; `DATABASE_PATH`, `UPLOADS_DIR`, and `RESET_HELPER_IMAGE`
can override discovery. The next startup creates the current schema.

### Full reset

Use this when web state also needs a clean schema. It removes local web/orchestrator state,
uploads, managed runtime resources, and Compose state volumes, including web accounts and
generated secrets. External environment files and bind-mounted secrets are preserved.

```bash
docker compose -f deploy/compose.yaml down
pnpm reset:all-state
pnpm reset:all-state -- --execute
docker compose -f deploy/compose.yaml up -d
```

Stop local development processes as well. `docker compose down -v` is not a substitute for the
targeted reset: it also removes web state and generated credentials.

## Google Play image patching

Open **Runtime → Images** to build a local Android 13 or 14 image with Google Play components.
The managed builder uses prebuilt ReDroid and a pinned MindTheGapps revision; it does not compile AOSP.

| Requirement   | Value                            |
| ------------- | -------------------------------- |
| Host          | Linux amd64, rootful Docker.     |
| Free storage  | At least 10 GB.                  |
| Docker memory | At least 3 GB; 4 GB recommended. |
| CPU           | 2 CPUs recommended.              |

Only one patch job runs at a time. The non-root worker has no Docker socket, host paths, or app
secrets. The pulled image digest, source revision, and package checksum are recorded; extraction
and APK/XML validation complete before the final image is accepted.

Canceling removes the worker and temporary files while retaining verified cache entries. A patch
job interrupted by restart is marked failed; a retry can reuse the cache. **Advanced cache options**
removes cached Android 13 or 14 packages. The **Custom builder** remains available for Dockerfile workflows.

APK dependency analysis is advisory: it can suggest a matching Google Play image without rejecting
an otherwise valid upload. Built images are local; Rebroid does not redistribute patched images
or guarantee Google login, Play Protect certification, or Play Integrity compatibility.

For builder changes, run `pnpm test:gapps-patcher` and manually build both supported Android versions.
Record image IDs, payload validation, duration, disk usage, and peak memory.

## Local AI provider compatibility

- Configure llama.cpp and Lemonade with `openai-chat-completions`; native Ollama uses its explicit transport.
- Keep server flavor separate from transport. Automatic detection checks Lemonade before Ollama compatibility endpoints.
- Use exact model IDs returned by the chosen transport. Do not append `:latest` to `/v1/models` IDs.
- Controller models need structured output or tool calling. Use the provider diagnostic to test a real
  controller response and vision request, rather than relying on an HTTP success status.
- OCR uses one deployment language through `OCR_LANGUAGE`; requests for another language are rejected.
- Raw shell access is disabled in device chat by default. A permission-checked approval creates one
  allowlisted follow-up and does not change future run or provider settings.

Model and perception tests use recorded fixtures, never live language or vision providers.
For display changes, follow the [manual verification matrix](display-streaming.md#manual-verification).
