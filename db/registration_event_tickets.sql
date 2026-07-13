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

CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_source_order ON registration_event_tickets(source_order_type, source_order_id);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_ticket_code ON registration_event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_registration_event_tickets_status ON registration_event_tickets(status);
