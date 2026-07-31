ALTER TABLE registration_participants
ADD COLUMN is_releve_teacher INTEGER NOT NULL DEFAULT 0 CHECK (is_releve_teacher IN (0, 1));
