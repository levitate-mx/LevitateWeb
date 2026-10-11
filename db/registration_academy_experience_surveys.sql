PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS registration_academy_experience_surveys (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  submitted_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  survey_version TEXT NOT NULL,
  registration_device TEXT CHECK (registration_device IS NULL OR registration_device IN ('computer', 'smartphone')),
  registration_experience TEXT CHECK (registration_experience IS NULL OR registration_experience IN ('easy', 'good', 'difficult')),
  payment_experience TEXT CHECK (payment_experience IS NULL OR payment_experience IN ('easy', 'good', 'difficult')),
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (academy_id, survey_version)
);

CREATE INDEX IF NOT EXISTS idx_registration_academy_experience_surveys_created_at
  ON registration_academy_experience_surveys(created_at DESC);
