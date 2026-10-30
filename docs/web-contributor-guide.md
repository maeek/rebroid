# Web contributor guide

The web app is a Next.js backend-for-frontend (BFF). Routes compose feature-owned pages;
server services own authentication, persistence, and upstream calls. Start with the
[architecture overview](architecture.md) and [local development setup](../CONTRIBUTING.md#local-development).

## Page structure

```text
src/app/.../page.tsx
  → src/features/<feature>/pages/<page>/page-entry.tsx
      → page-data.server.ts / page-client.tsx
          → sections/
              → ui/, model/, hooks/
```

Route files select an entry and translate parameters. `page-data.server.ts` loads authorized data;
`page-client.tsx` defines the smallest necessary client boundary. Sections compose the page,
leaf UI renders controls, and model/hooks files own state and behavior.

| Code                                                      | Location                             |
| --------------------------------------------------------- | ------------------------------------ |
| Feature pages, UI, state, and behavior                    | `src/features/<feature>`.            |
| Reusable controls and layouts                             | `src/components` or `src/shared/ui`. |
| Shared pure vocabulary                                    | `src/shared/model`.                  |
| Browser/server DTOs                                       | `src/shared/contracts`.              |
| Auth, permissions, persistence, audit, and upstream calls | `src/server`.                        |
| Routing, layouts, error boundaries, and BFF handlers      | `src/app`.                           |

Import from owning files directly. Do not add app barrels or reach across feature folders;
promote proven shared behavior deliberately. Shared model/UI/contracts must not import server-owned
types. Client code may import a server module only to invoke a Server Action whose first directive
is `'use server'`.

## Data access

| Need                                       | Boundary                                                         |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Initial page data                          | Authenticated Server Component loader.                           |
| Refreshable or cross-cutting browser reads | Validated `/api/bff/*` handler and focused server query service. |
| Feature mutation                           | Authorized Server Action.                                        |
| Upload, download, streaming, or webhook    | Route Handler.                                                   |

Ordinary browser requests never call the orchestrator directly. The server client in
`src/server/orchestrator` owns upstream authentication, deadlines, request IDs, and error translation.
Operations return the shared result envelope with a request ID, stable error code, and safe public message.

Use `getCurrentUser()` before protected operations. Check permission, ownership, and input before
calling upstream services. Shared permission definitions and quotas live in `src/shared/permissions`;
they provide vocabulary, not a substitute for server authorization. See [web security](web-security.md).

Repositories own SQL and runtime validation of stored data. Web schema changes require the
[full clean-state reset](operations.md#full-reset); there is no legacy persistence adapter.

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
