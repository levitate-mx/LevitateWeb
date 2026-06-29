PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS passport_events (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  event_date TEXT,
  passport_name TEXT NOT NULL DEFAULT 'Pasaporte Colibrí',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS passport_stations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES passport_events(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  station_order INTEGER NOT NULL CHECK (station_order > 0),
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  description TEXT NOT NULL,
  stamp_label TEXT NOT NULL,
  highlights TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, slug),
  UNIQUE (event_id, station_order)
);

CREATE TABLE IF NOT EXISTS passports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES passport_events(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  claim_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'disabled')),
  participant_name TEXT,
  academy TEXT,
  category TEXT,
  contact TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS passport_sessions (
  id TEXT PRIMARY KEY,
  passport_id TEXT NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS station_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES passport_events(id) ON DELETE CASCADE,
  passport_id TEXT NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL REFERENCES passport_stations(id) ON DELETE CASCADE,
  metadata TEXT NOT NULL DEFAULT '{}',
  scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (passport_id, station_id)
);

CREATE TABLE IF NOT EXISTS feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL REFERENCES passport_events(id) ON DELETE CASCADE,
  passport_id TEXT REFERENCES passports(id) ON DELETE SET NULL,
  station_id TEXT REFERENCES passport_stations(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_passport_stations_event_id ON passport_stations(event_id);
CREATE INDEX IF NOT EXISTS idx_passports_event_id ON passports(event_id);
CREATE INDEX IF NOT EXISTS idx_passports_status ON passports(status);
CREATE INDEX IF NOT EXISTS idx_passport_sessions_passport_id ON passport_sessions(passport_id);
CREATE INDEX IF NOT EXISTS idx_station_scans_passport_id ON station_scans(passport_id);
CREATE INDEX IF NOT EXISTS idx_station_scans_event_id ON station_scans(event_id);

INSERT INTO passport_events (id, slug, title, city, event_date, passport_name)
VALUES (
  'event-levitate-cdmx-2026',
  'levitate-cdmx-2026',
  'Levitate CDMX 2026',
  'Ciudad de México',
  'Piloto Pasaporte Colibrí',
  'Pasaporte Colibrí'
)
ON CONFLICT (slug) DO UPDATE SET
  title = excluded.title,
  city = excluded.city,
  event_date = excluded.event_date,
  passport_name = excluded.passport_name,
  updated_at = datetime('now');

INSERT INTO passport_stations (
  id,
  event_id,
  slug,
  station_order,
  title,
  short_title,
  description,
  stamp_label,
  highlights
)
VALUES
  (
    'station-levitate-cdmx-2026-bienvenida',
    'event-levitate-cdmx-2026',
    'bienvenida',
    1,
    'Bienvenida',
    'Bienvenida',
    'Horario, mapa del venue y reglas rápidas para empezar el recorrido con claridad.',
    'Primer aleteo',
    '["Mapa del evento", "Horarios clave", "Reglas rápidas"]'
  ),
  (
    'station-levitate-cdmx-2026-backstage',
    'event-levitate-cdmx-2026',
    'backstage',
    2,
    'Backstage',
    'Backstage',
    'Checklist de salida a escenario para que cada participante llegue lista y en calma.',
    'Listo para escena',
    '["Vestuario", "Música", "Orden de salida"]'
  ),
  (
    'station-levitate-cdmx-2026-photo-spot',
    'event-levitate-cdmx-2026',
    'photo-spot',
    3,
    'Photo Spot',
    'Photo Spot',
    'Acceso a galería, compra de fotos y reel del evento desde una estación visual.',
    'Momento capturado',
    '["Galería", "Paquetes foto/video", "Reel del evento"]'
  ),
  (
    'station-levitate-cdmx-2026-sponsor-zone',
    'event-levitate-cdmx-2026',
    'sponsor-zone',
    4,
    'Sponsor Zone',
    'Sponsors',
    'Cupones, beneficios y experiencias de marcas aliadas para asistentes y academias.',
    'Beneficio desbloqueado',
    '["Cupones", "Beneficios", "Aliados"]'
  ),
  (
    'station-levitate-cdmx-2026-feedback',
    'event-levitate-cdmx-2026',
    'feedback',
    5,
    'Feedback',
    'Feedback',
    'Encuesta breve post-presentación para cerrar el vuelo con aprendizaje y escucha.',
    'Vuelo completo',
    '["Encuesta rápida", "Comentarios", "Certificado"]'
  )
ON CONFLICT (event_id, slug) DO UPDATE SET
  station_order = excluded.station_order,
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  stamp_label = excluded.stamp_label,
  highlights = excluded.highlights,
  updated_at = datetime('now');

INSERT INTO passports (id, event_id, code, claim_token_hash, status)
VALUES (
  'passport-demo-colibri',
  'event-levitate-cdmx-2026',
  'COL-DEMO',
  '5e940fee0eae2737bf50dac823e9aebbdae4a528dcd40d0f4448dcf0742eccb0',
  'available'
)
ON CONFLICT (code) DO NOTHING;
