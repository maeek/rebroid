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

If your Docker-compatible socket is not `/var/run/docker.sock`, pass one variable:

```bash
CONTAINER_ENGINE_SOCKET=/run/user/1000/podman/podman.sock docker compose up --build
```

On macOS with Podman Desktop, the easiest path is usually Docker socket compatibility:

```bash
sudo podman-mac-helper install
podman machine stop
podman machine start
docker compose up --build
```

If you do not use the helper, inspect the machine socket path and pass it as `CONTAINER_ENGINE_SOCKET`.

## Optional Overrides

The defaults are intended to work without a `.env` file. These are the main knobs worth overriding:

```bash
REBROID_PORT=3001
CONTAINER_ENGINE_SOCKET=/var/run/docker.sock
INITIAL_ADMIN_PASSWORD=choose-a-password
CONTAINER_IMAGE=redroid/redroid:13.0.0-latest
REDROID_PRIVILEGED=true
MAX_APK_UPLOAD_SIZE_MB=4096
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
