# Rebroid

Browser-managed application containers with a Next.js UI, a NestJS orchestrator, and a dedicated display sidecar.

## Quick Start

For a Docker host with `/var/run/docker.sock` available:

```bash
docker compose up --build
```

Open:

```text
https://localhost:3443
```

The web container now terminates HTTPS itself. On first boot it generates a self-signed certificate and stores it in the persistent `web-data` volume.

The first admin user is created automatically. Check the web logs for the generated password:

```bash
docker compose logs web
```

Look for:

```text
Initial Rebroid admin credentials: username=admin password=...
```

No `.env` file, `NEXTAUTH_URL`, shared secret, Redroid device mapping, or sidecar URL is required for the default Docker compose setup. The containers generate and persist their own secrets in Docker volumes, and the orchestrator applies the Redroid runtime defaults internally.

## Local HTTPS

The web service starts its own HTTPS listener and auto-generates a self-signed certificate on first boot. The certificate is persisted under `/app/data/certificates` inside the `web` container.

For LAN testing, run the stack normally:

```bash
docker compose up --build
```

Then open the same host or IP through the HTTPS port:

```text
https://<host-or-ip>:3443
```

If you open the stack from another machine or via a LAN IP, set the certificate host list before starting the stack so the generated certificate includes that IP or hostname:

```bash
export REBROID_TLS_HOSTS="192.168.1.11,localhost,127.0.0.1"
docker compose up --build
```

Without that override, the default certificate only covers `localhost` and `127.0.0.1`.

WebSocket viewer traffic is proxied through the same endpoint; no separate WebSocket proxy configuration is required.

To trust the generated certificate, start the stack once and export it from the web container:

```bash
docker compose cp web:/app/data/certificates/rebroid-web.crt ./rebroid-web.crt
```

On Linux:

```bash
sudo cp rebroid-web.crt /usr/local/share/ca-certificates/rebroid-web.crt
sudo update-ca-certificates
```

On macOS:

```bash
sudo security add-trusted-cert -d -r trustAsRoot -k /Library/Keychains/System.keychain rebroid-web.crt
```

Restart the browser after trusting the certificate. You can change the published HTTPS port with `REBROID_HTTPS_PORT`, for example `REBROID_HTTPS_PORT=443`.

## Podman Socket

The default compose file targets Docker. If your Docker-compatible socket is not `/var/run/docker.sock`, pass the rootful socket path explicitly:

```bash
CONTAINER_ENGINE_SOCKET=/run/podman/podman.sock docker compose up --build
```

Do not point this at a rootless Podman socket such as `/run/user/1000/podman/podman.sock` when you want to run redroid. Redroid needs a truly privileged container, and a rootless engine cannot provide that.

Podman support requires native Linux rootful Podman with Netavark. Podman machine and Podman Desktop VM deployments are unsupported because the firewall agent must administer the same Linux host network namespace used by application containers.

## External Container Engine

Rebroid requires a native Linux rootful Docker-compatible engine socket. Embedded Docker is not supported. The orchestrator uses the socket for app lifecycle operations and fails startup when the socket is missing.

The `firewall-agent` service runs with host networking and `NET_ADMIN`. It administers Rebroid-owned host firewall rules and communicates with the orchestrator only through the shared `/run/rebroid-firewall/agent.sock` Unix socket. It does not expose a public port.

## Redroid Host Checks

If a redroid container exits immediately with little or no container log output, verify the host before debugging the web viewer:

```bash
docker info
# or: podman info
ls -la /dev/binderfs /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null
grep -E 'binder|ashmem' /proc/filesystems /proc/misc 2>/dev/null
```

Docker hosts that expose `/dev/ashmem` after `sudo modprobe ashmem_linux` do not need a compose variable. Rebroid tries to pass `/dev/ashmem` to managed Redroid containers by default. If the device is missing, container creation is retried without it so Podman hosts that only use `androidboot.use_memfd=true` still work.

