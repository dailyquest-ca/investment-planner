# Target Data Model

This document describes the current schema and the planned normalized schema for
long-term historical tracking. The planning layer (current) stores assumption
documents; the tracking layer (future) stores monthly financial actuals.

## Current: Document-oriented planning

```
users              (Auth.js – id SERIAL PK)
accounts           (Auth.js – OAuth/email provider accounts)
sessions           (Auth.js – server-side sessions)
verification_token (Auth.js – email magic-link tokens)

ip_scenarios
  id              TEXT PK
  user_id         INTEGER FK → users(id)
  name            TEXT
  schema_version  INTEGER  (for future-proof payload migrations)
  inputs          JSONB    (full planner assumption set)
  is_default      BOOLEAN
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ

ip_migrations
  name        TEXT PK
  applied_at  TIMESTAMPTZ
```

### Versioning strategy

Each scenario carries a `schema_version` integer. When the `BuyingScenarioInputs`
shape changes, the app should migrate stale payloads on read (add missing fields,
rename keys) and bump the version on next write.

## Future: Normalized monthly tracking

The tables below are the target design for the "Track" page. They are **not yet
created**; this section documents the intended model so implementation can proceed
when the feature is built.

### tracked_accounts

One row per financial account (TFSA, RRSP, non-reg brokerage, HELOC, etc.).

```sql
CREATE TABLE tracked_accounts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,                -- e.g. "Joint TFSA"
  type        TEXT NOT NULL,                -- TFSA | RRSP | FHSA | NonRegistered | HELOC
  currency    TEXT NOT NULL DEFAULT 'CAD',
  opened_at   DATE,
  closed_at   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### account_snapshots

Append-only monthly balance snapshots. One row per account per month.

```sql
CREATE TABLE account_snapshots (
  id              SERIAL PRIMARY KEY,
  account_id      INTEGER NOT NULL REFERENCES tracked_accounts(id) ON DELETE CASCADE,
  month           DATE NOT NULL,            -- first day of the month
  balance         NUMERIC(14,2) NOT NULL,
  contributions   NUMERIC(14,2) DEFAULT 0,  -- deposits that month
  withdrawals     NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, month)
);
```

### real_estate_assets

One row per property.

```sql
CREATE TABLE real_estate_assets (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,            -- e.g. "Main Residence"
  purchase_price  NUMERIC(14,2),
  purchase_date   DATE,
  address_city    TEXT,
  address_prov    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### real_estate_snapshots

Monthly property + mortgage snapshot.

```sql
CREATE TABLE real_estate_snapshots (
  id              SERIAL PRIMARY KEY,
  asset_id        INTEGER NOT NULL REFERENCES real_estate_assets(id) ON DELETE CASCADE,
  month           DATE NOT NULL,
  estimated_value NUMERIC(14,2) NOT NULL,
  mortgage_bal    NUMERIC(14,2) DEFAULT 0,
  heloc_bal       NUMERIC(14,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, month)
);
```

### Scale estimates

- 5,000 users × 5 accounts × 20 years × 12 months = **6M** account_snapshots rows
- With proper indexes on `(account_id, month)` and `(user_id)`, this is
  well within standard Postgres capability on Neon's free/Launch tier.

### Query patterns

- **Dashboard**: latest snapshot per account for a single user → indexed seek
- **Chart**: monthly time series for one account, bounded by date range → range scan
- **Net worth**: SUM of latest balances across all user accounts → small fan-out

All queries are single-user, never cross-tenant. Row-level access is enforced at
the API layer by matching `user_id` from the server-side session.
```
