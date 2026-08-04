ALTER TABLE registration_users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'academy' CHECK (role IN ('academy', 'admin'));
