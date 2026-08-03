PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS registration_dances_next;

CREATE TABLE registration_dances_next (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  genre TEXT NOT NULL CHECK (genre IN ('aereo', 'motion')),
  subgenre TEXT NOT NULL CHECK (
    subgenre IN (
      'aro',
      'tela',
      'open_aerial',
      'open_trapecio',
      'open_cuna',
      'open_luna',
      'open_esfera',
      'open_pole_aereo',
      'open_suspension_capilar',
      'open_otro',
      'acrojazz',
      'ballet',
      'belly_dance',
      'contemporaneo',
      'folklore',
      'jazz',
      'lirico',
      'open_motion',
      'urbanos'
    )
  ),
  category TEXT NOT NULL CHECK (
    category IN (
      'solo',
      'duo',
      'trio',
      'grupo',
      'dupla_1_aparato',
      'duo_2_aparatos',
      'terna_1_aparato',
      'trio_3_aparatos'
    )
  ),
  level TEXT CHECK (
    (genre = 'motion' AND level IS NULL)
    OR (genre = 'aereo' AND level IN ('nudo', 'principiante', 'intermedio', 'avanzado', 'elite'))
  ),
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex')),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO registration_dances_next (
  id,
  academy_id,
  title,
  genre,
  subgenre,
  category,
  level,
  venue,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  id,
  academy_id,
  title,
  genre,
  CASE
    WHEN subgenre = 'trapecio' THEN 'open_trapecio'
    ELSE subgenre
  END,
  category,
  level,
  venue,
  created_by_user_id,
  created_at,
  updated_at
FROM registration_dances;

DROP TABLE registration_dances;
ALTER TABLE registration_dances_next RENAME TO registration_dances;

CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);

PRAGMA foreign_keys = ON;
