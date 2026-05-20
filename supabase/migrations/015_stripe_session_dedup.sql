-- Self-healing party creation: schema-drift backfill + dedup guarantee.
--
-- pending_checkouts and parties.stripe_session_id already exist in the
-- production database but were never captured in a migration file. The
-- IF NOT EXISTS clauses make this a no-op against production while making
-- a fresh database correct.

-- Backfill: pending_checkouts
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL,
  artist_id         UUID NOT NULL REFERENCES profiles(id),
  party_data        JSONB NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (which bypasses RLS) ever
-- touches this table. Anon/authenticated access is denied by default.

-- Backfill: parties.stripe_session_id
ALTER TABLE parties ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- New: dedup guarantee. A unique index supports IF NOT EXISTS; Postgres
-- permits multiple NULLs, so legacy rows with a null stripe_session_id
-- are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS parties_stripe_session_id_key
  ON parties (stripe_session_id);
