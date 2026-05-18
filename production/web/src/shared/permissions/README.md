# Permissions

This folder owns the shared permission and quota vocabulary used by client UI and server actions.

- `permissionDefinitions` is the source of truth for admin-visible permission rows.
- `PermissionMap` stores boolean grants by permission id.
- `ResourceQuota` stores per-user or per-group runtime limits.
- Server actions must use these helpers before calling the orchestrator whenever an action can change runtime behavior or expose backend details.
