-- Store only the selected photo/video folder; OAuth credentials remain in secrets.
-- This configuration is independent of the music upload folder and permissions.
CREATE TABLE IF NOT EXISTS registration_media_drive_settings (
  key TEXT NOT NULL PRIMARY KEY CHECK (key = 'photo_video'),
  folder_id TEXT NOT NULL CHECK (length(trim(folder_id)) > 0),
  folder_name TEXT NOT NULL CHECK (length(trim(folder_name)) > 0),
  drive_id TEXT CHECK (drive_id IS NULL OR length(trim(drive_id)) > 0),
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
