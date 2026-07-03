PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS registration_academies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex')),
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, venue)
);

CREATE TABLE IF NOT EXISTS registration_users (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_participants (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  birth_date TEXT,
  age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  division TEXT NOT NULL CHECK (division IN ('baby', 'mini', 'junior', 'teen', 'adulto')),
  shirt_size TEXT NOT NULL CHECK (shirt_size IN ('6', '8', '10', '12', 'xs', 's', 'm', 'l')),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (academy_id, curp)
);

CREATE TABLE IF NOT EXISTS registration_choreographers (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_dances (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  genre TEXT NOT NULL CHECK (genre IN ('aereo', 'motion', 'fusion')),
  subgenre TEXT NOT NULL CHECK (subgenre IN ('tela', 'aro', 'trapecio', 'contemporaneo')),
  category TEXT NOT NULL CHECK (category IN ('solo', 'duo', 'trio', 'grupo')),
  level TEXT NOT NULL CHECK (level IN ('nudo', 'principiante', 'intermedio', 'avanzado')),
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex')),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_dance_choreographers (
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  choreographer_id TEXT NOT NULL REFERENCES registration_choreographers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (dance_id, choreographer_id)
);

CREATE TABLE IF NOT EXISTS registration_dance_participants (
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (dance_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_users_academy_id ON registration_users(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_user_id ON registration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires_at ON registration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_participants_academy_id ON registration_participants(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_choreographers_academy_id ON registration_choreographers(academy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_choreographers_academy_email
  ON registration_choreographers(academy_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);
