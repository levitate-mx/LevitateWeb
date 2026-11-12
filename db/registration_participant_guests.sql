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
