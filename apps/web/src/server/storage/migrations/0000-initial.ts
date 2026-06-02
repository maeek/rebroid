export const initialWebSchema = `
  CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE user_groups (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE user_group_memberships (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, group_id)
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE recent_apps (
    user_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    opened_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, app_id)
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
    outcome TEXT NOT NULL,
    details_json TEXT NOT NULL,
    source_ip TEXT,
    user_agent TEXT
  );
  CREATE INDEX recent_apps_user_opened_at ON recent_apps(user_id, opened_at DESC);
  CREATE INDEX audit_events_created_at ON audit_events(created_at DESC);
  CREATE INDEX audit_events_category_created_at ON audit_events(category, created_at DESC);
  CREATE INDEX audit_events_actor_created_at ON audit_events(actor_user_id, created_at DESC);
  PRAGMA user_version = 2;
`
