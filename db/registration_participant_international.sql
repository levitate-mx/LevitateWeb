ALTER TABLE registration_participants
ADD COLUMN is_international INTEGER NOT NULL DEFAULT 0 CHECK (is_international IN (0, 1));
