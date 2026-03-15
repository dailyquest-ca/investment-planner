-- Mark the transitional scenarios table as legacy.
-- Target-model tables use "finpath_" prefix; transitional tables use "finpath_legacy_".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finpath_scenarios')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finpath_legacy_scenarios')
  THEN
    ALTER TABLE finpath_scenarios RENAME TO finpath_legacy_scenarios;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'finpath_scenarios_user_id_updated_at_idx')
  THEN
    ALTER INDEX finpath_scenarios_user_id_updated_at_idx RENAME TO finpath_legacy_scenarios_user_id_updated_at_idx;
  END IF;
END$$;