For Linux hosts, the built-in Redroid base arguments use conservative runtime defaults:

```text
androidboot.redroid_gpu_mode=guest androidboot.use_memfd=true ro.secure=0 ro.debuggable=1
```

`androidboot.redroid_gpu_mode=auto` can select a GPU path that is invalid inside the container. Once the container boots reliably, switch to an explicit GPU node only if the host exposes one correctly.

On SELinux hosts, pass `CONTAINER_SECURITY_OPTS=label=disable` so the privileged Android runtime can access the host devices it needs.

## Configuration Surface

The defaults are intended to work without a `.env` file. For a normal admin install, these are the only compose-level knobs worth knowing:

```bash
REBROID_HTTPS_PORT=3443
REBROID_TLS_HOSTS=localhost,127.0.0.1
CONTAINER_ENGINE_SOCKET=/var/run/docker.sock
DISPLAY_WEBRTC_UDP_PORT_RANGE=40000-40100
DISPLAY_WEBRTC_ICE_HOST=
```

Everything below should usually be handled from the UI instead of compose:

- default Redroid image
- APK upload limit
- default app inactivity timeout
- viewer quality defaults
- image pruning policy

For unusual hosts, use a compose override rather than expanding the default compose file. Examples include SELinux label handling, extra Redroid devices, a custom Redroid image, or changing Redroid boot timeouts:

```yaml
services:
  orchestrator:
    environment:
      CONTAINER_SECURITY_OPTS: label=disable
      CONTAINER_IMAGE: redroid/redroid:15.0.0-latest
      REDROID_BOOT_TIMEOUT_SECONDS: 420
      REDROID_DEVICES: /dev/dri:/dev/dri:rwm
      DOCKER_STOPPING_STALE_TIMEOUT_SECONDS: 60
      DOCKER_REQUEST_TIMEOUT_MS: 15000
      DOCKER_CONNECTION_TIMEOUT_MS: 5000
```

`REDROID_CGROUPNS_MODE=private` and `REDROID_OPTIONAL_DEVICES=/dev/ashmem:/dev/ashmem:rwm` are already the built-in defaults. Keep the cgroup namespace private when you use CPU or memory limits so Android runtime processes stay inside the Docker-accounted cgroup. `REDROID_CGROUPNS_MODE=host` is available as an escape hatch for unusual hosts, but it can make privileged redroid processes visible in host process monitors while Docker/Portainer stats only report a small outer-container load. `REDROID_DEVICES` is for required mappings and will fail container creation if the host path is missing; `REDROID_OPTIONAL_DEVICES` is for best-effort mappings such as ashmem.

`DOCKER_STOPPING_STALE_TIMEOUT_SECONDS` controls how long an interrupted stop may remain visibly in progress before the orchestrator trusts Docker's current runtime state and recovers the app to either running or stopped. The built-in default is `60`.

`DOCKER_REQUEST_TIMEOUT_MS` bounds ordinary Docker API requests so inventory and cleanup calls fail fast when the container engine is blocked. `DOCKER_CONNECTION_TIMEOUT_MS` separately bounds connection setup. Background removal retries cleanup after failures. The built-in defaults are `15000` and `5000`.

Everything else is primarily for advanced deployments: custom networks, external orchestrator/web separation, sidecar image overrides, or firewall adapter tuning.

Network allowlists are applied by the firewall agent while apps are running. Docker `DOCKER-USER`, nftables, and rootful Podman Netavark hosts are supported. Rootless engines, Docker Desktop VM mode, Podman machine VM mode, and CNI-era Podman networking are unsupported deployment targets.

## Services

- `web`: Next.js UI, backend-for-frontend, and built-in HTTPS proxy for secure browser APIs such as WebCodecs.
- `orchestrator`: NestJS API that manages containers through the Docker-compatible socket.
- `firewall-agent`: host-network service that applies Rebroid-owned outbound firewall rules.
- `display-sidecar`: display service for ADB viewer sessions and streaming.

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
