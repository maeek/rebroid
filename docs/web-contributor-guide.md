# Web contributor guide

The web app is a Next.js backend-for-frontend (BFF). Routes compose feature-owned pages;
server services own authentication, persistence, and upstream calls. Start with the
[architecture overview](architecture.md) and [local development setup](../CONTRIBUTING.md#local-development).

## Page structure

Route files translate parameters and compose feature-owned pages. Load protected data on the
server and keep the client boundary around the controls that need it. See the
[general preferences page](../apps/web/src/features/settings/general/pages/preferences-general/page-entry.tsx).

| Code                                                      | Location                             |
| --------------------------------------------------------- | ------------------------------------ |
| Feature pages, UI, state, and behavior                    | `src/features/<feature>`.            |
| Reusable controls and layouts                             | `src/components` or `src/shared/ui`. |
| Shared pure vocabulary                                    | `src/shared/model`.                  |
| Browser/server DTOs                                       | `src/shared/contracts`.              |
| Auth, permissions, persistence, audit, and upstream calls | `src/server`.                        |
| Routing, layouts, error boundaries, and BFF handlers      | `src/app`.                           |

Import from owning files directly. Keep feature domains independent according to the
[dependency rules](../.dependency-cruiser.cjs). Shared model, UI and contracts must not import
server-owned types. Client code may import a server module only to invoke a Server Action whose
first directive is `'use server'`.

## Data access

| Need                                       | Boundary                                                         |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Initial page data                          | Authenticated Server Component loader.                           |
| Refreshable or cross-cutting browser reads | Validated `/api/bff/*` handler and focused server query service. |
| Feature mutation                           | Server Action or [BFF Route Handler](../apps/web/src/app/api/bff/platform/android-rendering/route.ts), with server-side authorization. |
| Upload, download, streaming, or webhook    | Route Handler.                                                   |

Ordinary browser requests never call the orchestrator directly. The server client in
`src/server/orchestrator` owns upstream authentication, deadlines, request IDs, and error translation.
For JSON BFF responses, the [route handler wrapper](../apps/web/src/server/http/route-handler.ts)
attaches the request ID and translates failures into public errors. File responses and streams
use their native response formats.

The admin navigation polls [platform health](../apps/web/src/app/api/bff/platform/health/route.ts)
through the BFF. Container Logs and Terminal use the
[container summary](../apps/orchestrator/src/docker-maintenance/containers/controllers/docker-maintenance-containers.controller.ts).
Overview loads Docker relationships and owns the live resource poll.

Browser-facing settings use the same audience projection for BFF responses and initial page props.
Loaders can require live settings or accept defaults during an outage.
Workflow traces and device-agent chat share run-event replay. HTTP history uses the same
byte-bounded pages as WebSocket replay and returns a continuation sequence when more events exist.
The BFF authorizes history reads and issues a WebSocket token when the browser is ready to
subscribe through the edge. Each view projects the delivered events into its own state.

For session checks, including the password-change flow, follow [web security](web-security.md).
Check permission, ownership, and input before calling upstream services.

Repositories own SQL and validate stored data. Test prerelease web schema edits with a fresh
`WEB_DATABASE_PATH`, as the [database tests](../apps/web/src/server/persistence/database.spec.ts) do.
For an existing installation with incompatible state, follow the [reset procedures](operations.md#stored-state).

## UI and loading

Follow the [web design system](web-design-system.md) for page families, semantic tokens,
forms, feedback, grids, and accessibility. Feature code composes shared primitives rather than
recreating visual recipes.

The component that owns ready-state geometry also owns loading geometry. Thin route loaders
and explicit Suspense boundaries reuse that feature loading component. Keep known page chrome
visible and mask only data-dependent regions.

## Verification

From the repository root:

```bash
pnpm --filter rebroid-web lint
pnpm --filter rebroid-web typecheck
pnpm --filter rebroid-web test --run --coverage.enabled=false path/to/focused.spec.tsx
pnpm boundaries
```

Vitest separates Node server tests from JSDOM client tests. Playwright covers desktop and mobile
browser journeys. Run the full web tests and build for cross-cutting changes, and `pnpm check`
for shared contracts or changes across apps.
