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
