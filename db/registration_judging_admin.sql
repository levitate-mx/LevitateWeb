CREATE TABLE IF NOT EXISTS registration_judging_events (
  event_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  created_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS registration_judging_exports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_judging_exports_event ON registration_judging_exports(event_id,created_at);
CREATE TABLE IF NOT EXISTS registration_judging_export_files (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES registration_judging_exports(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  access_token_hash TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(export_id,routine_id,judge_id)
);
CREATE TABLE IF NOT EXISTS registration_judging_mail_deliveries (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES registration_judging_exports(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed','unknown')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  error TEXT
);
