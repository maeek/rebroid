# Web

Next.js UI and backend-for-frontend for Rebroid. The web backend owns authentication,
permissions, users/groups, audit records, persistence, and authorized orchestrator access.
Display media flows through the edge directly to the sidecar.

- [Local setup](../../CONTRIBUTING.md#local-development)
- [Page and data boundaries](../../docs/web-contributor-guide.md)
- [Design system](../../docs/web-design-system.md)
- [Security rules](../../docs/web-security.md)

## Development

After configuring [`.env.example`](.env.example) as `.env.local`, run from the repository root:

```bash
./apps/web/dev.sh
```

The script requires `ORCHESTRATOR_SHARED_SECRET`, `NEXTAUTH_SECRET`, `MFA_ENCRYPTION_KEY`, and
`INITIAL_ADMIN_PASSWORD`. It serves `https://127.0.0.1:3000` by default.

The Compose image generates missing auth/encryption secrets and initial admin credentials,
and reads the shared service secret from its volume. See [Deployment](../../docs/deployment.md)
for HTTPS and bootstrap login.

## Upload limits

The Next.js transport ceiling defaults to `512mb`; the effective APK limit is an orchestrator setting.
For a larger upload, align the edge's `client_max_body_size`, the web build argument
`NEXT_PROXY_CLIENT_MAX_BODY_SIZE`, and the orchestrator limit. Raising only one layer is insufficient.

## Verification

```bash
pnpm --filter rebroid-web test
pnpm --filter rebroid-web typecheck
pnpm --filter rebroid-web lint
pnpm --filter rebroid-web build
```

Playwright journeys use `pnpm --filter rebroid-web test:e2e`. Browser/server contracts and imports
are checked by `pnpm boundaries`; shared changes also require the root `pnpm check` gate.
