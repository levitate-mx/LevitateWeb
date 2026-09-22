ALTER TABLE registration_dances
ADD COLUMN is_releve INTEGER NOT NULL DEFAULT 0 CHECK (is_releve IN (0, 1));
