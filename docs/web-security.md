# Web security invariants

The web application treats browsers and upstream proxy headers as untrusted.

- `getCurrentUser()` is the standard authenticated boundary. It validates the database-wide auth epoch, per-user session version, disabled state, and required-password-change state. Only the protected layout and the forced-password-change action may use `getAuthenticatedUser()`.
- The bootstrap administrator must replace its initial password. Completing a forced change increments the session version and requires a fresh login.
- Passwords are stored with Argon2id. Existing bcrypt hashes remain readable and are upgraded after the next successful login. Password policy is bounded to 8–128 characters.
- Login throttling is persisted in SQLite and applied to both hashed account and source-address keys. The reverse proxy overwrites the source address unless trusted-proxy mode is explicitly enabled.
- TOTP MFA is optional for every account. Secrets use AES-256-GCM with `MFA_ENCRYPTION_KEY`; recovery codes are shown once and stored only as hashes.
- Automation command permissions fail closed. Unknown permissions make definitions unrunnable, and trigger updates and runs revalidate the stored definition, target, and profile permissions.
- Cookie-authenticated mutation API requests require a same-origin `Origin`. NextAuth routes retain NextAuth's own CSRF handling.
- Ordinary users receive redacted backend identifiers, endpoints, filesystem paths, and diagnostics. Raw orchestrator errors are never returned to clients or written to application logs.
- Audit details recursively redact credential-like keys, retention runs automatically from web settings, and CSV exports neutralize spreadsheet formulas.

The production reverse proxy ignores inbound forwarded host/protocol/address headers by default and allows only `REBROID_PUBLIC_HOSTS`, falling back to the certificate names in `REBROID_TLS_HOSTS`. Set `REBROID_PUBLIC_URL` for a fixed external origin. Use `REBROID_TRUST_PROXY_HEADERS=true` only behind a trusted proxy that overwrites those headers.

The web database schema has no migration path. Security schema changes require the documented clean-state reset workflow.
