ALTER TABLE registration_dances ADD COLUMN program_json TEXT CHECK (program_json IS NULL OR json_valid(program_json));
