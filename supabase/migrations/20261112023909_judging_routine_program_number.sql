-- Keep printed programme numbers independent of persistent routine IDs.
-- Existing routines remain NULL; no scores, IDs, memberships or policies change.
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS program_number text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.routines'::regclass
      AND conname = 'routines_program_number_format'
  ) THEN
    ALTER TABLE public.routines
      ADD CONSTRAINT routines_program_number_format CHECK (
        program_number IS NULL OR (
          char_length(program_number) BETWEEN 1 AND 32
          AND program_number ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]*$'
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.routines.program_number IS
  'Original printed programme number such as 194 a or 237; display only, independent of routine_id and registration links.';
