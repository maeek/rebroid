<h1 align="center">Rebroid</h1>

<p align="center">
  <b>Self-hosted Android apps, controlled from your browser.</b><br>
  Run apps on your Linux host. Open their live displays, build workflows,<br>
  and give an AI a device task — all from one web workspace.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/deployment-self--hosted-8b5cf6?style=flat-square" alt="Deployment: self-hosted">
  <img src="https://img.shields.io/badge/host-Linux%20amd64-475569?style=flat-square" alt="Host: Linux amd64">
  <img src="https://img.shields.io/badge/Android-13%20%26%2014-3b8763?style=flat-square" alt="Supported Android displays: 13 and 14">
  <img src="https://img.shields.io/badge/status-pre--release-d69e2e?style=flat-square" alt="Status: pre-release">
</p>

<p align="center">
  <a href="#get-started"><b>Get started</b></a> ·
  <a href="#features">Features</a> ·
  <a href="#ai-device-control">AI device control</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <a href="docs/images/viewer.png">
    <img src="docs/images/viewer.png" alt="Rebroid application workspace with a live Android display, WebRTC stream settings, and device controls" width="100%">
  </a>
  <br>
  <sub>A live Android display, streaming settings, and device controls in one browser workspace.</sub>
</p>

Rebroid runs Android applications in [ReDroid](https://github.com/remote-android/redroid-doc)
containers on a single Linux host. Upload an APK, start an application, and open its live display.
Use it for remote Android workspaces, manual app testing, and repetitive app tasks.

> [!IMPORTANT]
> **Pre-release:** Rebroid is under active development. Database schema changes can require a
> clean-state reset; existing data is not automatically migrated. Read the
> [state and upgrade notes](docs/operations.md#stored-state) before updating a deployment.

<table>
  <tr>
    <td width="25%" valign="top">
      <h3>📱 Android in your browser</h3>
      Live displays with touch, keyboard, and clipboard controls. Your Android runtime stays on your host.
    </td>
    <td width="25%" valign="top">
      <h3>🧩 Reusable workflows</h3>
      Build steps visually or edit YAML. Add conditions, schedule runs, and inspect execution traces.
    </td>
    <td width="25%" valign="top">
      <h3>🤖 AI device tasks</h3>
      Connect a local or remote provider to act on the device using screenshots, UI evidence, and OCR.
    </td>
    <td width="25%" valign="top">
      <h3>🛠️ One place to manage it</h3>
      Applications, resource usage, network policies, users, and audit logs in the same installation.
    </td>
  </tr>
</table>

## Features

### Build a workflow once

Compose actions, conditions, and waits in the visual editor, or work directly in YAML.
Configure scheduled triggers and inspect run history and execution traces when a task needs attention.

<p align="center">
  <a href="docs/images/workflow-editor.png">
    <img src="docs/images/workflow-editor.png" alt="Visual workflow editor showing an ADB shell action, a condition with then and else branches, and a wait step" width="100%">
  </a>
  <br>
  <sub>Arrange steps on the left and configure the selected condition on the right.</sub>
</p>

### See what your host is doing

Track managed container CPU and memory alongside Docker operation counts, errors, retries, and slow
requests. Inspect containers, images, networks, and system resources from the same UI.

<p align="center">
  <a href="docs/images/platform-overview.png">
    <img src="docs/images/platform-overview.png" alt="Platform overview showing container CPU and memory, Docker operation counts, and workload charts" width="100%">
  </a>
  <br>
  <sub>Resource usage, operation metrics, and workload charts in the platform overview.</sub>
</p>

### Choose the capabilities you need

Enable or disable OCR, firewall enforcement, image building, and experimental virtual displays
without restarting the deployment. Check the effective status alongside the configuration you saved.

<p align="center">
  <a href="docs/images/feature-controls.png">
    <img src="docs/images/feature-controls.png" alt="Feature controls for OCR, firewall enforcement, image building, and experimental virtual displays" width="100%">
  </a>
  <br>
  <sub>Platform feature settings with their current effective status.</sub>
</p>

## More in the workspace

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>📦 Application management</h3>
      Upload APKs, create applications, start and stop them, and configure runtime images, display settings,
      CPU, and memory limits. Supported live displays run on Android 13 and 14; Android 14 is the default.
    </td>
    <td width="50%" valign="top">
      <h3>🎮 Live control and files</h3>
      Choose WebRTC or WebSocket streaming, use touch and keyboard input, and share clipboard text.
      Browse the application's <code>/data</code> volume and transfer files through the browser.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🔒 Network access</h3>
      Apply outbound network policies to running applications. A dedicated firewall agent enforces
      the rules on the host.
    </td>
    <td width="50%" valign="top">
      <h3>👥 Shared installations</h3>
      Manage users, groups, and permissions, enable optional two-factor authentication,
      and review activity in the audit log.
    </td>
  </tr>
</table>

For apps that need Google services, the managed image builder can create local Android 13/14
images with Google Play components. See [Google Play image patching](docs/operations.md#google-play-image-patching)
for build requirements and compatibility limits.

## AI device control

Configure a provider in **Platform → AI**, then give the device a task from the application's
**AI agent** workspace. Rebroid supports local or remote providers through OpenAI-compatible chat
completions or native Ollama.

Device automation uses the current screenshot, UI evidence, and OCR to ground its actions.
AI features require a configured provider. Manual app control and workflows without AI commands run without one.
Raw ADB shell is not a default AI capability. A permitted escalation is limited to allowlisted,
read-only commands for one follow-up run.

See the [AI provider compatibility notes](docs/operations.md#local-ai-provider-compatibility)
for transport selection, model IDs, and provider diagnostics.

## Get started

### Requirements

- A **native Linux host** with a **rootful Docker Engine** and Docker Compose.
- Android binder support on the host, as required by ReDroid. See the
  [host checks](docs/deployment.md#redroid-host-checks).
- An **x86-64 / amd64** deployment host for the supplied Compose stack.
- Internet access for the initial container builds and runtime image downloads.

Rootless engines, Docker Desktop, and Podman machine are unsupported deployment targets.
Native Linux rootful Podman with Netavark is an alternative; see the
[Podman setup notes](docs/deployment.md#podman-socket).

### Start the stack

```bash
git clone https://github.com/maeek/rebroid.git
cd rebroid
docker compose -f deploy/compose.yaml up -d --build
```

Once the stack is ready, open **[https://localhost:3443](https://localhost:3443)**.
The first build can take a while, including the OCR runtime dependencies.

The default Compose setup generates its own internal secrets and a self-signed TLS certificate,
and persists them in Docker volumes. No `.env` file is required. Your browser will report that
the certificate is not trusted; the [HTTPS guide](docs/deployment.md#local-https) explains how
to trust it and configure a LAN hostname or IP.

### Sign in and run your first app

Read the generated initial password:

```bash
docker compose -f deploy/compose.yaml exec web cat /app/data/initial-admin-password
```

Sign in as **`admin`** and replace the initial password when prompted. The generated password is
stored in a protected file and is never printed to container logs.

1. Open **Installed Apps** and create an application with your APK.
2. Use a supported Android 13 or 14 runtime image. The default is Android 14.
3. Start the application and open its live viewer.
4. For repeatable tasks, create a workflow under **Automations**. Configure a provider in
   **Platform → AI** to use AI-assisted tasks.

Live display streaming supports **ReDroid 13 and 14**. ReDroid 15 and 16 are currently blocked
because of video startup compatibility issues. See the
[streaming compatibility notes](docs/deployment.md#redroid-display-streaming-support).

### Common configuration

Most runtime settings are managed in the UI. These environment variables cover common deployment changes:

| Variable | Default | Purpose |
| --- | --- | --- |
| `REBROID_HTTPS_PORT` | `3443` | Published HTTPS port. |
| `REBROID_TLS_HOSTS` | `localhost,127.0.0.1` | Hostnames and IPs included in the generated certificate. |
| `REBROID_PUBLIC_HOSTS` | Falls back to TLS hosts | Browser hostnames accepted by the edge proxy. |
| `CONTAINER_ENGINE_SOCKET` | `/var/run/docker.sock` | Rootful container engine socket. |
| `DISPLAY_WEBRTC_UDP_PORT_RANGE` | `40000-40100` | Published WebRTC media ports. |
| `DISPLAY_WEBRTC_ICE_HOST` | Automatic | Advertised WebRTC host when automatic discovery is unsuitable. |

For LAN access, configure the certificate host list before the first start:

```bash
REBROID_TLS_HOSTS=192.168.1.11,localhost,127.0.0.1 \
  docker compose -f deploy/compose.yaml up -d --build
```

The HTTPS edge is the browser entry point. The orchestrator, web backend, and OCR API stay on the
internal network; WebRTC also uses the published UDP range. The stack controls privileged Android
containers and the host firewall, so run it on a host you administer. See
[deployment](docs/deployment.md) for reverse proxy, firewall, socket, and host configuration.

## How it works

Rebroid is a single-host system with separate services for application lifecycle, display sessions,
and host firewall rules.

| Component | Responsibility |
| --- | --- |
| **Edge** | nginx HTTPS ingress for the UI, viewer assets, and streaming connections. |
| **Web** | Next.js UI, authentication, permissions, and browser-facing backend. |
| **Orchestrator** | NestJS API for Android lifecycle, Docker operations, workflows, and settings. |
| **Display sidecar** | ADB, scrcpy, viewer sessions, and WebRTC/WebSocket streaming. |
| **Firewall agent** | Host network policy enforcement through a private Unix socket. |
| **OCR sidecar** | PaddleOCR text recognition for automation vision. |

The web backend authorizes application access and creates short-lived viewer sessions. Display
traffic goes directly through the edge to the display sidecar, with WebRTC media flowing between
the browser and sidecar. The Next.js process does not relay media.

## Documentation

- [Documentation index](docs/README.md) — all installation, operations, and contributor guides.
- [Deployment](docs/deployment.md) — host requirements, Compose, HTTPS, and configuration.
- [Operations](docs/operations.md) — diagnostics, stored state, image patching, and AI provider setup.
- [Architecture overview](docs/architecture.md) — service diagram, request/media flows, storage, and ownership.
- [Display streaming](docs/display-streaming.md) — media transport and performance diagnostics.
- [Web security](docs/web-security.md) — authentication, sessions, permissions, and audit behavior.

## Development

The repository is a pnpm/Turbo monorepo. Use **Node.js 24** and **pnpm through Corepack**:

```bash
corepack enable
pnpm install
pnpm check
```

`pnpm check` runs formatting, linting, type checks, tests, contract and dependency checks, and production
builds. For starting individual services and setting local secrets, follow the
[local development guide](CONTRIBUTING.md#local-development).

| Path | Contents |
| --- | --- |
| [`apps/web`](apps/web) | Next.js UI and backend-for-frontend. |
| [`apps/orchestrator`](apps/orchestrator) | Android lifecycle and automation control plane. |
| [`apps/display-sidecar`](apps/display-sidecar) | ADB and live display service. |
| [`apps/firewall-agent`](apps/firewall-agent) | Host firewall reconciler. |
| [`apps/ocr-sidecar`](apps/ocr-sidecar) | Python OCR service. |
| [`packages`](packages/README.md) | Shared domain libraries and generated API contracts. |
| [`deploy`](deploy) | Compose stack, ingress, and image transfer scripts. |

Before contributing, read the [repository instructions](AGENTS.md) and the architecture guide for
the area you are changing. Web contributors should also read the
[web contributor guide](docs/web-contributor-guide.md).

Generated OpenAPI contracts live in the two `*-contracts` packages. Change the owning DTO/controller,
then run `pnpm openapi:generate`; do not edit generated `schema.ts` files directly.

## Built on

Rebroid brings together [ReDroid](https://github.com/remote-android/redroid-doc),
[scrcpy](https://github.com/Genymobile/scrcpy), and [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR).
The optional Google Play image builder uses [MindTheGapps](https://github.com/MindTheGapps).
Google components are built locally from upstream packages; Rebroid does not redistribute patched
images or guarantee Play Protect certification or Play Integrity compatibility.
