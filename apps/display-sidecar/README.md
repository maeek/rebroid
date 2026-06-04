# Android Display Sidecar

Standalone ADB display, control, clipboard, diagnostics, and browser streaming service for Android containers and devices.

The sidecar connects to Android targets over ADB, starts scrcpy on demand, and exposes a small HTTP/WebSocket/WebRTC API for browser-based viewing and remote control. It can run by itself during development, as a container next to Android runtimes, or behind a separate web gateway.

## Features

- Live Android display streaming powered by scrcpy 4.x.
- WebRTC playback for modern browsers.
- Raw H.264 WebSocket stream support for custom clients.
- Optional Opus audio playback over WebRTC and the built-in WebSocket viewer on Android 11+.
- Redroid 13/14 compatibility probing with audio, stream-control, and stable-video fallbacks.
- Experimental one-virtual-display surface per app, streamed as a separate side-by-side viewer session.
- Video-only MP4 recording by muxing H.264 packets already received by the sidecar.
- Touch, keyboard, navigation, power, rotation, volume, notification, and quick-settings controls.
- Clipboard synchronization through scrcpy control messages with ADB fallback.
- Token-scoped display sessions and viewer URLs.
- ADB helper APIs for screenshots, logcat, notification dumps, clipboard, and control actions.
- Built-in Swagger UI plus OpenAPI JSON/YAML exports.
- Optional shared-secret protection for trusted API clients.
- Docker image with Node.js, `adb`, scrcpy server assets, and a WebRTC bridge.

## How It Works

```text
browser or API client
  | HTTP / WebSocket / WebRTC
  v
display-sidecar
  | ADB TCP
  v
Android container or device
```

The service does not create Android containers and does not manage container lifecycle. It expects an ADB target that is reachable from the sidecar process, commonly a TCP ADB endpoint on port `5555`.

## Quick Start

From this directory:

```bash
npm install
npm run build
npm start
```

The service listens on `http://localhost:8000` by default.

Check process health:

```bash
curl http://localhost:8000/health
```

Open the API documentation:

```text
http://localhost:8000/docs
```

OpenAPI documents are also available at:

```text
http://localhost:8000/docs/openapi.json
http://localhost:8000/docs/openapi.yaml
```

## Docker Deployment

Build the image:

```bash
docker build -t display-sidecar:local .
```

Run it with the HTTP API exposed and a UDP range published for WebRTC:

```bash
docker run --rm \
  --name display-sidecar \
  -p 8000:8000 \
  -p 40000-40100:40000-40100/udp \
  -e DISPLAY_WEBRTC_UDP_PORT_RANGE=40000-40100 \
  -e DISPLAY_WEBRTC_ICE_HOST=<browser-reachable-host-or-ip> \
  display-sidecar:local
```

If the Android target is on a Docker network, attach the sidecar to that network:

```bash
docker network connect <android-network> display-sidecar
```

If the Android target is reachable through the host on Linux, pass the host gateway:

```bash
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -p 8000:8000 \
  -p 40000-40100:40000-40100/udp \
  display-sidecar:local
```

## Compose Deployment

Example standalone compose service:

```yaml
services:
  display-sidecar:
    build: .
    image: display-sidecar:local
    restart: unless-stopped
    environment:
      DISPLAY_SIDECAR_SHARED_SECRET_FILE: /app/secrets/display-sidecar-secret
      DISPLAY_WEBRTC_UDP_PORT_RANGE: 40000-40100
      DISPLAY_WEBRTC_ICE_HOST: 192.168.1.20
    ports:
      - "8000:8000"
      - "40000-40100:40000-40100/udp"
    volumes:
      - sidecar-secrets:/app/secrets

volumes:
  sidecar-secrets:
```

Use the same Docker network as your Android runtime when the ADB endpoint is only reachable by container DNS or container IP.

## API Documentation

Swagger is the source of truth for exact routes, request bodies, response shapes, and auth requirements:

```text
http://localhost:8000/docs
```

Use the interactive Swagger UI to:

- Create and inspect display sessions.
- Open the generated browser viewer path.
- Send control actions.
- Read clipboard, logcat, notifications, and screenshots.
- Inspect WebRTC offer request/response shapes.
- Download OpenAPI JSON/YAML for generated clients.

Most protected endpoints accept an API-key header when a shared secret is configured. The Swagger security scheme shows the exact header name and lets you authorize requests from the browser.

## Typical Flow

1. Start an Android target with TCP ADB enabled.
2. Start the sidecar on a network that can reach that ADB target.
3. Open `http://localhost:8000/docs`.
4. Create a display session with the ADB serial or `host:port` target.
5. Open the returned viewer path in a browser.
6. Use WebRTC or WebSocket streaming depending on the client capabilities.

### WebSocket audio

