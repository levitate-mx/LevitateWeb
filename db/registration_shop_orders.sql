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

CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_curp ON registration_shop_orders(curp);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_academy_id ON registration_shop_orders(academy_id);
CREATE INDEX IF NOT EXISTS idx_registration_shop_orders_status ON registration_shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_registration_shop_payment_proofs_order_id ON registration_shop_payment_proofs(order_id);
