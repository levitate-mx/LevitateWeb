PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS registration_participants_next;

CREATE TABLE registration_participants_next (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  birth_date TEXT,
  age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  division TEXT NOT NULL CHECK (division IN ('baby', 'mini', 'petite', 'junior', 'teen', 'adulto', 'senior', 'legacy', 'releve')),
  shirt_size TEXT NOT NULL CHECK (shirt_size IN ('6_8', '10_12', 'xs', 's', 'm', 'l', 'xl')),
  is_international INTEGER NOT NULL DEFAULT 0 CHECK (is_international IN (0, 1)),
  is_releve_teacher INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1)),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (academy_id, curp)
);

INSERT INTO registration_participants_next (
  id,
  academy_id,
  full_name,
  curp,
  birth_date,
  age,
  division,
  shirt_size,
  is_international,
  is_releve_teacher,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  id,
  academy_id,
  full_name,
  curp,
  birth_date,
  age,
  division,
  CASE
    WHEN shirt_size IN ('6', '8') THEN '6_8'
    WHEN shirt_size IN ('10', '12') THEN '10_12'
    ELSE shirt_size
  END,
  is_international,
  is_releve_teacher,
  created_by_user_id,
  created_at,
  updated_at
FROM registration_participants;

DROP TABLE registration_participants;
ALTER TABLE registration_participants_next RENAME TO registration_participants;

CREATE INDEX IF NOT EXISTS idx_registration_participants_academy_id ON registration_participants(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_participants_curp ON registration_participants(curp);

PRAGMA foreign_keys = ON;
