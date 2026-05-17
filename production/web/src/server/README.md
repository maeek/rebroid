# Server Boundary

This folder is the web app's backend-for-frontend layer.

- `auth` owns NextAuth integration, user lookup, and authorization checks.
- `orchestrator` owns all calls to the NestJS orchestrator and exposes server actions/types for UI features.
- `app-icons`, `web-settings`, and `users` own local file-backed web state and admin mutations.
- `system` owns host-level system sampling used by the System page.
- `viewer` owns viewer-token security helpers used by the protected scrcpy proxy flow.

Feature components may call server actions from here, but server code should not import UI components.
