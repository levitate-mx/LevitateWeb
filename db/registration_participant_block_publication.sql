-- Additive publication policy and audited per-block releases. Existing editions
-- keep their individual publication behaviour until an administrator opts in.
CREATE TABLE IF NOT EXISTS participant_portal_publication_settings (
  event_id TEXT PRIMARY KEY REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('individual','block_close')),
  operation_nonce TEXT NOT NULL,
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_block_publications (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','closed')),
  fingerprint TEXT,
  manifest_json TEXT NOT NULL DEFAULT '[]',
  closed_at TEXT,
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  operation_nonce TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,source_event_id,block_id),
  CHECK (state = 'open' OR (length(fingerprint) = 64 AND closed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS participant_portal_publication_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT,
  block_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('mode','close','reopen')),
  details_json TEXT NOT NULL,
  actor_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  operation_nonce TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_publication_history_event ON participant_portal_publication_history(event_id,created_at);
