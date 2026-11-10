-- Existing mode CHECK constraints remain unchanged. Automatic completion is a
-- separate additive flag; schema preparation applies each missing column once.
ALTER TABLE participant_portal_publication_settings ADD COLUMN automatic_completion INTEGER NOT NULL DEFAULT 0 CHECK (automatic_completion IN (0,1));
ALTER TABLE participant_portal_routines ADD COLUMN publication_blocked INTEGER NOT NULL DEFAULT 0 CHECK (publication_blocked IN (0,1));
