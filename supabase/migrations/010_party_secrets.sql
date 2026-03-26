-- Move pin_hash out of the publicly readable parties table
-- into a separate table with artist-only RLS.
CREATE TABLE party_secrets (
  party_id UUID PRIMARY KEY REFERENCES parties(id) ON DELETE CASCADE,
  pin_hash TEXT
);

ALTER TABLE party_secrets ENABLE ROW LEVEL SECURITY;

-- Only the party artist can read/write secrets
CREATE POLICY "Artist can view own party secrets" ON party_secrets FOR SELECT
USING (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));

CREATE POLICY "Artist can insert own party secrets" ON party_secrets FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));

CREATE POLICY "Artist can update own party secrets" ON party_secrets FOR UPDATE
USING (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));

CREATE POLICY "Artist can delete own party secrets" ON party_secrets FOR DELETE
USING (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));

-- Migrate existing pin_hash data
INSERT INTO party_secrets (party_id, pin_hash)
SELECT id, pin_hash FROM parties WHERE pin_hash IS NOT NULL;

-- Drop pin_hash from parties table
ALTER TABLE parties DROP COLUMN pin_hash;
