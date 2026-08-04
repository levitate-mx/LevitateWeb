CREATE TABLE IF NOT EXISTS registration_recognition_documents (
  id TEXT PRIMARY KEY,
  document_type TEXT NOT NULL CHECK (document_type IN ('academy_recognition', 'participant_diploma', 'choreographer_diploma')),
  academy_id TEXT REFERENCES registration_academies(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
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

CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_academy_id ON registration_recognition_documents(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_venue ON registration_recognition_documents(venue);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_status ON registration_recognition_documents(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_document_type ON registration_recognition_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_participant_id ON registration_recognition_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_choreographer_id ON registration_recognition_documents(choreographer_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_dance_id ON registration_recognition_documents(dance_id);
