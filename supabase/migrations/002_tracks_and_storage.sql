-- Tracks table (one party has many tracks, ordered)
CREATE TABLE tracks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id   UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  position   INT NOT NULL,              -- playback order (1-based)
  file_path  TEXT NOT NULL,             -- path in Supabase Storage
  file_name  TEXT NOT NULL,             -- original filename for display
  duration   FLOAT,                     -- seconds, set after upload
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, position)
);

ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tracks viewable by everyone" ON tracks FOR SELECT USING (true);
CREATE POLICY "Artists can insert tracks" ON tracks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid())
);
CREATE POLICY "Artists can update own tracks" ON tracks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid())
);
CREATE POLICY "Artists can delete own tracks" ON tracks FOR DELETE USING (
  EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid())
);

-- Storage RLS (for the party-audio bucket)
CREATE POLICY "Artists can upload audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'party-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Artists can read own audio"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'party-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Artists can delete own audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'party-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anon can read via signed URL"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'party-audio');

-- Cleanup function: delete audio 48h after party ends
CREATE OR REPLACE FUNCTION cleanup_expired_party_audio()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.id as party_id, t.file_path
    FROM parties p
    JOIN tracks t ON t.party_id = p.id
    WHERE p.ended_at IS NOT NULL
      AND p.ended_at < NOW() - INTERVAL '48 hours'
      AND p.files_deleted = false
  LOOP
    DELETE FROM storage.objects
    WHERE bucket_id = 'party-audio' AND name = r.file_path;
  END LOOP;

  UPDATE parties SET files_deleted = true
  WHERE ended_at IS NOT NULL
    AND ended_at < NOW() - INTERVAL '48 hours'
    AND files_deleted = false;
END;
$$;
