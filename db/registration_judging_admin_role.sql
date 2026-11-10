-- Additive staff capability: keep the legacy role CHECK and existing users.
-- Prefer prepare-registration-db.mjs for an idempotent deployment.
ALTER TABLE registration_users
  ADD COLUMN is_judging_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_judging_admin IN (0, 1));
