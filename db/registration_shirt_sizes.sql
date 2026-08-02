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

DROP TABLE IF EXISTS registration_choreographers_next;

CREATE TABLE registration_choreographers_next (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  shirt_size TEXT NOT NULL DEFAULT 'm' CHECK (shirt_size IN ('6_8', '10_12', 'xs', 's', 'm', 'l', 'xl')),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO registration_choreographers_next (
  id,
  academy_id,
  full_name,
  email,
  phone,
  shirt_size,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  id,
  academy_id,
  full_name,
  email,
  phone,
  CASE
    WHEN shirt_size IN ('6', '8') THEN '6_8'
    WHEN shirt_size IN ('10', '12') THEN '10_12'
    ELSE shirt_size
  END,
  created_by_user_id,
  created_at,
  updated_at
FROM registration_choreographers;

DROP TABLE registration_choreographers;
ALTER TABLE registration_choreographers_next RENAME TO registration_choreographers;

CREATE INDEX IF NOT EXISTS idx_registration_choreographers_academy_id ON registration_choreographers(academy_id);

DROP TABLE IF EXISTS registration_recognition_documents_next;

CREATE TABLE registration_recognition_documents_next (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('academy_recognition', 'participant_diploma', 'choreographer_diploma')),
  academy_id TEXT REFERENCES registration_academies(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex')),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('academy', 'participant', 'choreographer')),
  recipient_id TEXT,
  recipient_name TEXT NOT NULL,
  participant_id TEXT REFERENCES registration_participants(id) ON DELETE SET NULL,
  choreographer_id TEXT REFERENCES registration_choreographers(id) ON DELETE SET NULL,
  dance_id TEXT REFERENCES registration_dances(id) ON DELETE SET NULL,
  dance_title TEXT,
  shirt_size TEXT CHECK (shirt_size IS NULL OR shirt_size IN ('6_8', '10_12', 'xs', 's', 'm', 'l', 'xl')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent', 'cancelled')),
  file_url TEXT,
  notes TEXT,
  generated_at TEXT,
  delivered_at TEXT,
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO registration_recognition_documents_next (
  id,
  document_type,
  academy_id,
  academy_name,
  venue,
  recipient_type,
  recipient_id,
  recipient_name,
  participant_id,
  choreographer_id,
  dance_id,
  dance_title,
  shirt_size,
  status,
  file_url,
  notes,
  generated_at,
  delivered_at,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  id,
  document_type,
  academy_id,
  academy_name,
  venue,
  recipient_type,
  recipient_id,
  recipient_name,
  participant_id,
  choreographer_id,
  dance_id,
  dance_title,
  CASE
    WHEN shirt_size IN ('6', '8') THEN '6_8'
    WHEN shirt_size IN ('10', '12') THEN '10_12'
    ELSE shirt_size
  END,
  status,
  file_url,
  notes,
  generated_at,
  delivered_at,
  created_by_user_id,
  created_at,
  updated_at
FROM registration_recognition_documents;

DROP TABLE registration_recognition_documents;
ALTER TABLE registration_recognition_documents_next RENAME TO registration_recognition_documents;

CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_academy_id ON registration_recognition_documents(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_venue ON registration_recognition_documents(venue);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_status ON registration_recognition_documents(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_document_type ON registration_recognition_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_participant_id ON registration_recognition_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_choreographer_id ON registration_recognition_documents(choreographer_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_dance_id ON registration_recognition_documents(dance_id);

PRAGMA foreign_keys = ON;
