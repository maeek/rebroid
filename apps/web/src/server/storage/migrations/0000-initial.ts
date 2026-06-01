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
    actor_user_id TEXT,
    action TEXT NOT NULL,
    subject TEXT,
    details_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX recent_apps_user_opened_at ON recent_apps(user_id, opened_at DESC);
  CREATE INDEX audit_events_created_at ON audit_events(created_at DESC);
  PRAGMA user_version = 2;
`
