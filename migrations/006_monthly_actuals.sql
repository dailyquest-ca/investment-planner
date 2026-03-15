-- Monthly actuals: one row per user per month storing observed financial data.

CREATE TABLE IF NOT EXISTS finpath_monthly_actuals (
  id TEXT PRIMARY KEY DEFAULT ('act_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year_month)
);

CREATE INDEX IF NOT EXISTS finpath_monthly_actuals_user_timeline
  ON finpath_monthly_actuals (user_id, year_month DESC);
