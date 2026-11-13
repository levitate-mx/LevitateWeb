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
  is_judge INTEGER NOT NULL DEFAULT 0 CHECK (is_judge IN (0, 1)),
  is_judging_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_judging_admin IN (0, 1)),
  is_judging_viewer INTEGER NOT NULL DEFAULT 0 CHECK (is_judging_viewer IN (0, 1)),
  email_confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_judging_report_access (
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS registration_judge_assignments (
  user_id TEXT NOT NULL REFERENCES registration_users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  block_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(block_ids_json) AND json_type(block_ids_json) = 'array'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, event_id),
  UNIQUE (event_id, judge_id)
);

CREATE TABLE IF NOT EXISTS registration_media_drive_settings (
  key TEXT NOT NULL PRIMARY KEY CHECK (key = 'photo_video'),
  folder_id TEXT NOT NULL CHECK (length(trim(folder_id)) > 0),
  folder_name TEXT NOT NULL CHECK (length(trim(folder_name)) > 0),
  drive_id TEXT CHECK (drive_id IS NULL OR length(trim(drive_id)) > 0),
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
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
  access_token TEXT UNIQUE,
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
  access_token TEXT UNIQUE,
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
  event_id TEXT NOT NULL DEFAULT 'edomex-2026-otono',
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

-- Admission history deliberately has no foreign key to orders, tickets or devices.
-- Deleting operational records must not erase already-counted attendance.
CREATE TABLE IF NOT EXISTS registration_attendance_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  unique_admissions INTEGER NOT NULL DEFAULT 0 CHECK (unique_admissions >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_ticket_admissions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES registration_attendance_events(id) ON DELETE RESTRICT,
  ticket_id TEXT NOT NULL,
  pass_type TEXT NOT NULL CHECK (pass_type IN ('block', 'day', 'full')),
  day_id TEXT,
  scanned_block_id TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('scanner', 'admin')),
  actor_id TEXT,
  coverage_json TEXT NOT NULL,
  admitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, ticket_id)
);

-- Operational scan history is additive; canonical admissions stay unique per QR.
-- No ticket/order/device foreign keys: later corrections must preserve history.
CREATE TABLE IF NOT EXISTS registration_ticket_access_scans (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES registration_attendance_events(id) ON DELETE RESTRICT,
  ticket_id TEXT NOT NULL,
  access_session_id TEXT NOT NULL,
  pass_type TEXT NOT NULL CHECK (pass_type IN ('block', 'day', 'full')),
  day_id TEXT,
  source_block_id TEXT,
  device_id TEXT,
  device_name TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('scanner', 'admin')),
  actor_id TEXT,
  coverage_json TEXT NOT NULL,
  admitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, ticket_id, access_session_id)
);

CREATE TABLE IF NOT EXISTS registration_attendance_blocks (
  event_id TEXT NOT NULL REFERENCES registration_attendance_events(id) ON DELETE RESTRICT,
  block_id TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  single_count INTEGER NOT NULL DEFAULT 0 CHECK (single_count >= 0),
  day_count INTEGER NOT NULL DEFAULT 0 CHECK (day_count >= 0),
  full_count INTEGER NOT NULL DEFAULT 0 CHECK (full_count >= 0),
  PRIMARY KEY (event_id, block_id)
);

