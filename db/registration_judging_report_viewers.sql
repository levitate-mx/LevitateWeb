-- Additive preparation is managed by scripts/prepare-registration-db.mjs.
ALTER TABLE registration_users ADD COLUMN is_judging_viewer INTEGER NOT NULL DEFAULT 0 CHECK (is_judging_viewer IN (0, 1));
CREATE TABLE IF NOT EXISTS registration_judging_report_access (
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id)
);
