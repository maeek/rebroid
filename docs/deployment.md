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

The test stack in `deploy/compose.test.yaml` uses separate state volumes and publishes HTTPS on
port `3001` and WebRTC on UDP ports `40101–40201` by default. Override the test media range with
`TEST_DISPLAY_WEBRTC_UDP_PORT_RANGE`. Run `pnpm test:compose` to check internal routing, shared secret
mounts, and UDP publication in both resolved configurations.

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
2. As a Rebroid administrator, open **Platform settings → Runtime defaults**.
   Under **Hardware Acceleration**, choose **Host GPU** and enter the node you
   identified, such as `/dev/dri/renderD128`. Select **Save** at the top of the page. The path must
   name a render node directly under `/dev/dri`.
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
arguments. The policy takes precedence over manually supplied rendering arguments.
Other container arguments and deployment-supplied device mappings remain in effect.
The UI-managed mapping applies to Redroid containers. For independent device
mappings set `REDROID_DEVICES` in the orchestrator's environment through a
Compose override. A value in the Compose `.env` takes effect only if the
service forwards it.

If the GPU node is missing or conflicts with a deployment mapping, correct the
path or mapping and retry Start. To return to software rendering, select
**Software**, save, then stop and start affected applications. Persistent profiles
are retained. See [rendering troubleshooting](operations.md#android-gpu-rendering).

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

**Display sidecar restarts.** In Services → Display sessions, check the container state,
start and finish times, exit code, and whether the process was killed for running out of memory.
Administrators can open **Recent logs** for a bounded tail or select **Show more logs** for more output.
If a log tail exceeds the read limit, use the container engine logs on the deployment host. A running container
with an unreachable API can also indicate a listener, DNS, or connectivity problem. To investigate
the restart itself, correlate the finish time with container engine events and timestamped logs on
the deployment host.

### GPU acceleration and scrcpy 5

[Scrcpy 5 hardware decoding](https://github.com/Genymobile/scrcpy/blob/v5.0.1/doc/video.md#hardware-decoding)
accelerates video playback in the native desktop client. On Linux it uses VA-API with
an EGL renderer and the GPU's VA-API driver. `--hwdec=auto` is the desktop default and
can fall back to software; `--hwdec=vaapi` explicitly requires VA-API to work.

Rebroid's Docker display sidecar uses only the Android server from that release. It
forwards compressed H.264/Opus without decoding or transcoding, so the new desktop
decoder has no workload here. Both Compose stacks intentionally require no GPU device
mapping for the display sidecar. Adding `/dev/dri`, `gpus: all`, or VA-API libraries to
that service does not accelerate the current relay. `--hwdec` is a desktop-client
option; it is not a scrcpy server option or a Rebroid environment setting.

| Stage | Runs in | Acceleration control |
| --- | --- | --- |
| Android rendering and H.264 encoding | Redroid container | Image/host graphics support and Android MediaCodec encoders. `SCRCPY_VIDEO_ENCODER` selects an encoder exposed by Android. |
| Compressed-media relay and RTP packetization | Display sidecar | No video decoder or transcoder runs here. |
| Viewer video decoding | User's browser/device | WebSocket WebCodecs requests `prefer-hardware`; WebRTC and MediaSource use the browser's native media stack. |

Browser hardware decoding depends on the viewer machine's GPU, drivers, browser, and
codec support. A WebCodecs hardware preference is a hint, not confirmation that a GPU
was selected. See [browser decoding](display-streaming.md#browser-hardware-decoding).
Android GPU rendering and hardware video encoding are separate capabilities. The
[Android GPU rendering setting](#android-gpu-rendering-on-linux) controls Android
graphics only. The scrcpy encoder must be available inside Android.

A **separate native scrcpy desktop client** can use VA-API inside a Linux Docker container
if the daemon's host/VM exposes a compatible GPU. That client container needs the desktop
binary, libva and a matching VA-API driver, access and permissions for the relevant GPU
device nodes, and an authorized Wayland or X11 display connection supporting EGL. Docker
Compose supports explicit [device mappings](https://docs.docker.com/reference/compose-file/services/#devices)
and supplementary groups for those permissions. This is a separate graphical-client
deployment, outside Rebroid's browser viewer; it has not been validated by this project's
Compose tests. GPU passthrough alone is insufficient.

## Updates and image transfer

Pre-release state is not migrated automatically. Read the
[state reset procedures](operations.md#stored-state) before updating across a schema change.

To build and move the complete image set, including the Google Play patch worker, use
[`save-docker-images.sh`](../deploy/save-docker-images.sh) and
[`load-docker-images.sh`](../deploy/load-docker-images.sh). Both accept an optional archive
directory and support `CONTAINER_ENGINE_BIN` to select the engine.

The save script targets `linux/amd64` by default. On Apple Silicon, check
`podman machine inspect --format '{{.Rosetta}}'` if the web image build aborts
with `free(): invalid size` or `SIGABRT` during Next.js compilation. With QEMU
translating x86-64 binaries, retry the same script on a native x86-64 Linux
builder, or use an `applehv` Podman machine with Rosetta enabled. Keep the build
target `linux/amd64` for an x86-64 deployment.
