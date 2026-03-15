-- Tracks which migrations have been applied.

CREATE TABLE IF NOT EXISTS ip_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
