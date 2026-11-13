-- Judging sheets are released only by an authenticated administrator's click.
-- Results and photos retain their independent publication policy.
CREATE TABLE IF NOT EXISTS registration_judging_sheet_releases (
  source_event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  manifest_json TEXT CHECK (manifest_json IS NULL OR json_valid(manifest_json)),
  released_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  released_at TEXT NOT NULL DEFAULT (datetime('now')),
  operation_nonce TEXT NOT NULL,
  PRIMARY KEY(source_event_id,block_id)
);