`/rebroid/display/stream` keeps its raw H.264 binary payloads when `audio=0`.
When `audio=1`, video payloads remain raw H.264 and Opus packets are sent as
binary messages prefixed with `RA01`, a one-byte config flag, and an eight-byte
big-endian presentation timestamp in microseconds. Android versions before 11
continue with video only.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8000` | HTTP and WebSocket listener port. |
| `DISPLAY_SESSION_TTL_SECONDS` | `900` | Default session lifetime. |
| `DISPLAY_SIDECAR_SHARED_SECRET` | empty | Inline shared secret for protected APIs. |
| `DISPLAY_SIDECAR_SHARED_SECRET_FILE` | empty | File path for the sidecar shared secret. |
| `DISPLAY_WEBRTC_UDP_PORT_RANGE` | `40000-40100` | UDP range used by the WebRTC bridge. Publish the same range on the container host. |
| `DISPLAY_WEBRTC_ICE_HOST` | empty | Browser-reachable IP/host advertised in ICE candidates. Set this when auto-detection is wrong. |
| `DISPLAY_WEBRTC_STUN_URLS` | empty | Comma-separated STUN URLs for WebRTC. |
| `SCRCPY_VERSION` | `4.0` | scrcpy server version bundled into the image. |
| `SCRCPY_SERVER_PATH` | image default | Path to the scrcpy server asset. |
| `DISPLAY_WEBRTC_BRIDGE_PATH` | image default | Path to the WebRTC bridge binary. |
| `ADB_PATH` | `adb` | ADB executable path. |
| `ADB_TEXT_OUTPUT_MAX_BYTES` | `2097152` | Max buffered text output for ADB commands. |
| `ADB_BINARY_OUTPUT_MAX_BYTES` | `67108864` | Max buffered binary output for screenshots and other binary ADB output. |
| `SCRCPY_TUNNEL_MODE` | auto | Optional tunnel strategy override: `direct`, `forward`, or `reverse`. |
| `SCRCPY_CONTROL_CHANNEL` | `true` | Enables scrcpy control channel when not set to `false`. |
| `SCRCPY_LOGCAT_ON_SERVER_EXIT` | `true` | Collects recent Android diagnostics when scrcpy exits early. |

Secret lookup order:

1. `DISPLAY_SIDECAR_SHARED_SECRET`
2. `DISPLAY_SIDECAR_SHARED_SECRET_FILE`
3. `/app/secrets/display-sidecar-secret`
4. `/data/secrets/display-sidecar-secret`

If no secret is configured, protected APIs are left unauthenticated. That is useful for isolated local development only. Shared or production deployments should provide a secret.

## Local Development

Run with TypeScript execution:

```bash
npm run start:dev
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

The build compiles the NestJS service, compiles the browser viewer assets, rewrites viewer imports, and copies static assets into `dist`.

## Operational Notes

- The sidecar must be able to reach the ADB target over TCP.
- WebRTC needs the configured UDP port range published all the way to the browser path.
- Set `DISPLAY_WEBRTC_ICE_HOST` when the browser is outside the Docker host or the sidecar advertises an unreachable container IP.
- Browser playback works best when served through HTTPS, because browser media and clipboard APIs are stricter on insecure origins.
- Redroid 13/14 display streaming requires scrcpy server 4.0 or newer. The sidecar reports its bundled server version from `/rebroid/display/capabilities`.
- Redroid 15/16 display streaming is blocked for now because current images can boot and answer ADB while still failing scrcpy video startup.
- Virtual displays are experimental and limited to one extra surface per app until Redroid resource behavior is proven under load.
- A black viewer usually means scrcpy started but Android produced no video frames. Check the session logcat endpoint and service logs for `surfaceflinger`, `ashmem`, `gralloc`, or encoder errors.

## Troubleshooting

ADB target not reachable:

```bash
docker exec display-sidecar adb connect <host>:5555
docker exec display-sidecar adb -s <host>:5555 get-state
```

Swagger does not open:

```bash
curl http://localhost:8000/health
docker logs display-sidecar
```

WebRTC connects but stays black:

- Confirm the UDP range is published, `40000-40100/udp` by default.
- Set `DISPLAY_WEBRTC_ICE_HOST` to the browser-reachable host IP.
- Check Android diagnostics through the session logcat endpoint.
- Lower stream resolution, frame rate, or bitrate to reduce encoder pressure.

Protected API returns `401`:

- Confirm the trusted API client sends the configured API-key header.
- Confirm the sidecar and client use the same secret value.
- In Docker, mount the secret at `/app/secrets/display-sidecar-secret`, set `DISPLAY_SIDECAR_SHARED_SECRET_FILE`, or pass `DISPLAY_SIDECAR_SHARED_SECRET`.

## License

See the repository license.
