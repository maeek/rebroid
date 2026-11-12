export const webSchemaVersion = 5

export const freshWebSchema = `
  CREATE TABLE groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    permissions_json TEXT NOT NULL,
    quotas_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    disabled INTEGER NOT NULL CHECK (disabled IN (0, 1)),
    password_change_required INTEGER NOT NULL CHECK (password_change_required IN (0, 1)),
    session_version INTEGER NOT NULL CHECK (session_version > 0),
    avatar_data_url TEXT,
    accent_color TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    mfa_secret_encrypted TEXT,
    mfa_recovery_codes_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE group_memberships (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (user_id, group_id),
    UNIQUE (user_id, position)
  );

  CREATE TABLE web_settings (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    settings_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE recent_applications (
    user_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, application_id)
  );

  CREATE TABLE audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    actor_user_id TEXT,
    actor_label TEXT NOT NULL,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    resource_label TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
    details_json TEXT NOT NULL,
    source_ip TEXT,
    user_agent TEXT
  );

  CREATE TABLE automation_drafts (
    token TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    yaml TEXT NOT NULL,
    source_run_id TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    consumed_at TEXT
  );

  CREATE TABLE auth_state (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    epoch TEXT NOT NULL
  );

  CREATE TABLE account_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_version INTEGER NOT NULL,
    browser TEXT NOT NULL,
    operating_system TEXT NOT NULL,
    signed_in_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE login_rate_limits (
    key_hash TEXT PRIMARY KEY NOT NULL,
    attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
    reset_at INTEGER NOT NULL
  );

  CREATE TABLE mfa_setup_tokens (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_secret TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE web_maintenance_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('viewer-revocation', 'app-deletion')),
    application_id TEXT UNIQUE,
    user_ids_json TEXT,
    request_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    next_attempt_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    CHECK ((kind = 'viewer-revocation' AND user_ids_json IS NOT NULL AND application_id IS NULL) OR
           (kind = 'app-deletion' AND application_id IS NOT NULL AND user_ids_json IS NULL))
  );

  CREATE INDEX web_maintenance_jobs_due ON web_maintenance_jobs(next_attempt_at, id);
  CREATE INDEX recent_applications_application_id ON recent_applications(application_id);
  CREATE INDEX recent_applications_user_opened_at
    ON recent_applications(user_id, opened_at DESC);
  CREATE INDEX audit_events_created_at ON audit_events(created_at DESC);
  CREATE INDEX audit_events_category_created_at ON audit_events(category, created_at DESC);
  CREATE INDEX audit_events_actor_created_at ON audit_events(actor_user_id, created_at DESC);
  CREATE INDEX automation_drafts_expiry ON automation_drafts(expires_at);
  CREATE INDEX login_rate_limits_reset_at ON login_rate_limits(reset_at);
  CREATE INDEX account_sessions_user_activity ON account_sessions(user_id, last_active_at DESC);
  CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
  CREATE INDEX mfa_setup_tokens_expires_at ON mfa_setup_tokens(expires_at);
  PRAGMA user_version = ${webSchemaVersion};
`
