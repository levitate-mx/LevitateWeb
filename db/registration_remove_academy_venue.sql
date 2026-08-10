PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS registration_academies_next;
CREATE TABLE registration_academies_next (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  origin_type TEXT NOT NULL DEFAULT 'mexico' CHECK (origin_type IN ('mexico', 'international')),
  origin_state TEXT,
  origin_country TEXT NOT NULL DEFAULT 'México',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO registration_academies_next (
  id,
  name,
  contact_name,
  email,
  phone,
  origin_type,
  origin_state,
  origin_country,
  created_at,
  updated_at
)
SELECT
  id,
  name,
  contact_name,
  email,
  phone,
  origin_type,
  origin_state,
  origin_country,
  created_at,
  updated_at
FROM registration_academies;

DROP TABLE registration_academies;
ALTER TABLE registration_academies_next RENAME TO registration_academies;
CREATE INDEX IF NOT EXISTS idx_registration_academies_name ON registration_academies(name);

PRAGMA foreign_keys = ON;
