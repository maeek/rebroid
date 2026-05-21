# Rebroid

Browser-managed application containers with a Next.js UI, a NestJS orchestrator, and an internal ws-scrcpy sidecar.

## Quick Start

For a Docker host with `/var/run/docker.sock` available:

```bash
docker compose up --build
```

Open:

```text
http://localhost:3001
```

The first admin user is created automatically. Check the web logs for the generated password:

```bash
docker compose logs web
```

Look for:

```text
Initial Rebroid admin credentials: username=admin password=...
```

No `NEXTAUTH_URL`, shared secret, or sidecar URL is required for the default compose setup. The containers generate and persist their own secrets in Docker volumes.

## Podman Socket

If your Docker-compatible socket is not `/var/run/docker.sock`, pass the rootful socket path explicitly:

```bash
CONTAINER_ENGINE_SOCKET=/run/podman/podman.sock docker compose up --build
```

Do not point this at a rootless Podman socket such as `/run/user/1000/podman/podman.sock` when you want to run redroid. Redroid needs a truly privileged container, and a rootless engine cannot provide that.

On macOS with Podman Desktop, the easiest path is usually Docker socket compatibility:

```bash
sudo podman-mac-helper install
podman machine stop
podman machine start
docker compose up --build
```

If `podman compose` delegates to `docker-compose` and fails with a socket like `podman-machine-default-api.sock`, but `podman machine list` shows a differently named machine such as `machine`, `DOCKER_HOST` is stale. Compare the failing path with:

```bash
podman machine inspect machine --format '{{.ConnectionInfo.PodmanSocket.Path}}'
```

Then either unset `DOCKER_HOST` or export the real socket before running compose:

```bash
unset DOCKER_HOST
# or
export DOCKER_HOST=unix:///var/folders/.../T/podman/machine-api.sock
podman compose up --build
```

The `Can't add file ... .dockerignore to tar: io: read/write on closed pipe` lines are a follow-on symptom of the same daemon connection failure, not a broken `.dockerignore` file.

If you do not use the helper, inspect the machine socket path and pass it as `CONTAINER_ENGINE_SOCKET`.

## Internal Docker Mode

The default production compose setup uses the host/rootful Docker-compatible socket. This is the recommended mode for redroid and scrcpy because the application containers and the `ws-scrcpy` sidecar live in the same container engine and Docker networks.

The orchestrator image can still start its own internal Docker daemon when no socket is mounted, but that mode needs one extra viewer wiring step: the sidecar created inside the orchestrator's internal daemon must be published back on the orchestrator container network namespace, and the web build must proxy to that published port.

Use the internal compose file only when you intentionally do not mount a host engine socket:

```bash
docker compose -f docker-compose.internal.yml up --build
```

If `WS_SCRCPY_INTERNAL_BASE_URL` still points at `http://rebroid-ws-scrcpy:8000`, the web container is trying to reach a sidecar in the outer compose network while the app containers are inside the orchestrator's inner Docker daemon. That topology cannot stream because those networks are different.

Do not point `CONTAINER_ENGINE_SOCKET` at a missing file to force internal mode. Compose can create a directory at `/var/run/docker.sock`, which prevents the internal daemon from binding its Unix socket.

## Redroid Host Checks

If a redroid container exits immediately with little or no container log output, verify the host before debugging the web viewer:

```bash
sudo podman info
ls -la /dev/binderfs /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null
grep -E 'binder|ashmem' /proc/filesystems /proc/misc 2>/dev/null
```

For Linux hosts running Podman, start with conservative runtime arguments:

```text
androidboot.redroid_gpu_mode=guest androidboot.use_memfd=true ro.secure=0
```

`androidboot.redroid_gpu_mode=auto` can select a GPU path that is invalid inside the container. Once the container boots reliably, switch to an explicit GPU node only if the host exposes one correctly.

On SELinux hosts, pass `CONTAINER_SECURITY_OPTS=label=disable` so the privileged Android runtime can access the host devices it needs.

## Optional Overrides

The defaults are intended to work without a `.env` file. These are the main knobs worth overriding:

```bash
REBROID_PORT=3001
CONTAINER_ENGINE_SOCKET=/var/run/docker.sock
INITIAL_ADMIN_PASSWORD=choose-a-password
CONTAINER_IMAGE=redroid/redroid:13.0.0-latest
REDROID_PRIVILEGED=true
MAX_APK_UPLOAD_SIZE_MB=4096
CONTAINER_SECURITY_OPTS=label=disable
```

Everything else is primarily for advanced deployments: custom networks, external orchestrator/web separation, sidecar image overrides, or Linux iptables policy tuning.

## Services

- `web`: Next.js UI and authenticated viewer proxy.
- `orchestrator`: NestJS API that manages containers through the Docker-compatible socket.
- `ws-scrcpy`: internal viewer sidecar. It is intentionally not published to the host.

## Stored Data

Docker volumes keep runtime state:

- `web-data`: users, web settings, generated auth secrets, app icons.
- `orchestrator-data`: SQLite database and orchestrator settings.
- `orchestrator-uploads`: uploaded APK files.
- `shared-secrets`: the internal web-to-orchestrator shared secret.

To reset everything:

```bash
docker compose down -v
```
