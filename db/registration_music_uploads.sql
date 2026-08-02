CREATE TABLE IF NOT EXISTS registration_music_uploads (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('audio/mpeg', 'audio/mp3')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 12000000),
  data_url TEXT NOT NULL,
  uploaded_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dance_id)
);

ALTER TABLE registration_music_uploads ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'd1' CHECK (storage_provider IN ('d1', 'google_drive'));
ALTER TABLE registration_music_uploads ADD COLUMN drive_file_id TEXT;
ALTER TABLE registration_music_uploads ADD COLUMN drive_web_view_link TEXT;
ALTER TABLE registration_music_uploads ADD COLUMN drive_web_content_link TEXT;

CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_academy_id ON registration_music_uploads(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_dance_id ON registration_music_uploads(dance_id);
