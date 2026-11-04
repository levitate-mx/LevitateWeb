-- Add operational-session scan history without changing canonical admissions.
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
