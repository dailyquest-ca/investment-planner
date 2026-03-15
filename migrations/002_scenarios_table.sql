-- App scenario storage – versioned JSON documents per user.
-- user_id references the Auth.js users table.

CREATE TABLE IF NOT EXISTS ip_scenarios (
  id TEXT PRIMARY KEY DEFAULT ('scn_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Scenario',
  schema_version INTEGER NOT NULL DEFAULT 1,
  inputs JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ip_scenarios_user_id_updated_at_idx
  ON ip_scenarios (user_id, updated_at DESC);
