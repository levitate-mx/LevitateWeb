-- Metadata and short leases only. Originals and generated previews stay in Drive.
CREATE TABLE IF NOT EXISTS participant_portal_drive_sync (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  bindings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(bindings_json)),
  lease_token TEXT,
  lease_until TEXT,
  next_check_at TEXT,
  last_checked_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,participant_id),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE TABLE IF NOT EXISTS participant_portal_drive_files (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  source_file_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_folder_id TEXT NOT NULL,
  asset_id TEXT REFERENCES participant_portal_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  publication_policy TEXT NOT NULL DEFAULT 'draft' CHECK (publication_policy IN ('draft','automatic','held')),
  lease_token TEXT,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,dance_id,source_file_id,source_version),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_drive_files_pending ON participant_portal_drive_files(event_id,dance_id,status,updated_at);
CREATE TABLE IF NOT EXISTS participant_portal_drive_album_settings (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  publication_paused INTEGER NOT NULL DEFAULT 0 CHECK (publication_paused IN (0,1)),
  PRIMARY KEY(event_id,dance_id)
);