CREATE TABLE IF NOT EXISTS registration_scanner_pairing_codes (
  id TEXT PRIMARY KEY,
  pairing_token_hash TEXT NOT NULL UNIQUE,
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_scanner_devices (
  id TEXT PRIMARY KEY,
  pairing_code_id TEXT NOT NULL UNIQUE REFERENCES registration_scanner_pairing_codes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  device_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by_user_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  activated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_scan_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registration_choreographers (
  id TEXT PRIMARY KEY,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT COLLATE NOCASE,
  phone TEXT,
  shirt_size TEXT NOT NULL DEFAULT 'm' CHECK (shirt_size IN ('6_8', '10_12', 'xs', 's', 'm', 'l', 'xl')),
  is_releve_teacher INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1)),
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
  subgenre_detail TEXT,
  program_json TEXT CHECK (program_json IS NULL OR json_valid(program_json)),
  is_releve INTEGER NOT NULL DEFAULT 0 CHECK (is_releve IN (0, 1)),
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
  duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds > 0),
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_releve_order_dance ON registration_inscription_orders(curp) WHERE curp LIKE 'RELEVE:%';
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_academy_id ON registration_inscription_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status ON registration_inscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_payment_proofs_order_id ON registration_inscription_payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_curp ON registration_shop_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_academy_id ON registration_shop_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status ON registration_shop_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_shop_orders_access_token ON registration_shop_orders(access_token) WHERE access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registration_shop_payment_proofs_order_id ON registration_shop_payment_proofs(order_id);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_source_order ON registration_event_tickets(source_order_type, source_order_id);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_ticket_code ON registration_event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_status ON registration_event_tickets(status);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_event_sales ON registration_event_tickets(event_id, source_order_type, source_order_id, status, ticket_number);
CREATE INDEX IF NOT EXISTS idx_registration_scanner_pairing_codes_expires_at ON registration_scanner_pairing_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_registration_scanner_devices_status ON registration_scanner_devices(status);
CREATE INDEX IF NOT EXISTS idx_registration_choreographers_academy_id ON registration_choreographers(academy_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_choreographers_academy_email
  ON registration_choreographers(academy_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';
CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);
CREATE INDEX IF NOT EXISTS idx_registration_dance_participants_participant_dance ON registration_dance_participants(participant_id, dance_id);
CREATE INDEX IF NOT EXISTS idx_registration_dance_choreographers_choreographer_dance ON registration_dance_choreographers(choreographer_id, dance_id);
CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_academy_id ON registration_music_uploads(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_music_uploads_dance_id ON registration_music_uploads(dance_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_academy_id ON registration_recognition_documents(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_venue ON registration_recognition_documents(venue);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_status ON registration_recognition_documents(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_document_type ON registration_recognition_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_participant_id ON registration_recognition_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_choreographer_id ON registration_recognition_documents(choreographer_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_dance_id ON registration_recognition_documents(dance_id);

-- Ordered admin payment pages; applied once by the deployment schema preflight.
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_recent ON registration_inscription_orders(updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status_recent ON registration_inscription_orders(status, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_venue_recent ON registration_inscription_orders(venue, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_recent ON registration_shop_orders(updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status_recent ON registration_shop_orders(status, updated_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_venue_recent ON registration_shop_orders(venue, updated_at DESC, created_at DESC, id DESC);

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

-- Private participant experience: keep definitions identical to registration_participant_portal.sql.
-- Additive private participant experience. Apply after registration schema.
CREATE TABLE IF NOT EXISTS participant_portal_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  season TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx','puebla','edomex','veracruz')),
  starts_at TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_judging_sources (
  event_id TEXT PRIMARY KEY REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_program_links (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  source_routine_id TEXT NOT NULL,
  PRIMARY KEY(event_id,dance_id),
  UNIQUE(event_id,source_routine_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_program_exports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  manifest_json TEXT NOT NULL,
  source_event_id TEXT,
  created_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participant_portal_access (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_access_person ON participant_portal_access(participant_id,event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_portal_access_active ON participant_portal_access(participant_id,event_id) WHERE active = 1;
CREATE TABLE IF NOT EXISTS participant_portal_sessions (
  token_hash TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES participant_portal_access(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_routines (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  source_event_id TEXT,
  source_routine_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  result_json TEXT,
  judging_json TEXT,
  photos_published INTEGER NOT NULL DEFAULT 0 CHECK (photos_published IN (0,1)),
  publication_blocked INTEGER NOT NULL DEFAULT 0 CHECK (publication_blocked IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id,dance_id),
  UNIQUE(event_id,source_event_id,source_routine_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_routine_revisions (
  id TEXT PRIMARY KEY,
  routine_id TEXT NOT NULL REFERENCES participant_portal_routines(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('save','publish','unpublish')),
  snapshot_json TEXT NOT NULL,
  actor_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_revisions_routine ON participant_portal_routine_revisions(routine_id,created_at);
CREATE TABLE IF NOT EXISTS participant_portal_assets (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  routine_id TEXT REFERENCES participant_portal_routines(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES registration_participants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','diploma','judge_sheet')),
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 12582912),
  width INTEGER,
  height INTEGER,
  caption TEXT NOT NULL DEFAULT '',
  allow_download INTEGER NOT NULL DEFAULT 0 CHECK (allow_download IN (0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((kind='diploma' AND participant_id IS NOT NULL AND routine_id IS NULL)
    OR (kind IN ('photo','judge_sheet') AND routine_id IS NOT NULL AND participant_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_assets_routine ON participant_portal_assets(routine_id,kind,published);
CREATE TRIGGER IF NOT EXISTS participant_portal_photo_limit
BEFORE INSERT ON participant_portal_assets
WHEN NEW.kind = 'photo' AND (SELECT COUNT(*) FROM participant_portal_assets WHERE routine_id=NEW.routine_id AND kind='photo') >= 100
BEGIN
  SELECT RAISE(ABORT, 'participant_portal_photo_limit');
END;
CREATE TABLE IF NOT EXISTS registration_judging_events (
  event_id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  created_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS registration_judging_exports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_judging_exports_event ON registration_judging_exports(event_id,created_at);
CREATE TABLE IF NOT EXISTS registration_judging_export_files (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES registration_judging_exports(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  routine_id TEXT NOT NULL,
  judge_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  access_token_hash TEXT UNIQUE,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(export_id,routine_id,judge_id)
);
CREATE TABLE IF NOT EXISTS registration_judging_mail_deliveries (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES registration_judging_exports(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sending','sent','failed','unknown')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS participant_portal_documents (
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES participant_portal_assets(id) ON DELETE CASCADE,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(participant_id,event_id)
);

-- Additive publication policy and audited per-block releases. Existing editions
-- keep their individual publication behaviour until an administrator opts in.
CREATE TABLE IF NOT EXISTS participant_portal_publication_settings (
  event_id TEXT PRIMARY KEY REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('individual','block_close')),
  automatic_completion INTEGER NOT NULL DEFAULT 0 CHECK (automatic_completion IN (0,1)),
  operation_nonce TEXT NOT NULL,
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS participant_portal_block_publications (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open','closed')),
  fingerprint TEXT,
  manifest_json TEXT NOT NULL DEFAULT '[]',
  closed_at TEXT,
  updated_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  operation_nonce TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,source_event_id,block_id),
  CHECK (state = 'open' OR (length(fingerprint) = 64 AND closed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS participant_portal_publication_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  source_event_id TEXT,
  block_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('mode','close','reopen')),
  details_json TEXT NOT NULL,
  actor_id TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  operation_nonce TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_publication_history_event ON participant_portal_publication_history(event_id,created_at);

CREATE TABLE IF NOT EXISTS registration_judging_sheet_releases (
  source_event_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  manifest_json TEXT CHECK (manifest_json IS NULL OR json_valid(manifest_json)),
  released_by TEXT REFERENCES registration_users(id) ON DELETE SET NULL,
  released_at TEXT NOT NULL DEFAULT (datetime('now')),
  operation_nonce TEXT NOT NULL,
  PRIMARY KEY(source_event_id,block_id)
);

-- Metadata and short leases only. Originals and generated previews stay in Drive.
CREATE TABLE IF NOT EXISTS participant_portal_drive_sync (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  bindings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(bindings_json)),
  lease_token TEXT,
  lease_until TEXT,
  next_check_at TEXT,
  last_checked_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,participant_id),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE TABLE IF NOT EXISTS participant_portal_drive_files (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  source_file_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_folder_id TEXT NOT NULL,
  asset_id TEXT REFERENCES participant_portal_assets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  publication_policy TEXT NOT NULL DEFAULT 'draft' CHECK (publication_policy IN ('draft','automatic','held')),
  lease_token TEXT,
  lease_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(event_id,dance_id,source_file_id,source_version),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_participant_portal_drive_files_pending ON participant_portal_drive_files(event_id,dance_id,status,updated_at);
CREATE TABLE IF NOT EXISTS participant_portal_drive_album_settings (
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  publication_paused INTEGER NOT NULL DEFAULT 0 CHECK (publication_paused IN (0,1)),
  PRIMARY KEY(event_id,dance_id)
);

-- Private event guests are separate from registration and never receive a fake CURP.
CREATE TABLE IF NOT EXISTS participant_portal_guests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  academy_id TEXT NOT NULL REFERENCES registration_academies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  source_key TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('participant','releve','choreographer')),
  division TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id,source_key),
  UNIQUE(id,event_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_guest_dances (
  guest_id TEXT NOT NULL REFERENCES participant_portal_guests(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  PRIMARY KEY(guest_id,dance_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_additional_dances (
  participant_id TEXT NOT NULL REFERENCES registration_participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  dance_id TEXT NOT NULL REFERENCES registration_dances(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(participant_id,event_id,dance_id)
);
CREATE TABLE IF NOT EXISTS participant_portal_guest_access (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  FOREIGN KEY(guest_id,event_id) REFERENCES participant_portal_guests(id,event_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_guest_active_access ON participant_portal_guest_access(guest_id,event_id) WHERE active=1;
CREATE TABLE IF NOT EXISTS participant_portal_guest_sessions (
  token_hash TEXT PRIMARY KEY,
  access_id TEXT NOT NULL REFERENCES participant_portal_guest_access(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_participant_guest_sessions_expiry ON participant_portal_guest_sessions(expires_at);
CREATE VIEW IF NOT EXISTS participant_portal_people AS
SELECT p.id,p.academy_id,p.full_name,p.division,0 AS is_guest,NULL AS portal_event_id FROM registration_participants p
UNION ALL
SELECT g.id,g.academy_id,g.full_name,g.division,1 AS is_guest,g.event_id AS portal_event_id FROM participant_portal_guests g;
CREATE VIEW IF NOT EXISTS participant_portal_memberships AS
SELECT dp.participant_id,dp.dance_id FROM registration_dance_participants dp
UNION
SELECT pd.participant_id,pd.dance_id FROM participant_portal_additional_dances pd
JOIN registration_participants p ON p.id=pd.participant_id
JOIN participant_portal_events e ON e.id=pd.event_id
JOIN registration_dances d ON d.id=pd.dance_id AND d.academy_id=p.academy_id AND d.venue=e.venue
WHERE json_valid(d.program_json) AND json_extract(d.program_json,'$.eventId')=pd.event_id
UNION
SELECT gd.guest_id AS participant_id,gd.dance_id FROM participant_portal_guest_dances gd
JOIN participant_portal_guests g ON g.id=gd.guest_id
JOIN participant_portal_events e ON e.id=g.event_id
JOIN registration_dances d ON d.id=gd.dance_id AND d.academy_id=g.academy_id AND d.venue=e.venue
WHERE json_valid(d.program_json) AND json_extract(d.program_json,'$.eventId')=g.event_id;
CREATE VIEW IF NOT EXISTS participant_portal_grants AS
SELECT a.id,a.participant_id,a.event_id,a.token_hash,a.active,a.created_at,a.revoked_at,0 AS is_guest FROM participant_portal_access a
UNION ALL
SELECT a.id,a.guest_id AS participant_id,a.event_id,a.token_hash,a.active,a.created_at,a.revoked_at,1 AS is_guest FROM participant_portal_guest_access a;
CREATE VIEW IF NOT EXISTS participant_portal_authenticated_access AS
SELECT a.id,a.participant_id,a.event_id,a.active,0 AS is_guest,s.token_hash AS session_token_hash,s.expires_at
FROM participant_portal_sessions s JOIN participant_portal_access a ON a.id=s.access_id
UNION ALL
SELECT a.id,a.guest_id AS participant_id,a.event_id,a.active,1 AS is_guest,s.token_hash AS session_token_hash,s.expires_at
FROM participant_portal_guest_sessions s JOIN participant_portal_guest_access a ON a.id=s.access_id;

-- Real Releve ballots are private and immutable; installation does not open voting.
CREATE TABLE IF NOT EXISTS releve_voting_polls (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES participant_portal_events(id),
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('open','closed')),
  voter_mode TEXT NOT NULL DEFAULT 'device' CHECK (voter_mode='device'),
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  last_action_id TEXT,
  opened_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS releve_voting_sessions (
  token_hash TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES releve_voting_polls(id),
  voter_hash TEXT NOT NULL,
  voter_mode TEXT NOT NULL CHECK (voter_mode='device'),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_releve_voting_sessions_expiry ON releve_voting_sessions(expires_at);
CREATE TABLE IF NOT EXISTS releve_voting_ballots (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES releve_voting_polls(id),
  voter_hash TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(poll_id,voter_hash)
);
CREATE INDEX IF NOT EXISTS idx_releve_voting_ballots_totals ON releve_voting_ballots(poll_id,candidate_id);
CREATE TABLE IF NOT EXISTS releve_voting_audit (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL REFERENCES releve_voting_polls(id),
  actor_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  voter_mode TEXT,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS releve_voting_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_releve_voting_rate_expiry ON releve_voting_rate_limits(expires_at);
