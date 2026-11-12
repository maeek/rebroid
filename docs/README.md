# Documentation

Start with the [project README](../README.md) for features, screenshots, and a quick start.

## Install and operate

| Guide                       | Covers                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| [Deployment](deployment.md) | Host requirements, Compose stacks, [AMD GPU rendering setup](deployment.md#android-gpu-rendering-on-linux), HTTPS, networking, and configuration. |
| [Operations](operations.md) | Service health, [GPU rendering troubleshooting](operations.md#android-gpu-rendering), Docker operation limits, state resets, image builds, and AI providers. |

## Understand and contribute

| Guide                                                              | Covers                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Architecture overview](architecture.md)                           | Services, request and media flows, state ownership, and deployment boundaries.          |
| [Contributing](../CONTRIBUTING.md)                                 | Local development, backend verification, dependency updates, and pull requests.         |
| [Orchestrator architecture](orchestrator-architecture.md)          | Domain boundaries, lifecycle jobs, profile storage, maintenance schedules, automation execution, and AI decisions. |
| [AI automation](../apps/orchestrator/src/automations/ai/README.md) | Device tasks, workflow drafts, decisions, evidence, and provider/perception boundaries. |
| [Web contributor guide](web-contributor-guide.md)                  | Page structure, browser/server contracts, and code placement.                           |
| [Operator console](operator-console.md) | Sidebar and app navigation, [personal preferences and platform settings](operator-console.md#preferences-and-platform-settings), [Casting](operator-console.md#casting), image pulls, live viewer, device files, app recovery, [Firewall and outbound network access](operator-console.md#outbound-network-access), [workflow device steps](operator-console.md#workflow-device-steps), and [workflow history retention](operator-console.md#workflow-history-retention). |
| [Web design system](web-design-system.md)                          | Shared navigation, connection and log links, controls, loading states, and outage feedback. |
| [Web security](web-security.md)                                    | Sessions, MFA, group authorization, viewer revocation, and public error handling.                 |
| [Display streaming](display-streaming.md)                          | Media transport, protocol invariants, audio diagnosis, recovery, and manual verification. |
| [AMD acceleration research](research/amd-hardware-acceleration.md) | Redroid Forge integration, Ryzen 7 4800U suitability, Android compatibility, and a proposed implementation plan. |

For vulnerability reports, use the [security policy](../SECURITY.md).
Third-party artifacts are listed in [third-party notices](../THIRD_PARTY_NOTICES.md).
