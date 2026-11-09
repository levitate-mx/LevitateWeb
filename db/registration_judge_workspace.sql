-- Additive judge access: preserve the legacy role CHECK and all existing users.
ALTER TABLE registration_users ADD COLUMN is_judge INTEGER NOT NULL DEFAULT 0 CHECK (is_judge IN (0, 1));

CREATE TABLE IF NOT EXISTS registration_judge_assignments (
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  block_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(block_ids_json) AND json_type(block_ids_json) = 'array'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id),
  UNIQUE (event_id, judge_id)
);
