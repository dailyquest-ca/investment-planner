-- Rename legacy ip_* tables to finpath_* prefix.
-- Idempotent: only renames if the old name exists and the new name does not.

DO $$
BEGIN
  -- Rename ip_scenarios -> finpath_scenarios
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ip_scenarios')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finpath_scenarios')
  THEN
    ALTER TABLE ip_scenarios RENAME TO finpath_scenarios;
  END IF;

  -- Rename the index too
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ip_scenarios_user_id_updated_at_idx')
  THEN
    ALTER INDEX ip_scenarios_user_id_updated_at_idx RENAME TO finpath_scenarios_user_id_updated_at_idx;
  END IF;
END$$;
