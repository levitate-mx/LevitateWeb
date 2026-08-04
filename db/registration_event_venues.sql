PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS registration_academies_next;
CREATE TABLE registration_academies_next (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  origin_type TEXT NOT NULL DEFAULT 'mexico' CHECK (origin_type IN ('mexico', 'international')),
  origin_state TEXT,
  origin_country TEXT NOT NULL DEFAULT 'México',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, venue)
);
INSERT INTO registration_academies_next (
  id,
  name,
  venue,
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
  venue,
  contact_name,
  email,
  phone,
  'mexico',
  NULL,
  'México',
  created_at,
  updated_at
FROM registration_academies;
DROP TABLE registration_academies;
ALTER TABLE registration_academies_next RENAME TO registration_academies;

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
  venue TEXT NOT NULL CHECK (venue IN ('cdmx', 'puebla', 'edomex', 'veracruz')),
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
  subgenre,
  category,
  level,
  venue,
  created_by_user_id,
  created_at,
  updated_at
FROM registration_dances;
DROP TABLE registration_dances;
ALTER TABLE registration_dances_next RENAME TO registration_dances;

DROP TABLE IF EXISTS registration_inscription_orders_next;
CREATE TABLE registration_inscription_orders_next (
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
INSERT INTO registration_inscription_orders_next (
  id,
  curp,
  participant_name,
  academy_id,
  academy_name,
  venue,
  reference,
  amount,
  paid_amount,
  status,
  payment_method,
  buyer_phone_country_code,
  buyer_phone_number,
  buyer_phone,
  line_items_json,
  notes,
  paid_at,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  rejection_message,
  created_at,
  updated_at
)
SELECT
  id,
  curp,
  participant_name,
  academy_id,
  academy_name,
  venue,
  reference,
  amount,
  paid_amount,
  status,
  payment_method,
  buyer_phone_country_code,
  buyer_phone_number,
  buyer_phone,
  line_items_json,
  notes,
  paid_at,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  rejection_message,
  created_at,
  updated_at
FROM registration_inscription_orders;
DROP TABLE registration_inscription_orders;
ALTER TABLE registration_inscription_orders_next RENAME TO registration_inscription_orders;

DROP TABLE IF EXISTS registration_shop_orders_next;
CREATE TABLE registration_shop_orders_next (
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
INSERT INTO registration_shop_orders_next (
  id,
  curp,
  participant_name,
  academy_id,
  academy_name,
  venue,
  reference,
  amount,
  paid_amount,
  status,
  payment_method,
  buyer_phone_country_code,
  buyer_phone_number,
  buyer_phone,
  discount_code,
  discount_amount,
  line_items_json,
  notes,
  paid_at,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  rejection_message,
  created_at,
  updated_at
)
SELECT
  id,
  curp,
  participant_name,
  academy_id,
  academy_name,
  venue,
  reference,
  amount,
  paid_amount,
  status,
  payment_method,
  buyer_phone_country_code,
  buyer_phone_number,
  buyer_phone,
  discount_code,
  discount_amount,
  line_items_json,
  notes,
  paid_at,
  reviewed_by,
  reviewed_at,
  rejection_reason,
  rejection_message,
  created_at,
  updated_at
FROM registration_shop_orders;
DROP TABLE registration_shop_orders;
ALTER TABLE registration_shop_orders_next RENAME TO registration_shop_orders;

DROP TABLE IF EXISTS registration_recognition_documents_next;
CREATE TABLE registration_recognition_documents_next (
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
  shirt_size,
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

CREATE INDEX IF NOT EXISTS idx_registration_dances_academy_id ON registration_dances(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_dances_venue ON registration_dances(venue);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_curp ON registration_inscription_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_academy_id ON registration_inscription_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_inscription_orders_status ON registration_inscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_curp ON registration_shop_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_academy_id ON registration_shop_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status ON registration_shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_academy_id ON registration_recognition_documents(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_venue ON registration_recognition_documents(venue);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_status ON registration_recognition_documents(status);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_document_type ON registration_recognition_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_participant_id ON registration_recognition_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_choreographer_id ON registration_recognition_documents(choreographer_id);
CREATE INDEX IF NOT EXISTS idx_registration_recognition_documents_dance_id ON registration_recognition_documents(dance_id);

PRAGMA foreign_keys = ON;
