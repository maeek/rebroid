# Deployment

Rebroid's supplied Compose stack targets one native Linux amd64 host. For local source development,
see [Contributing](../CONTRIBUTING.md#local-development).

## Host requirements

- A rootful engine and Compose provider with support for named-volume subdirectory mounts
  (`volume.subpath`), and access to the engine socket.
- Android binder support for ReDroid.
- Network access for initial builds, runtime images, and model downloads.
- Host firewall support: Docker `DOCKER-USER`, nftables, or rootful Podman with Netavark.

Rootless engines, Docker Desktop, Podman machine, and CNI-era Podman networking are unsupported.
The firewall agent must manage the same host network namespace as the application containers.
On iptables deployments, the agent replaces its IPv4 forwarding rules in one `iptables-restore`
commit and preserves unrelated host rules.

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

The test overlay uses Docker Compose's [`!override` tag](https://docs.docker.com/reference/compose-file/merge/#replace-value),
which requires Compose 2.24.4 or later. Apply the overlay on top of the base file.

```bash
docker compose -f deploy/compose.yaml -f deploy/compose.test.yaml up -d --build
```

The test stack keeps its existing state volumes and defaults to [https://localhost:3001](https://localhost:3001)
and WebRTC UDP port `40101`. Override them with `REBROID_PORT` and `TEST_DISPLAY_WEBRTC_UDP_PORT`. Run the test and
production stacks on separate hosts if they are active at the same time. Their firewall agents
manage the same host rules, and their orchestrators use the same managed resource prefix.
Include both files in subsequent test-stack commands, including `exec web` to read the generated
password. Run `pnpm test:compose` to verify both resolved configurations.

Use Compose service names for commands such as `docker compose -f deploy/compose.yaml logs web`.
Compose assigns container names automatically. The display sidecar keeps its explicit name
because the orchestrator uses it to find the container for ADB network attachment and restarts.

## Configuration

### External Android devices

The main Compose stack starts an `external-adb` service from the display-sidecar image. This
broker runs its own ADB server, verifies external phones and VMs, and serves their viewer sessions.
It shares a separate Compose network with the orchestrator, web and edge. Its Android host keys
live in the `external-adb-keys` volume.

On first startup, the orchestrator generates a dedicated broker credential in
`shared-secrets/external-adb/broker-secret`. Web reads it from the shared volume. The broker mounts
only the `external-adb` subdirectory read-only after the orchestrator is healthy. The credential
survives container recreation. The container images supply the broker URL and credential paths.
Deployments upgrading from a host-provided `EXTERNAL_ADB_BROKER_SECRET` switch to this file
when all three services are recreated with the updated images and Compose file.

After starting the stack, enable **External devices** under
**Administration → Feature management**. Turning the flag off retires active attachments and
keeps registrations available for cleanup.

TCP enrollment defaults to an empty allowlist. To enroll TCP devices, set the same approved
IPv4 addresses and ports on both services in a Compose override. If you previously set
`EXTERNAL_ADB_TCP_ENDPOINTS` in your deployment environment, pass it to both services in
the override. For example, save this as `deploy/compose.tcp.yaml`:

```yaml
services:
  orchestrator:
    environment:
      EXTERNAL_ADB_TCP_ENDPOINTS: "${EXTERNAL_ADB_TCP_ENDPOINTS:?Set approved IPv4 addresses and ports}"
  external-adb:
    environment:
      EXTERNAL_ADB_TCP_ENDPOINTS: "${EXTERNAL_ADB_TCP_ENDPOINTS:?Set approved IPv4 addresses and ports}"
```

```bash
EXTERNAL_ADB_TCP_ENDPOINTS=192.168.1.20:5555 docker compose -f deploy/compose.yaml -f deploy/compose.tcp.yaml up -d --build
```

The broker rejects TCP targets on its directly attached service network. Use a trusted device
network or an authenticated tunnel for legacy TCP ADB.

For host USB on native Linux, add `deploy/compose.usb.yaml`. Set `EXTERNAL_ADB_USB_PORTS`
to the approved port paths reported by native ADB. Set `EXTERNAL_ADB_USB_GID` to the numeric
group that has read and write access to the intended Android USB nodes through host udev rules.
For example, for port `1-2` and group `1002`, run:

```bash
EXTERNAL_ADB_USB_PORTS=1-2 EXTERNAL_ADB_USB_GID=1002 \
  docker compose -f deploy/compose.yaml -f deploy/compose.usb.yaml up -d
```

The override mounts the host's `/dev/bus/usb` read-only and grants the broker access to USB device
nodes. Include the override on subsequent deployments that use USB. To detach USB, run
`docker compose -f deploy/compose.yaml up -d external-adb`. Include any TCP or other overrides
you still use in both commands. [Android hardware setup](https://developer.android.com/studio/run/device) ·
[Docker device access](https://docs.docker.com/reference/cli/docker/container/run/#using-dynamically-created-devices---device-cgroup-rule)

The broker is a separate instance of the sidecar image. Compose can recreate it while retaining
the key volume. Each restart invalidates current attachments and requires a new verification.
The managed display sidecar continues to use its existing container configuration.
Both services inherit the display-sidecar image's health check. For the managed sidecar,
`/health/ready` reports liveness. For a configured broker, it also probes the ADB executable
and checks access to its key directory.
Its private `/health/ready` response reports those checks and the optional USB mount separately.
A missing USB mount leaves TCP available. The readiness probe does not launch the ADB server
or contact a device. The orchestrator also requires an authenticated feature synchronization
before reporting the broker as available. Edge startup requires only that the broker process
has started, so broker readiness cannot block managed viewing.

Only administrators can enroll USB phones, and each USB registration is private to its owner.
Approve only the broker key you expect on Android. For a phone that already trusts the broker,
the broker must observe an unplug and replug on the approved port before verification.
For TCP, confirm a fresh Android prompt or present the verification code from the device or VM
console as directed in **Devices → Connection**. [Enrollment and verification](operator-console.md#external-android-devices)

The edge routes external viewer assets, media, and controls at `/external-display/`.
The broker publishes UDP port `40002` for external WebRTC. Set
`EXTERNAL_DISPLAY_WEBRTC_UDP_PORT` if that port is taken. The viewer uses WebSocket when
WebRTC is disabled or cannot connect. The broker's enrollment and display administration API
stays on the private network.

Most runtime defaults, APK limits, inactivity timeouts, and maintenance settings are managed in the UI.
These Compose variables control deployment wiring:

| Variable                        | Default                | Purpose                                              |
| ------------------------------- | ---------------------- | ---------------------------------------------------- |
| `REBROID_HTTPS_PORT`            | `3443`                 | Published HTTPS port.                                |
| `REBROID_TLS_HOSTS`             | `localhost,127.0.0.1`  | Certificate hostnames and IPs.                       |
| `REBROID_PUBLIC_HOSTS`          | TLS host list          | Browser hosts accepted by nginx.                     |
| `CONTAINER_ENGINE_SOCKET`       | `/var/run/docker.sock` | Rootful engine socket mounted into the orchestrator. |
| `DISPLAY_WEBRTC_UDP_PORT`       | `40000`                | Published UDP media port.                           |
| `DISPLAY_WEBRTC_ICE_HOST`       | Automatic              | Browser-reachable address advertised for WebRTC.     |

The orchestrator creates the internal credential in the `shared-secrets` volume. Web, the display
sidecar, and the firewall agent read it from read-only mounts. Test deployments use the same
mechanism with their test volume. If a previous test deployment used `ORCHESTRATOR_SHARED_SECRET`
from the environment, update any direct API clients to use the credential in that test volume.

The orchestrator runs as `0:0` in Compose so it can open root-owned engine sockets without a
host-specific group ID. Opening that socket grants control of the rootful engine. The engine
starts privileged Redroid containers when requested. No Compose service runs in privileged mode.
The firewall agent uses host networking and `NET_ADMIN` to manage host rules, and communicates
over a private Unix socket. See the
[architecture overview](architecture.md) for service ownership and storage.

For advanced settings such as `REDROID_COLLECT_BOOT_EVENTS`, `GAPPS_PATCHER_IMAGE`, or
`SCRCPY_VIDEO_ENCODER`, add a Compose override that sets the variable on the relevant service.
The test stack inherits the orchestrator defaults for the Redroid image, ADB port, and runtime
privilege. Use a test override to customize those defaults, set `INITIAL_ADMIN_PASSWORD` on web,
or set `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` under `web.build.args`.

## Local HTTPS

nginx terminates HTTPS using the certificate under `/app/data/certificates` in `web-data`.
The edge accepts the hostnames web records alongside the certificate. Set
`REBROID_PUBLIC_HOSTS` to override that browser host list. The edge also accepts `rebroid-web`
for internal HTTPS checks.
Your browser must trust the self-signed certificate, or the deployment must supply a certificate
trusted by your clients.

For LAN access, configure the host list before the first start:

```bash
REBROID_TLS_HOSTS=192.168.1.11,localhost,127.0.0.1 \
  docker compose -f deploy/compose.yaml up -d --build
```

Then open `https://192.168.1.11:3443`. The default certificate covers `localhost` and `127.0.0.1`.
Keep the same host list in the environment or in a Compose `.env` file for future starts.
Web regenerates the certificate when that list changes. Apply the new configuration with
`docker compose -f deploy/compose.yaml up -d`. Compose restarts the edge when it updates web.
Export the public certificate after startup.

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
The container terminal uses the same HTTPS origin and a separate
`/terminal/docker/containers/` WebSocket route to the orchestrator. Forward upgrades
on that route when running another proxy in front of nginx.
The sidecar needs private access to the web backend for viewer authorization. On the Compose
network its default `WEB_INTERNAL_URL` is `http://web:3101`. A standalone sidecar needs the
corresponding web URL and the shared service secret. Use the same HTTPS origin for the web console
and the browser viewer.
Deploy web, orchestrator, display sidecar, and edge together when upgrading from token-based viewer
links. Reopen existing viewers from the app page after the upgrade.
WebRTC media uses the published UDP port and needs a browser-reachable address. For extra proxy
layers, enable WebSocket upgrades and disable media buffering. See
[display proxy configuration](display-streaming.md#reverse-proxies).

When upgrading from the UDP range, replace `DISPLAY_WEBRTC_UDP_PORT_RANGE` with
`DISPLAY_WEBRTC_UDP_PORT` if you use a custom port. For the test stack, use
`TEST_DISPLAY_WEBRTC_UDP_PORT`. Rebuild and recreate the display sidecar with the
updated Compose file, and forward its configured UDP port. External WebRTC uses the broker’s separate port.

## Podman socket

Native Linux rootful Podman with Netavark can use its Docker-compatible socket:

```bash
DOCKER_HOST=unix:///run/podman/podman.sock \
CONTAINER_ENGINE_SOCKET=/run/podman/podman.sock \
  docker compose -f deploy/compose.yaml up -d --build
```

If SELinux blocks the orchestrator from reading the Podman socket, add this Compose override
for the orchestrator. It disables SELinux labeling for that container.

```yaml
services:
  orchestrator:
    security_opt:
      - label=disable
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

### Android GPU rendering on Linux

Rebroid defaults to **Software** rendering. Stock Redroid also supports using the Docker
host GPU to draw Android applications. For an AMD Ryzen 7 4800U with Radeon Graphics,
use a Linux Docker host with its AMD graphics driver loaded and a DRM render node
available. Working VA-API in Jellyfin is evidence of device access for Jellyfin.
Verify Redroid rendering separately for the exact image and driver combination.
[Redroid GPU configuration](https://github.com/remote-android/redroid-doc#configuration)

1. On the **Linux machine running the Docker daemon**, list its render nodes with
   `ls -l /dev/dri/renderD*`. If there is more than one, use
   `ls -l /dev/dri/by-path` and `lspci -k` to match the AMD GPU to its render node.
   If Docker runs in a VM, use the device visible inside that VM.
2. As a Rebroid administrator, open **Administration → General**.
   Under **Hardware Acceleration**, choose **Host GPU** and enter the node you
   identified, such as `/dev/dri/renderD128`. Select **Save** at the top of the page and confirm the
   rendering change. The path must name a render node directly under `/dev/dri`.
3. Try one stock Redroid Android 16 application with a persistent test profile. Stop and start
   it to apply the saved setting. New Redroid runtimes use the setting on creation.
   Rebroid replaces a stopped container if its configuration differs and reuses
   its persistent profile volume. Temporary profiles follow their usual ephemeral
   storage rules.
4. Confirm that Android boots, the viewer shows the image, and input works.
   Check the renderer reported by Android, for example the GLES line in
   `adb shell dumpsys SurfaceFlinger` through an authorized ADB connection.
   Look for the Radeon GPU and driver in the renderer name. A software renderer
   such as SwiftShader or llvmpipe means the GPU is not doing the rendering.
   The saved and recorded settings in Rebroid describe configuration, not actual
   hardware use. Stop and start the application again to confirm that the profile
   data is retained and the viewer reconnects.

Saving applies the policy to future runtime starts across managed Redroid applications.
It does not restart applications or the display sidecar. The orchestrator passes
the required device mapping to Docker and sets the Redroid renderer and GPU node
arguments. The app configuration omits those platform-managed rendering arguments.
Administrators can see the current Docker command under the app's Diagnostics.
Other container arguments and deployment-supplied device mappings remain in effect.
The UI-managed mapping applies to Redroid containers. For independent device
mappings set `REDROID_DEVICES` in the orchestrator's environment through a
Compose override. A value in the Compose `.env` takes effect only if the
service forwards it.

If the GPU node is missing or conflicts with a deployment mapping, correct the
path or mapping and retry Start. To return to software rendering, select
**Software**, save, then stop and start affected applications. Persistent profiles
are retained. See [rendering troubleshooting](operations.md#android-gpu-rendering).

If Android boots after a rendering change and the app reports an ADB connection timeout,
Rebroid retries the connection to that app. If it still fails, use **Restart sidecar**
under **Administration → Casting**, then retry the app.
Restarting the sidecar interrupts active display sessions.

Docker can skip explicit same-path device mapping checks for privileged containers.
Confirm the render node on the host and verify the renderer after Android starts.
[Moby device handling](https://github.com/moby/moby/blob/master/daemon/oci_linux.go#L801-L844)

## Redroid display streaming support

Live displays admit ReDroid 13–16 with scrcpy 5.0.1. Android 16 video and control have been
reported working; Android 15 and Android 16 audio still require manual verification.
Android 17 remains gated. See [display compatibility and audio diagnosis](display-streaming.md#diagnostics).

On a supported image, confirmed audio failures may disable capture; unrelated startup failures
preserve the requested audio setting. Main-display compatibility retries may use ADB-backed controls.
Requested resolution, frame rate, and bitrate are not silently reduced. If the viewer reconnects
repeatedly, check its compatibility diagnostics and the display-sidecar logs.

**Display sidecar restarts.** In **Administration → Casting**, check the Connection panel for the
container state, start and finish times, exit code, and whether the process was killed for running out of memory.
If the UI reports that the restart is unconfirmed, refresh the sidecar status before retrying.
Administrators can select **View logs** to open the container's Docker **Logs** tab and read its recent output.
If a log tail exceeds the read limit, use the container engine logs on the deployment host. A running container
with an unreachable API can also indicate a listener, DNS, or connectivity problem. To investigate
the restart itself, correlate the finish time with container engine events and timestamped logs on
the deployment host.

### GPU acceleration and scrcpy 5

Android renders and encodes video in the managed runtime. The display sidecar forwards compressed
packets to the browser, which decodes them. The sidecar image needs no GPU mapping for this path.
Scrcpy’s `--hwdec` configures its standalone desktop player. For browser decoder behavior see
[browser hardware decoding](display-streaming.md#browser-hardware-decoding). For guest graphics
and encoder selection see [Android GPU rendering](#android-gpu-rendering-on-linux).

## Updates and image transfer

Pre-release state is not migrated automatically. Read the
[state reset procedures](operations.md#stored-state) before updating across a schema change.

To build and move the Rebroid service images and Google Play patch worker, use
[`save-docker-images.sh`](../deploy/save-docker-images.sh) and
[`load-docker-images.sh`](../deploy/load-docker-images.sh). Both accept an optional archive
directory and support `CONTAINER_ENGINE_BIN` to select the engine. Each export replaces its
archive after the engine finishes writing it. A failed export preserves the previous copy of
that image. Load the archives on the deployment host, then start the prebuilt stack from the
repository root.

The archives carry the Rebroid images. The deployment host still needs access to the Android
runtime images and any OCR models or Google Play packages it will use.

```bash
docker compose -f deploy/compose.yaml up -d --no-build --pull never
```

The save script targets `linux/amd64` by default. On Apple Silicon, check
`podman machine inspect --format '{{.Rosetta}}'` if the web image build aborts
with `free(): invalid size` or `SIGABRT` during Next.js compilation. With QEMU
translating x86-64 binaries, retry the same script on a native x86-64 Linux
builder, or use an `applehv` Podman machine with Rosetta enabled. Keep the build
target `linux/amd64` for an x86-64 deployment.
