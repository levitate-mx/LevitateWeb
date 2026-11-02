-- Additive migration: preserve existing music files and metadata. Existing
-- durations remain unknown until measured from the corresponding MP3.
ALTER TABLE registration_music_uploads
  ADD COLUMN duration_seconds REAL CHECK (duration_seconds IS NULL OR duration_seconds > 0);
