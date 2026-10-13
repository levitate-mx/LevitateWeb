-- Apply explicitly before deploying workshops. Runtime requests never create schema.
CREATE TABLE IF NOT EXISTS registration_workshop_sessions (
  event_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR (typeof(capacity) = 'integer' AND capacity >= 0)),
  enrolled_count INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_count >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, session_id),
  CHECK (capacity IS NULL OR enrolled_count <= capacity)
);

CREATE TABLE IF NOT EXISTS registration_workshop_enrollments (
  event_id TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  participant_name TEXT NOT NULL,
  academy_id TEXT NOT NULL,
  academy_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 0),
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  extra_count INTEGER NOT NULL DEFAULT 0 CHECK (extra_count >= 0),
  amount_due INTEGER NOT NULL DEFAULT 0 CHECK (amount_due >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount_due),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  mutation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, curp)
);

CREATE TABLE IF NOT EXISTS registration_workshop_enrollment_sessions (
  event_id TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, curp, session_id),
  FOREIGN KEY (event_id, curp) REFERENCES registration_workshop_enrollments(event_id, curp) ON DELETE CASCADE,
  FOREIGN KEY (event_id, session_id) REFERENCES registration_workshop_sessions(event_id, session_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_registration_workshop_session_roster ON registration_workshop_enrollment_sessions(event_id, session_id, curp);

CREATE TABLE IF NOT EXISTS registration_workshop_payments (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  previous_amount INTEGER NOT NULL CHECK (previous_amount >= 0),
  paid_amount INTEGER NOT NULL CHECK (paid_amount >= 0),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_registration_workshop_payments_enrollment ON registration_workshop_payments(event_id, curp, created_at);

CREATE TABLE IF NOT EXISTS registration_workshop_payment_proofs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  curp TEXT NOT NULL COLLATE NOCASE,
  submitted_revision INTEGER NOT NULL CHECK (submitted_revision > 0),
  reviewed_revision INTEGER,
  captured_amount_due INTEGER NOT NULL CHECK (captured_amount_due > 0),
  captured_paid_amount INTEGER NOT NULL CHECK (captured_paid_amount >= 0),
  amount INTEGER NOT NULL CHECK (amount > 0),
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1400000),
  data_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'approved', 'rejected')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by_id TEXT,
  reviewed_by_name TEXT,
  FOREIGN KEY (event_id, curp) REFERENCES registration_workshop_enrollments(event_id, curp) ON DELETE RESTRICT,
  CHECK (amount = captured_amount_due - captured_paid_amount)
);

CREATE INDEX IF NOT EXISTS idx_registration_workshop_proofs_latest ON registration_workshop_payment_proofs(event_id, curp, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_workshop_proofs_pending ON registration_workshop_payment_proofs(event_id, curp) WHERE status = 'reported';

CREATE TRIGGER IF NOT EXISTS registration_workshop_reserve_capacity
BEFORE INSERT ON registration_workshop_enrollment_sessions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM registration_workshop_sessions
    WHERE event_id = NEW.event_id AND session_id = NEW.session_id
      AND (capacity IS NULL OR enrolled_count < capacity)
  ) THEN RAISE(ABORT, 'workshops_session_full') END;
END;

CREATE TRIGGER IF NOT EXISTS registration_workshop_increment_capacity
AFTER INSERT ON registration_workshop_enrollment_sessions
BEGIN
  UPDATE registration_workshop_sessions
  SET enrolled_count = enrolled_count + 1, updated_at = datetime('now')
  WHERE event_id = NEW.event_id AND session_id = NEW.session_id;
END;

CREATE TRIGGER IF NOT EXISTS registration_workshop_release_capacity
AFTER DELETE ON registration_workshop_enrollment_sessions
BEGIN
  UPDATE registration_workshop_sessions
  SET enrolled_count = enrolled_count - 1, updated_at = datetime('now')
  WHERE event_id = OLD.event_id AND session_id = OLD.session_id;
END;
