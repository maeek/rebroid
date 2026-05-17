# Shop Me Alone Orchestrator

NestJS backend for provisioning isolated application containers and preparing browser scrcpy viewer sessions through an internal sidecar.

## Current Shape

- `AndroidAppsModule`: CRUD for managed application containers.
- `DockerModule`: low-level Docker socket wrapper.
- `ContainerImagesModule`: list, pull/update, and remove images.
- `DockerMaintenanceModule`: prune unused containers, networks, images, and volumes.
- `NetworkIsolationModule`: per-application Docker names, volume, and internal network boundary.
- `SettingsModule`: JSON-backed runtime defaults and APK upload limits.
- Viewer session API: `GET /android-applications/:id/scrcpy-session` prepares the shared internal ws-scrcpy sidecar and returns app-scoped connection metadata for the Next.js viewer proxy.
- `HealthModule`: Docker socket health check.

## Isolation Model

Each Android application receives:

- one redroid container,
- one persistent Docker volume mounted at `/data`,
- one Docker network created with `Internal: true`.

The redroid container is attached only to its own network. When the orchestrator runs in a container, it discovers its own container id from `HOSTNAME` and attaches itself to each app network as needed. You can still override this with `ORCHESTRATOR_CONTAINER_ID` in unusual runtimes.

The frontend should call the orchestrator API and the authenticated Next.js viewer proxy. It should not connect directly to a redroid container or a public ws-scrcpy port.

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
  "statusMessage": "Docker image \"redroid/redroid:13.0.0-latest\" is not available locally. Pulling it now."
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
  "image": "redroid/redroid:13.0.0-latest"
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
- default scrcpy transport,
- default inactivity timeout,
- max APK upload size.
- scheduled image pruning interval and dangling-only mode.

## Browser Viewer

The first viewer integration uses one shared ws-scrcpy sidecar service. Do not expose ws-scrcpy directly to users; the service has no built-in authorization.

Default compose shape:

- build `ws-scrcpy-sidecar` locally from the root compose file,
- keep the sidecar named `sma-ws-scrcpy` on the internal platform network,
- keep Next.js pointed at the default internal sidecar URL so `/viewer/ws-scrcpy/*` is proxied internally,
- let users load `/viewer/apps/:id`, which validates their session and mints a short-lived viewer token scoped to the app/ADB target.

The orchestrator prepares a viewer session at:

```text
GET /android-applications/:id/scrcpy-session
```

That endpoint validates that the app is running, creates/starts the singleton ws-scrcpy sidecar if needed, connects it to the app's isolated Docker network, re-applies the app egress policy so replies to the sidecar are allowed, and attempts `adb connect <containerName>:<adbPort>` inside the sidecar. The frontend then opens the ws-scrcpy stream through the authenticated Next.js proxy path rather than through a raw public ws-scrcpy URL.

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

Each app still receives its own Docker network. When `IPTABLES_POLICY_ENABLED=false`, those networks are created as Docker `Internal` networks for a hard no-egress default.

When `IPTABLES_POLICY_ENABLED=true`, the app network is routable and the orchestrator applies per-container `DOCKER-USER` rules:

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

This mode is meant for Linux hosts where the orchestrator has permission to run `iptables`, usually by running with `NET_ADMIN` or equivalent host privileges. Policy can be reconciled without restarting the Android container:

```text
PATCH /android-applications/:id/network-policy
POST  /android-applications/:id/network-policy/apply
```

Resource/profile options are stored per app. RAM and CPU are applied to new containers. Named Docker volume size is currently advisory because the default local volume driver does not enforce quota cleanly across hosts.

## Docker

From the repository root:

```bash
docker compose up --build
```

The default compose file generates the internal shared secret, NextAuth secret, viewer token secret, and initial admin password automatically. The orchestrator container still needs a Docker-compatible socket mounted:

```text
/var/run/docker.sock:/var/run/docker.sock
```

If your engine socket is elsewhere, pass one variable:

```bash
CONTAINER_ENGINE_SOCKET=/path/to/docker-compatible.sock docker compose up --build
```

## Podman on macOS

The orchestrator talks to a Docker-compatible API through `dockerode`. It does not require Docker Desktop, but it does require a Docker-compatible socket mounted into the orchestrator container.

Recommended Podman Desktop setup:

```bash
podman machine init --cpus 4 --memory 8192 --disk-size 60
podman machine start
sudo podman-mac-helper install
podman machine stop
podman machine start
```

Verify that Podman is exposing the Docker-compatible socket:

```bash
ls -la /var/run/docker.sock
curl --unix-socket /var/run/docker.sock http://d/_ping
```

Then start the orchestrator with the Podman compose example:

```bash
CONTAINER_ENGINE_SOCKET=/var/run/docker.sock podman compose -f docker-compose.podman.example.yml up --build
```

If `/var/run/docker.sock` is not available, check Podman Desktop's Docker Compatibility settings or run:

```bash
sudo podman-mac-helper install
podman machine stop
podman machine start
```

If you prefer not to use the helper, find the Podman socket on the macOS host:

```bash
podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}'
```

Then mount that host path to `/var/run/docker.sock` inside the orchestrator container and keep `DOCKER_SOCKET_PATH=/var/run/docker.sock`.

You can pass that path as `CONTAINER_ENGINE_SOCKET=/Users/you/.../podman.sock`.

### Podman Caveats

- Redroid itself is more demanding than normal OCI containers. It usually needs privileged container behavior and Android kernel support such as binder/ashmem or binderfs. On macOS, that means the Podman machine VM must support what redroid needs; the orchestrator can create the container, but the VM kernel still decides whether redroid can boot.
- Podman exposes a Docker-compatible API, but it is not a byte-for-byte Docker daemon. The skeleton uses conservative Docker API features: create network, create volume, create/start/stop/remove container, copy archive, and exec.
- Mounting the engine socket into the orchestrator is powerful. Keep this service internal, and do not expose it directly to users.

## Notes

- APK upload is persisted in the orchestrator uploads directory.
- When a container is running, APK install currently uses `docker cp`-style archive upload plus `pm install -r` inside the redroid container.
- The current viewer slice embeds the ws-scrcpy browser stream through an authenticated Next.js proxy. Input/control hardening is still a later slice.
- SQLite bootstraps through TypeORM migrations on startup. The initial schema migration runs automatically when the database is empty.
