-- Add schema_version column if missing (existing rows default to 1).
-- Also convert user_id from TEXT to INTEGER referencing users(id) if needed.

DO $$
BEGIN
  -- Add schema_version if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_scenarios' AND column_name = 'schema_version'
  ) THEN
    ALTER TABLE ip_scenarios ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- If user_id is TEXT, convert to INTEGER.
  -- Rows referencing old anonymous UUIDs will become orphaned (no FK match).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_scenarios' AND column_name = 'user_id' AND data_type = 'text'
  ) THEN
    ALTER TABLE ip_scenarios ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;
  END IF;
END$$;
