# Rebroid Orchestrator

NestJS backend for provisioning isolated application containers and preparing browser scrcpy viewer sessions through an internal sidecar.

## Current Shape

- `AndroidAppsModule`: CRUD for managed application containers.
- `DockerModule`: low-level Docker socket wrapper.
- `ContainerImagesModule`: list, pull/update, and remove images.
- `DockerMaintenanceModule`: prune unused containers, networks, images, and volumes.
- `NetworkIsolationModule`: per-application Docker names, volume, and network boundary.
- `SettingsModule`: JSON-backed runtime defaults and APK upload limits.
- Viewer session API: `GET /android-applications/:id/scrcpy-session` prepares the shared display sidecar and returns app-scoped connection metadata for the browser viewer.
- `HealthModule`: Docker socket health check.

## Isolation Model

Each Android application receives:

- one redroid container,
- one persistent Docker volume mounted at `/data`,
- one dedicated Docker network.

The redroid container is attached only to its own network. When the orchestrator runs in a container, it discovers its own container id from `HOSTNAME` and attaches itself to each app network as needed. You can still override this with `ORCHESTRATOR_CONTAINER_ID` in unusual runtimes.

The frontend should call the orchestrator API and the authenticated viewer page. It should not connect directly to a redroid container or accept raw ADB targets from the browser.

## Local Development

```bash
npm install
npm run start:dev
```

Swagger is available at:

```text
http://localhost:4100/docs
```

## Provisioning Flow

`POST /android-applications` returns immediately after creating the database record and saving the uploaded APK. Provisioning then runs in the background.

Poll the application record:

```text
GET /android-applications/:id
```

Useful frontend fields:

- `status`: broad state such as `provisioning`, `running`, `stopped`, `error`, `removed`.
- `lifecycleStage`: current detailed step, for example `image_pulling`, `network_creating`, `android_booting`, `apk_installing`, `ready`.
- `statusMessage`: human-readable current progress.
- `lastError`: error message when `status` is `error`.

Managed app containers are expected to keep their primary process running. Minimal images such as `ubuntu` usually exit immediately unless you override the Docker command with something long-lived, for example `sleep infinity`.

If the redroid image is missing, app creation no longer fails with `409`. The application moves to:

```json
{
  "status": "provisioning",
  "lifecycleStage": "image_pulling",
  "statusMessage": "Docker image \"redroid/redroid:14.0.0-latest\" is not available locally. Pulling it now."
}
```

## Image and Prune Endpoints

Images:

```text
GET    /container-images
POST   /container-images/pull
DELETE /container-images/:image?force=false
```

Pulling an existing tag is the update path for mutable tags:

```json
{
  "image": "redroid/redroid:14.0.0-latest"
}
```

Pruning:

```text
POST /docker-maintenance/prune/images?danglingOnly=true
POST /docker-maintenance/prune/containers
POST /docker-maintenance/prune/networks
POST /docker-maintenance/prune/volumes
POST /docker-maintenance/prune/all
```

Settings:

```text
GET  /settings
PATCH /settings
POST /settings/reset
```

Settings are stored in `SETTINGS_PATH`, defaulting to `./data/orchestrator-settings.json`.

The orchestrator settings currently own:

- default container image,
- default viewer transport,
- default inactivity timeout,
- max APK upload size.
- scheduled image pruning interval and dangling-only mode.

## Browser Viewer

The viewer integration uses one shared display sidecar service. The sidecar owns ADB-facing viewer operations and exposes short-lived, token-scoped browser sessions.

Default compose shape:

- build `display-sidecar` locally from the root compose file,
- keep the sidecar named `rebroid-display-sidecar` on the internal platform network for server-to-server checks,
- publish the sidecar viewer port so browser iframes can connect directly with a short-lived display-session token,
- let users load `/viewer/apps/:id`, which validates their session and asks the orchestrator to create a scoped display session.

The orchestrator prepares a viewer session at:

```text
GET /android-applications/:id/scrcpy-session
```

That endpoint validates that the app is running, creates/starts the singleton display sidecar if needed, connects it to the app's isolated Docker network, re-applies the app egress policy so replies to the sidecar are allowed, and creates a short-lived display session for the app ADB target. The frontend opens the sidecar viewer URL directly with that token; raw ADB targets are never accepted without a scoped session.

While the viewer shell is open, Next.js sends an authenticated keepalive to:

