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
