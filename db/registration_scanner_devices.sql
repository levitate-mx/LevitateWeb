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

CREATE INDEX IF NOT EXISTS idx_registration_scanner_pairing_codes_expires_at
ON registration_scanner_pairing_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_registration_scanner_devices_status
ON registration_scanner_devices(status);

