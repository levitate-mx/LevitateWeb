PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS registration_academies (
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

CREATE TABLE IF NOT EXISTS registration_users (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  role TEXT NOT NULL DEFAULT 'academy' CHECK (role IN ('academy', 'admin')),
  email_confirmed_at TEXT,
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

CREATE TABLE IF NOT EXISTS registration_email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  verification_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  reset_token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
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
  division TEXT NOT NULL CHECK (division IN ('baby', 'mini', 'petite', 'junior', 'teen', 'adulto', 'senior', 'legacy', 'releve')),
  shirt_size TEXT NOT NULL CHECK (shirt_size IN ('6_8', '10_12', 'xs', 's', 'm', 'l', 'xl')),
  is_international INTEGER NOT NULL DEFAULT 0 CHECK (is_international IN (0, 1)),
  is_releve_teacher INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1)),
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
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
  reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_reported', 'paid', 'rejected')),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  buyer_phone_country_code TEXT,
  buyer_phone_number TEXT,
  buyer_phone TEXT,
  line_items_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  paid_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  rejection_message TEXT,
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

CREATE TABLE IF NOT EXISTS registration_shop_orders (
  id TEXT PRIMARY KEY,
  curp TEXT NOT NULL COLLATE NOCASE,
  participant_name TEXT NOT NULL,
  academy_id TEXT REFERENCES registration_academies(id) ON DELETE SET NULL,
  academy_name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
  reference TEXT NOT NULL UNIQUE COLLATE NOCASE,
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'payment_reported', 'paid', 'rejected')),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_phone_country_code TEXT,
  buyer_phone_number TEXT,
  buyer_phone TEXT,
  discount_code TEXT,
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_items_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  paid_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  rejection_reason TEXT,
  rejection_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_shop_payment_proofs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES registration_shop_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 1800000),
  data_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_event_tickets (
  id TEXT PRIMARY KEY,
  source_order_type TEXT NOT NULL DEFAULT 'registration' CHECK (source_order_type IN ('registration', 'shop')),
  source_order_id TEXT NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ticket_number INTEGER NOT NULL CHECK (ticket_number > 0),
  ticket_label TEXT NOT NULL,
  holder_name TEXT,
  qr_payload TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
  used_at TEXT,
  used_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_order_type, source_order_id, ticket_number)
);

CREATE TABLE IF NOT EXISTS registration_choreographers (
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

CREATE TABLE IF NOT EXISTS registration_dances (
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
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
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

CREATE TABLE IF NOT EXISTS registration_music_uploads (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('audio/mpeg', 'audio/mp3')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 12000000),
  data_url TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'd1' CHECK (storage_provider IN ('d1', 'google_drive')),
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  drive_web_content_link TEXT,
  uploaded_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (dance_id)
);

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

CREATE INDEX IF NOT EXISTS idx_registration_users_academy_id ON registration_users(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_academies_name ON registration_academies(name);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_user_id ON registration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires_at ON registration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_email_verification_tokens_user_id ON registration_email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_email_verification_tokens_expires_at ON registration_email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_password_reset_tokens_user_id ON registration_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_password_reset_tokens_expires_at ON registration_password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_student_sessions_user_id ON registration_student_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_registration_student_sessions_expires_at ON registration_student_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_participants_academy_id ON registration_participants(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_participants_curp ON registration_participants(curp);
CREATE INDEX IF NOT EXISTS idx_registration_student_resources_curp ON registration_student_resources(curp);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_curp ON registration_inscription_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_academy_id ON registration_inscription_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status ON registration_inscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_payment_proofs_order_id ON registration_inscription_payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_curp ON registration_shop_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_academy_id ON registration_shop_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status ON registration_shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_shop_payment_proofs_order_id ON registration_shop_payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_source_order ON registration_event_tickets(source_order_type, source_order_id);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_ticket_code ON registration_event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_status ON registration_event_tickets(status);
CREATE INDEX IF NOT EXISTS idx_registration_choreographers_academy_id ON registration_choreographers(academy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_choreographers_academy_email
  ON registration_choreographers(academy_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);
CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_academy_id ON registration_music_uploads(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_dance_id ON registration_music_uploads(dance_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_academy_id ON registration_recognition_documents(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_venue ON registration_recognition_documents(venue);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_status ON registration_recognition_documents(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_document_type ON registration_recognition_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_participant_id ON registration_recognition_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_choreographer_id ON registration_recognition_documents(choreographer_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_dance_id ON registration_recognition_documents(dance_id);
