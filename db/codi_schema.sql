CREATE TABLE IF NOT EXISTS codi_orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (
    status IN (
      'created',
      'pending_payment',
      'paid',
      'expired',
      'failed',
      'manual_review'
    )
  ),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'MXN',
  description TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codi_payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES codi_orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending_payment',
      'paid',
      'expired',
      'failed',
      'manual_review'
    )
  ),
  method TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'MXN',
  qr_payload TEXT,
  qr_image_url TEXT,
  redirect_url TEXT,
  raw_request JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codi_payment_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payment_attempt_id TEXT REFERENCES codi_payment_attempts(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES codi_orders(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_codi_orders_status ON codi_orders(status);
CREATE INDEX IF NOT EXISTS idx_codi_payment_attempts_order_id ON codi_payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_codi_payment_attempts_provider_payment_id
  ON codi_payment_attempts(provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_codi_payment_events_order_id ON codi_payment_events(order_id);

CREATE TABLE IF NOT EXISTS levitate_media_overrides (
  media_key TEXT PRIMARY KEY,
  media_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
