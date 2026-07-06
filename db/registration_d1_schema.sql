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

CREATE TABLE IF NOT EXISTS registration_student_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE COLLATE NOCASE,
  curp TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_student_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES registration_student_users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS registration_student_resources (
  id TEXT PRIMARY KEY,
  curp TEXT NOT NULL COLLATE NOCASE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('payment', 'judge_sheet', 'media_drive')),
  title TEXT NOT NULL,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'hidden')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_inscription_orders (
  id TEXT PRIMARY KEY,
  curp TEXT NOT NULL COLLATE NOCASE,
  participant_name TEXT NOT NULL,
  academy_id TEXT REFERENCES registration_academies(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex')),
  reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_reported', 'paid', 'rejected')),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  line_items_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_inscription_payment_proofs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES registration_inscription_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1800000),
  data_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  genre TEXT NOT NULL CHECK (genre IN ('aereo', 'motion')),
  subgenre TEXT NOT NULL CHECK (
    subgenre IN (
      'aro',
      'tela',
      'trapecio',
      'open_aerial',
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
  category TEXT NOT NULL CHECK (category IN ('solo', 'duo', 'trio', 'grupo')),
  level TEXT CHECK (
    (genre = 'motion' AND level IS NULL)
    OR (genre = 'aereo' AND level IN ('nudo', 'principiante', 'intermedio', 'avanzado', 'elite'))
  ),
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
CREATE INDEX IF NOT EXISTS idx_registration_student_sessions_user_id ON registration_student_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_student_sessions_expires_at ON registration_student_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_participants_academy_id ON registration_participants(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_participants_curp ON registration_participants(curp);
CREATE INDEX IF NOT EXISTS idx_registration_student_resources_curp ON registration_student_resources(curp);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_curp ON registration_inscription_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_academy_id ON registration_inscription_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status ON registration_inscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_payment_proofs_order_id ON registration_inscription_payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_registration_choreographers_academy_id ON registration_choreographers(academy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_choreographers_academy_email
  ON registration_choreographers(academy_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);
