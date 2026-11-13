-- Existing full-block approvals remain unchanged. New approvals identify
-- complete judge sheets independently while keeping manual approval per block.
-- The schema preparer adds this column idempotently; this standalone SQL runs once.
ALTER TABLE registration_judging_sheet_releases
  ADD COLUMN manifest_json TEXT CHECK (manifest_json IS NULL OR json_valid(manifest_json));
