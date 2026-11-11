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
  Successful sign-in clears the account limit. The source budget lasts through its window.
- TOTP secrets use AES-256-GCM with `MFA_ENCRYPTION_KEY`; recovery codes are shown once and stored
  as hashes. A TOTP code can only complete one sign-in during its acceptance window. MFA changes
  invalidate sessions.

## Authorization

Accounts inherit permissions and quotas from explicitly assigned groups. Later groups take
precedence for values they define. Administrators membership grants platform administration,
all application and workflow permissions, and unlimited quotas. The built-in Users group
is assigned when a new account is created without an explicit group selection. Removing
the last membership leaves the account without group permissions. At least one enabled
account must remain in Administrators.

Check permissions and resource ownership on the server before orchestrator calls. Shared
permission/quota types support UI and server code, but browser visibility is not authorization.
Automation definitions, targets, profiles, and triggers are revalidated before use; unknown command
permissions fail closed.

Cookie-authenticated mutation APIs require a same-origin `Origin`. NextAuth keeps its own CSRF
handling. Display session tokens and automation subscription tokens grant narrow, short-lived
access. Open automation streams expire with their token and reconnect through the web
authorization check. Platform feature flags never replace permission checks.

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

The orchestrator reauthorizes every automation during target preparation through
`POST /api/internal/automations/authorize` on the web service. The orchestrator dev script
uses `https://127.0.0.1:3000` and Node's system certificate store to trust the Next.js development
certificate. Set `WEB_INTERNAL_URL` to match a custom local web listener. Compose uses `http://web:3101`.
The call uses the shared service secret, a bounded timeout, and fails closed when web is unavailable.
Public ingress strips this secret. The endpoint does not accept browser sessions as authorization.
The request specifies whether preparation intends to attach or start. The web service checks current
account state, command permissions, target ownership, and profile access. A Start request always
checks startup permission and quotas, including queued automation target reservations.
Scheduled runs therefore cannot retain permissions from the time their trigger was created.

Administrative user/group edits, disabling, and deletion revoke the user's existing display sessions
before and after applying the access change. Group changes use one session inventory per pass.
A failed pre-commit revocation blocks the account change. Once the change commits, its pending
revocation survives a restart and retries in the background. New viewer grants wait for pending
revocation to clear. The web service checks authorization again after creating a session to catch
changes that raced with the grant. Edge and service request logs omit query strings to protect tokens.

Workflow inputs must not override the session owner or supply alternate unchecked definitions.
Resource quotas apply to effective create defaults and reject unlimited update values under finite
quotas. The orchestrator authorizes the resolved image for create and clone, including the deployment
default and registry. The official Docker Hub `redroid/redroid` repository qualifies for Redroid-only
access. Third-party images require custom-image permission, and only administrators can provision
or clone them when privileged runtime mode is enabled. Uploaded APK assignment requires the
application's owner to own the upload.

Unrestricted egress and allowlists covering at least 65,536 distinct IPv4 addresses outside
RFC 1918 private ranges require internet egress permission. If reapplying a restricted policy
to a running app fails, the orchestrator stops that runtime.

Server Actions default to a 4 MB body limit (`NEXT_SERVER_ACTIONS_BODY_SIZE_LIMIT`).
Streaming upload routes retain their separate 512 MB proxy ceiling
(`NEXT_PROXY_CLIENT_MAX_BODY_SIZE`) and enforce their own authenticated file limits.
Runtime file downloads use buffered responses and have a 25 MiB per-file limit.

Viewer control messages are validated at dispatch for allowed types, bounded text, finite coordinates,
and correctly typed modifiers. Public HTTP controls fix their action type on the server; clients cannot
change a keyboard/touch route into a clipboard operation. Control WebSocket payloads are bounded.
Development Swagger UI requires the declared `@fastify/static` dependency in both Nest services;
bootstrap regressions exercise UI assets and confirm internal routes still reject missing secrets.
