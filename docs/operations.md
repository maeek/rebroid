# Operations

## Health Endpoints

- Orchestrator `/health/live`: process liveness only.
- Orchestrator `/health/ready`: required Docker dependency readiness.
- Orchestrator `/api/v1/diagnostics`: authenticated aggregated diagnostics.
- Display sidecar `/health/live`: process liveness.
- Display sidecar `/health/ready`: process readiness.

Docker healthchecks use liveness endpoints so an optional downstream outage does not restart a healthy process.

## Stored State

Rebroid is pre-release software. Database layouts are initialized from one baseline migration per application. Schema upgrades intentionally do not repair or migrate existing volumes.

To reset state:

```bash
docker compose -f deploy/compose.yaml down -v
```

## Manual Scrcpy Harness

Scrcpy integration work requires a Linux Docker-compatible host with Redroid support, binder devices, and the display-sidecar image. Start the appliance, create an Android application, and manually verify launch, video, input, disconnect, retry, and shutdown before and after any scrcpy change. Record the host configuration and test result in the change description.