```text
POST /android-applications/:id/viewer-activity
```

That refreshes `lastScrcpyActivityAt`, which is the timestamp used by the inactivity cron before stopping idle running containers.

## APK Uploads

APK files are uploaded before an Android application is created or updated. Uploads are deduplicated by SHA-256 per owner, stored under `UPLOADS_DIR/apks`, and inspected for a direct launcher icon in common `res/mipmap*` and `res/drawable*` image paths.

```text
POST   /apks
GET    /apks?ownerUserId=admin
DELETE /apks/:id
POST   /apks/cleanup
```

Create or update applications by referencing the uploaded APK:

```json
{
  "name": "Signal Android",
  "uploadedApkId": "98a530d6-a45d-466a-9cb4-c023067c4971"
}
```

## Network Policy

Each app receives its own routable network. The orchestrator resolves policy destinations and sends them to the required `rebroid-firewall-agent` over `/run/rebroid-firewall/agent.sock`. The agent applies per-container host firewall rules:

- allow backend-owned default destinations,
- allow the app-specific CIDR allowlist,
- reject everything else from that container IP.

Default destinations are configured by `NETWORK_POLICY_DEFAULT_ALLOW_DESTINATIONS` and are applied at policy reconciliation time, not stored on the application record or returned as user-managed CIDRs. Supported values are:

- `API_IP`: resolves `NETWORK_POLICY_API_CIDRS`, `NETWORK_POLICY_API_HOST`, and the orchestrator container IP on the app network when available.
- `ORCHESTRATOR_IP`: alias for `API_IP`.
- `GATEWAY_IP`: resolves the app network gateway.
- `DEFAULT`: expands to `API_IP,GATEWAY_IP`.
- explicit IPv4 addresses or CIDRs, for example `10.0.5.12` or `10.0.5.0/24`.

If the API is running outside the per-app Docker network, set `NETWORK_POLICY_API_HOST` or `NETWORK_POLICY_API_CIDRS` so `API_IP` resolves to the current API destination dynamically when policies are applied.

The firewall agent supports native rootful Docker and rootful Podman with Netavark by selecting Docker `DOCKER-USER`, a Rebroid-owned nftables table, or a Rebroid-owned `FORWARD` chain hook. Rootless engines and VM-based desktop engines are unsupported. Policy can be reconciled without restarting the Android container:

```text
PATCH /android-applications/:id/network-policy
POST  /android-applications/:id/network-policy/apply
```

Resource/profile options are stored per app. RAM and CPU limits are applied to new containers.

## Docker

From the repository root:

```bash
docker compose up --build
```

The default compose file generates the internal shared secret, NextAuth secret, display sidecar secret, and initial admin password automatically. The orchestrator container still needs a Docker-compatible socket mounted:

```text
/var/run/docker.sock:/var/run/docker.sock
```

If your engine socket is elsewhere, pass one variable:

```bash
CONTAINER_ENGINE_SOCKET=/path/to/docker-compatible.sock docker compose up --build
```

## Podman

Podman support requires native Linux rootful Podman with Netavark and a Docker-compatible API socket mounted into the orchestrator container:

```bash
CONTAINER_ENGINE_SOCKET=/run/podman/podman.sock docker compose up --build
```

### Podman Caveats

- Redroid itself is more demanding than normal OCI containers. It usually needs privileged container behavior and Android kernel support such as binder/ashmem or binderfs.
- For redroid on Linux, use a rootful Docker-compatible engine socket. A rootless Podman socket such as `/run/user/.../podman/podman.sock` can expose the API, but it still cannot launch the truly privileged container that redroid requires.
- Podman machine, Podman Desktop VM deployments, and CNI-era Podman networking are unsupported.
- Podman exposes a Docker-compatible API, but it is not a byte-for-byte Docker daemon. The skeleton uses conservative Docker API features: create network, create volume, create/start/stop/remove container, copy archive, and exec.
- Mounting the engine socket into the orchestrator is powerful. Keep this service internal, and do not expose it directly to users.

## Notes

- APK upload is persisted in the orchestrator uploads directory.
- When a container is running, APK install currently uses `docker cp`-style archive upload plus `pm install -r` inside the redroid container.
- The current viewer slice creates token-scoped display sessions through the display sidecar. The sidecar owns ADB viewer actions and the browser preview stream.
- SQLite bootstraps through TypeORM migrations on startup. The initial schema migration runs automatically when the database is empty.
