-- Additive private participant experience. Apply after registration schema.
CREATE TABLE IF NOT EXISTS participant_portal_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  season TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx','puebla','edomex','veracruz')),
  starts_at TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_access (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS participant_portal_judging_sources (
  event_id TEXT PRIMARY KEY REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_access_person ON participant_portal_access(participant_id,event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_portal_access_active ON participant_portal_access(participant_id,event_id) WHERE active = 1;
CREATE TABLE IF NOT EXISTS participant_portal_sessions (
  token_hash TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES participant_portal_access(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_routines (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  source_event_id TEXT,
  source_routine_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  result_json TEXT,
  judging_json TEXT,
  photos_published INTEGER NOT NULL DEFAULT 0 CHECK (photos_published IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id,dance_id),
  UNIQUE(event_id,source_event_id,source_routine_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_routine_revisions (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES participant_portal_routines(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('save','publish','unpublish')),
  snapshot_json TEXT NOT NULL,
  actor_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_revisions_routine ON participant_portal_routine_revisions(routine_id,created_at);
CREATE TABLE IF NOT EXISTS participant_portal_assets (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  routine_id TEXT REFERENCES participant_portal_routines(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES registration_participants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','diploma','judge_sheet')),
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 12582912),
  width INTEGER,
  height INTEGER,
  caption TEXT NOT NULL DEFAULT '',
  allow_download INTEGER NOT NULL DEFAULT 0 CHECK (allow_download IN (0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((kind='diploma' AND participant_id IS NOT NULL AND routine_id IS NULL)
    OR (kind IN ('photo','judge_sheet') AND routine_id IS NOT NULL AND participant_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_assets_routine ON participant_portal_assets(routine_id,kind,published);
CREATE TRIGGER IF NOT EXISTS participant_portal_photo_limit
BEFORE INSERT ON participant_portal_assets
WHEN NEW.kind = 'photo' AND (SELECT COUNT(*) FROM participant_portal_assets WHERE routine_id=NEW.routine_id AND kind='photo') >= 100
BEGIN
  SELECT RAISE(ABORT, 'participant_portal_photo_limit');
END;
CREATE TABLE IF NOT EXISTS participant_portal_documents (
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES participant_portal_assets(id) ON DELETE CASCADE,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(participant_id,event_id)
);
