ALTER TABLE registration_users ADD COLUMN email_confirmed_at TEXT;

UPDATE registration_users
SET email_confirmed_at = COALESCE(email_confirmed_at, created_at, datetime('now'))
WHERE email_confirmed_at IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_registration_email_verification_tokens_user_id
  ON registration_email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_registration_email_verification_tokens_expires_at
  ON registration_email_verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_registration_password_reset_tokens_user_id
  ON registration_password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_registration_password_reset_tokens_expires_at
  ON registration_password_reset_tokens(expires_at);
