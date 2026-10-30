# Deployment

Rebroid's supplied Compose stack targets one native Linux amd64 host. For local source development,
see [Contributing](../CONTRIBUTING.md#local-development).

## Host requirements

- A rootful Docker Engine, Compose, and access to the engine socket.
- Android binder support for ReDroid.
- Network access for initial builds, runtime images, and model downloads.
- Host firewall support: Docker `DOCKER-USER`, nftables, or rootful Podman with Netavark.

Rootless engines, Docker Desktop, Podman machine, and CNI-era Podman networking are unsupported.
The firewall agent must manage the same host network namespace as the application containers.

## Start the stack

Run from the repository root:

```bash
docker compose -f deploy/compose.yaml up -d --build
```

Open [https://localhost:3443](https://localhost:3443). The initial build includes OCR dependencies
and may take some time. No `.env` file is required for the default deployment: internal secrets
and a self-signed certificate are generated and persisted in Docker volumes.

Retrieve the initial password, sign in as `admin`, and change it when prompted:

```bash
docker compose -f deploy/compose.yaml exec web cat /app/data/initial-admin-password
```

The generated password is stored in a protected file and never printed to logs.

## Configuration

Most runtime defaults, APK limits, inactivity timeouts, and maintenance settings are managed in the UI.
These Compose variables control deployment wiring:

| Variable                        | Default                | Purpose                                              |
| ------------------------------- | ---------------------- | ---------------------------------------------------- |
| `REBROID_HTTPS_PORT`            | `3443`                 | Published HTTPS port.                                |
| `REBROID_TLS_HOSTS`             | `localhost,127.0.0.1`  | Certificate hostnames and IPs.                       |
| `REBROID_PUBLIC_HOSTS`          | TLS host list          | Browser hosts accepted by nginx.                     |
| `CONTAINER_ENGINE_SOCKET`       | `/var/run/docker.sock` | Rootful engine socket mounted into the orchestrator. |
| `DISPLAY_WEBRTC_UDP_PORT_RANGE` | `40000-40100`          | Published UDP media ports.                           |
| `DISPLAY_WEBRTC_ICE_HOST`       | Automatic              | Browser-reachable address advertised for WebRTC.     |

The orchestrator requires an external engine socket. The firewall agent uses host networking
and `NET_ADMIN`, and communicates over a private Unix socket. See the
[architecture overview](architecture.md) for service ownership and storage.

## Local HTTPS

nginx terminates HTTPS using the certificate under `/app/data/certificates` in `web-data`.
Your browser must trust the self-signed certificate, or the deployment must supply a certificate
trusted by your clients.

For LAN access, configure the host list before the first start:

```bash
REBROID_TLS_HOSTS=192.168.1.11,localhost,127.0.0.1 \
  docker compose -f deploy/compose.yaml up -d --build
```

Then open `https://192.168.1.11:3443`. The default certificate covers only `localhost` and `127.0.0.1`.
Export the generated public certificate after startup:

```bash
docker compose -f deploy/compose.yaml cp web:/app/data/certificates/rebroid-web.crt ./rebroid-web.crt
```

On a Debian/Ubuntu client:

```bash
sudo cp rebroid-web.crt /usr/local/share/ca-certificates/rebroid-web.crt
sudo update-ca-certificates
```

On a macOS client:

```bash
sudo security add-trusted-cert -d -r trustAsRoot -k /Library/Keychains/System.keychain rebroid-web.crt
```

Restart the browser after trusting the certificate.

## Reverse proxies and media

List the final browser hostname in `REBROID_PUBLIC_HOSTS` when another proxy fronts Rebroid.
The edge validates hosts and overwrites forwarded host, protocol, and client-address headers;
it does not implicitly trust a proxy's claimed client address.

Viewer assets, WebSocket media, and WebRTC signaling go directly from nginx to the display sidecar.
WebRTC media uses the published UDP range and needs a browser-reachable address. For extra proxy
layers, enable WebSocket upgrades and disable media buffering. See
[display proxy configuration](display-streaming.md#reverse-proxies).

## Podman socket

Native Linux rootful Podman with Netavark can use its Docker-compatible socket:

```bash
CONTAINER_ENGINE_SOCKET=/run/podman/podman.sock \
  docker compose -f deploy/compose.yaml up -d --build
```

A rootless socket cannot provide ReDroid's privileged runtime or host firewall access.

## Redroid host checks

If Android exits before producing useful logs, check the host first:

```bash
docker info
ls -la /dev/binderfs /dev/binder /dev/hwbinder /dev/vndbinder
```

The default boot arguments use guest rendering and memfd:

```text
androidboot.redroid_gpu_mode=guest androidboot.use_memfd=true ro.secure=0 ro.debuggable=1
```

Rebroid attempts the optional `/dev/ashmem` mapping and retries without it if unavailable.
Keep `REDROID_CGROUPNS_MODE=private` when applying CPU or memory limits so Android processes
remain in the container's accounted cgroup.

For unusual hosts, use a Compose override. On SELinux hosts, `CONTAINER_SECURITY_OPTS=label=disable`
may be required for device access. `REDROID_DEVICES` is for required device mappings and fails
when a path is missing; `REDROID_OPTIONAL_DEVICES` is for best-effort mappings.

## Redroid display streaming support

Live displays support ReDroid 13 and 14. Versions 15 and 16 are blocked because their current
video startup behavior is incompatible with the viewer.

On a supported image, compatibility retries may disable audio capture or use ADB-backed controls.
Requested resolution, frame rate, and bitrate are not silently reduced. If the viewer reconnects
repeatedly, check its compatibility diagnostics and the display-sidecar logs.

## Updates and image transfer

Pre-release state is not migrated automatically. Read the
[state reset procedures](operations.md#stored-state) before updating across a schema change.

To build and move the complete image set, including the Google Play patch worker, use
[`save-docker-images.sh`](../deploy/save-docker-images.sh) and
[`load-docker-images.sh`](../deploy/load-docker-images.sh). Both accept an optional archive
directory and support `CONTAINER_ENGINE_BIN` to select the engine.
