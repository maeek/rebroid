# Feature Layout

The App Router owns URLs, layouts, loading states, and API routes. Product behavior lives here.

## Boundaries

- `applications` contains the app catalog, create flow, runtime viewer, app management, app icon handling, and the UI-facing `AppDefinition` domain model.
- `auth` contains authentication screens.
- `orchestrator` contains Docker/orchestrator inventory views, tables, detail pages, and orchestrator-specific display helpers.
- `settings` contains general, orchestrator, system, and user settings screens plus UI settings defaults/hooks.
- `shell` contains the authenticated frame: navigation, top bar, breadcrumbs, and shared status splash UI.

## Conventions

- Route files in `src/app` should import one feature component or compose a small amount of server data for a feature component.
- Server actions, API clients, file-backed stores, and authorization stay in `src/server`.
- Generic reusable UI primitives stay in `src/components/ui`.
- Cross-feature utilities should start in the feature that owns the behavior. Promote only genuinely generic helpers to `src/utils` or `src/lib`.
- Prefer explicit feature imports such as `@/features/applications/...` over reaching into route folders.
