-- Self-healing party creation: schema-drift backfill + dedup guarantee.
--
-- pending_checkouts and parties.stripe_session_id already exist in the
-- production database but were never captured in a migration file. Every
-- statement here is written to be a no-op against the existing production
-- schema while still making a fresh database correct. The ONLY change to
-- production is the new unique index at the bottom.

-- Backfill: pending_checkouts.
-- No-op on production (the table already exists); creates it on a fresh DB.
CREATE TABLE IF NOT EXISTS pending_checkouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT NOT NULL,
  artist_id         UUID NOT NULL REFERENCES profiles(id),
  party_data        JSONB NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on pending_checkouts only if it is not already enabled, so
-- this migration provably does not alter the existing production table.
-- (Only the service-role client, which bypasses RLS, ever touches this
-- table; with RLS on and no policies, anon/authenticated access is denied.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'pending_checkouts'
      AND rowsecurity = true
  ) THEN
    EXECUTE 'ALTER TABLE pending_checkouts ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Backfill: parties.stripe_session_id.
-- No-op on production (the column already exists); adds it on a fresh DB.
ALTER TABLE parties ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

-- New: the dedup guarantee. This is the only statement that changes the
-- production schema, and it only ADDS an index -- no table, column, or
-- data is altered. Verified beforehand that parties has no duplicate
-- non-null stripe_session_id values, so the index builds cleanly.
-- Postgres permits multiple NULLs, so legacy rows with a null
-- stripe_session_id are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS parties_stripe_session_id_key
  ON parties (stripe_session_id);
