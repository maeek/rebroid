# Documentation

Start with the [project README](../README.md) to install Rebroid and open your first Android display.

## Install and operate

| Guide | Covers |
| --- | --- |
| [Deployment](deployment.md) | Linux host requirements, Compose and its test overlay, HTTPS, networking, GPU rendering, and prebuilt image transfer |
| [Operator console](operator-console.md) | App lifecycle, device files, runtime image pulls and builds, feature controls, outbound access, workflow editing and scheduling, and run history |
| [Operations](operations.md) | Service diagnostics, persistent profile downloads, stored state, Google Play image builds, APK library, and AI provider setup |
| [Display streaming](display-streaming.md) | WebRTC and WebSocket playback, viewer recovery, diagnostics, and manual Redroid and external-device verification |
| [Web security](web-security.md) | Account sessions, group permissions, viewer authorization, and container terminal access |

## Develop and contribute

| Guide | Covers |
| --- | --- |
| [Contributing](../CONTRIBUTING.md) | Local development, verification, dependency updates, and pull requests |
| [Architecture](architecture.md) | Service responsibilities, request and media flows, state ownership, and feature configuration |
| [Orchestrator architecture](orchestrator-architecture.md) | Lifecycle jobs, running app snapshots, startup timing, firewall reconciliation, and workflow execution |
| [Web contributor guide](web-contributor-guide.md) | Page structure, browser and server boundaries, and code placement |
| [Web design system](web-design-system.md) | Navigation, controls, feedback, loading states, and accessibility |
| [Workspace packages](../packages/README.md) | Shared libraries, OpenAPI contracts, and package checks |

Service-specific setup and verification are in the [web](../apps/web/README.md),
[orchestrator](../apps/orchestrator/README.md), [display sidecar](../apps/display-sidecar/README.md),
[OCR sidecar](../apps/ocr-sidecar/README.md), and [AI automation](../apps/orchestrator/src/automations/ai/README.md) guides.
The [Android text entry guide](../apps/display-sidecar/README.md#android-text-entry) covers the Unicode fallback and device regression test.


Report vulnerabilities through the [security policy](../SECURITY.md).
See the [third-party notices](../THIRD_PARTY_NOTICES.md) for bundled artifacts.
