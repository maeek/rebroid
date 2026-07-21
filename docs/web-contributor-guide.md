# Web contributor guide

The web workspace is a Next.js backend-for-frontend with feature-owned UI. Keep routes thin, keep browser/server
contracts explicit, and promote code to shared folders only after more than one feature genuinely needs it.

## Page structure

New or migrated pages follow this dependency flow:

```text
src/app/.../page.tsx
  -> src/features/<feature>/pages/<page>/page-entry.tsx
       -> page-data.server.ts and/or page-client.tsx
            -> sections/*
                 -> ui/*, model/*, hooks/*
```

- Route files select a feature entry and translate route parameters. They do not own page markup or domain behavior.
- `page-entry.tsx` composes the route-facing page and may await a colocated server loader.
- `page-data.server.ts` performs authenticated initial reads and maps server data to shared contracts.
- `page-client.tsx` is the smallest useful client boundary. Do not mark a whole route client-side for one control.
- `sections` compose meaningful page regions. `ui`, `model`, and `hooks` own focused presentation, pure rules, and
  reusable page behavior respectively.

## Placement rules

| Code                                                                        | Location                            |
| --------------------------------------------------------------------------- | ----------------------------------- |
| Feature page, component, hook, or domain rule                               | `src/features/<feature>`            |
| Reusable visual/layout primitive                                            | `src/components` or `src/shared/ui` |
| App-wide pure browser/server vocabulary                                     | `src/shared/model`                  |
| DTO crossing a browser/server boundary                                      | `src/shared/contracts`              |
| Authentication, authorization, persistence, auditing, or upstream transport | `src/server`                        |
| Routing, layout, error boundary, or HTTP handler                            | `src/app`                           |

Do not add app-level barrels. Import the owning file directly. Do not reach across feature folders; deliberately move a
proven cross-feature primitive or model to `shared` instead.

## Choosing a data boundary

| Need                                                       | Use                                  | Why                                                                         |
| ---------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Initial page read tied to rendering                        | Server Component loader              | Keeps secrets and transport server-side and avoids a client waterfall.      |
| Cross-cutting or refreshable browser read                  | Validated `/api/bff/*` Route Handler | Gives browser code a stable same-origin contract and focused query service. |
| Feature-owned mutation initiated by React UI               | Server Action                        | Keeps the mutation colocated while preserving server authorization.         |
| Webhook, upload, download, streaming, or external HTTP API | Route Handler                        | Exposes explicit HTTP semantics that are not coupled to a component tree.   |

Browser code never calls the orchestrator directly. Client modules may import a server module only to invoke a Server
Action whose module starts with `'use server'`; they must not import server-owned types. Put its input/output DTO in
`src/shared/contracts`, and return the shared operation result with a request ID and stable error code.

## UI conventions

- Compose every interactive grid with `DataGridWorkspace`. Page-level datasets may use its structured filter surface;
  embedded and small fixed datasets use search-only mode.
- Use `FormField` for labels, descriptions, errors, required state, and accessible associations.
- The component that owns ready-state geometry also owns loading geometry. Keep route `loading.tsx` files as thin
  feature entrypoints and reuse actual shells, sections, columns, and scroll containers.
- Use the semantic tokens and page families in [the web design system](web-design-system.md). Do not create local
  border/background/shadow recipes.
- Import concrete files directly. Packages alone may expose intentional public entrypoints.

## Adding a page

For a new `widgets` page:

1. Add `src/app/(protected)/(standard)/widgets/page.tsx` that renders the feature page entry.
2. Add `src/features/widgets/pages/widgets/page-entry.tsx` and the smallest necessary loader or client boundary.
3. Put page composition in `sections`, leaf presentation in `ui`, pure rules in `model`, and stateful reusable behavior
   in `hooks`.
4. Define browser/server DTOs in `src/shared/contracts` and add a focused BFF query or authorized Server Action.
5. Co-locate tests with the behavior they characterize, then run:

```bash
pnpm --filter rebroid-web lint
pnpm --filter rebroid-web typecheck
pnpm --filter rebroid-web test --run --coverage.enabled=false path/to/focused.spec.tsx
pnpm boundaries
```

Run the full web tests and production build before handing off a cross-cutting change.
