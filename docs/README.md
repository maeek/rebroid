# Documentation

Start with the [project README](../README.md) for features, screenshots, and a quick start.

## Install and operate

| Guide                       | Covers                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| [Deployment](deployment.md) | Host requirements, Compose stacks, HTTPS, networking, and configuration.            |
| [Operations](operations.md) | Service health, Docker operation limits, troubleshooting, state resets, image builds, and AI providers. |

## Understand and contribute

| Guide                                                              | Covers                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [Architecture overview](architecture.md)                           | Services, request and media flows, state ownership, and deployment boundaries.          |
| [Contributing](../CONTRIBUTING.md)                                 | Local development, backend verification, dependency updates, and pull requests.         |
| [Orchestrator architecture](orchestrator-architecture.md)          | Domain boundaries, lifecycle jobs, profile storage, maintenance schedules, automation execution, and AI decisions. |
| [AI automation](../apps/orchestrator/src/automations/ai/README.md) | Device tasks, workflow drafts, decisions, evidence, and provider/perception boundaries. |
| [Web contributor guide](web-contributor-guide.md)                  | Page structure, browser/server contracts, and code placement.                           |
| [Operator console](operator-console.md) | Sidebar and app navigation, image pulls, live viewer, device files, app recovery, and workflow runs. |
| [Web design system](web-design-system.md)                          | Shared layouts, tokens, controls, loading states, and illustrated outage feedback.       |
| [Web security](web-security.md)                                    | Sessions, MFA, execution authorization, viewer revocation, and public error handling.                 |
| [Display streaming](display-streaming.md)                          | Media transport, protocol invariants, recovery, and manual verification.                |

For vulnerability reports, use the [security policy](../SECURITY.md).
Third-party artifacts are listed in [third-party notices](../THIRD_PARTY_NOTICES.md).
