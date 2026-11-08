# Web security

The web backend treats browsers and upstream proxy headers as untrusted. Vulnerabilities should
be reported through the [security policy](../SECURITY.md).

## Sessions and account access

- `getCurrentUser()` validates auth epoch, per-user session version, disabled state, and required
  password changes. Only the protected layout and forced-password-change completion use `getAuthenticatedUser()`.
- The bootstrap admin replaces its initial password before normal access. Password replacement
  invalidates the old session and requires a fresh login.
- New password hashes use Argon2id. Existing bcrypt hashes upgrade after successful login.
- Login throttling persists in SQLite and applies to both account and source-address keys.
- TOTP secrets use AES-256-GCM with `MFA_ENCRYPTION_KEY`; recovery codes are shown once and stored
  as hashes. MFA changes invalidate sessions.

## Authorization

Check permissions and resource ownership on the server before orchestrator calls. Shared
permission/quota types support UI and server code, but browser visibility is not authorization.
Automation definitions, targets, profiles, and triggers are revalidated before use; unknown command
permissions fail closed.

Cookie-authenticated mutation APIs require a same-origin `Origin`. NextAuth keeps its own CSRF
handling. Display session tokens and automation subscription tokens grant narrow, short-lived
access; platform feature flags never replace permission checks.

## Proxies and public output

The edge accepts only configured public hosts, strips internal-secret headers, and overwrites
forwarded host, protocol, and client address. With another proxy in front, the observed client
address is that proxy; there is no implicit trusted-forwarded-header mode.

Public errors contain safe messages and request references. Ordinary users receive redacted
backend identifiers, endpoints, filesystem paths, and diagnostics. Raw upstream failures and
secrets must not appear in responses, logs, or client bundles.

Audit details redact credential-like keys. Retention runs automatically from web settings,
and CSV exports neutralize spreadsheet formulas. Persistence changes use the
[documented reset procedures](operations.md#stored-state).

## Runtime authorization and revocation

The orchestrator reauthorizes every automation immediately before target preparation through
`POST /api/internal/automations/authorize` on the web service. `WEB_INTERNAL_URL` defaults to
`http://localhost:3101` for local development; Compose configures `http://web:3101`.
The call uses the shared service secret, a bounded timeout, and fails closed when web is unavailable.
Public ingress strips this secret. The endpoint does not accept browser sessions as authorization.
The web service checks current account state, command permissions, target ownership, profile access,
and startup permission and quotas, including queued automation target reservations.
Scheduled runs therefore cannot retain permissions from the time their trigger was created.

Administrative user/group edits, disabling, and deletion revoke the user's existing display sessions
before and after applying the access change. Viewer grants are rechecked after session creation
to reject requests that raced with revocation. If display session revocation fails, the account action fails
and can be retried. Viewer and event-stream tokens must never appear in request logs; edge and
service request logging omit query strings.

Workflow inputs must not override the session owner or supply alternate unchecked definitions.
Resource quotas apply to effective create defaults and reject unlimited update values under finite
quotas. Image runtime detection is separate from authorization: only the official Docker Hub
`redroid/redroid` repository qualifies for Redroid-only access; third-party derivatives require
custom-image permission. Uploaded APK assignment requires the application's owner to own the upload.

Server Actions default to a 4 MB body limit (`NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT`).
Streaming upload routes retain their separate 512 MB proxy ceiling
(`NEXT_PROXY_CLIENT_MAX_BODY_SIZE`) and enforce their own authenticated file limits.

Viewer control messages are validated at dispatch for allowed types, bounded text, finite coordinates,
and correctly typed modifiers. Public HTTP controls fix their action type on the server; clients cannot
change a keyboard/touch route into a clipboard operation. Control WebSocket payloads are bounded.
Development Swagger UI requires the declared `@fastify/static` dependency in both Nest services;
bootstrap regressions exercise UI assets and confirm internal routes still reject missing secrets.
