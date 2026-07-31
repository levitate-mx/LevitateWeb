ALTER TABLE registration_choreographers
ADD COLUMN shirt_size TEXT NOT NULL DEFAULT 'm' CHECK (shirt_size IN ('6', '8', '10', '12', 'xs', 's', 'm', 'l'));
