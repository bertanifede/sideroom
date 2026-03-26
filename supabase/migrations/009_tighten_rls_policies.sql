-- Fix CRITICAL: Tracks table exposes file_path to everyone via anon key
-- Only the party artist needs to SELECT tracks via RLS.
-- Guests access audio through the server-side streaming proxy (service role).
DROP POLICY "Tracks viewable by everyone" ON tracks;
CREATE POLICY "Tracks viewable by party artist" ON tracks FOR SELECT
USING (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));

-- Fix CRITICAL: Remove anon storage read policy.
-- The streaming proxy uses the service role to generate signed URLs server-side.
-- Anon users never need direct storage access.
DROP POLICY "Anon can read via signed URL" ON storage.objects;

-- Fix HIGH: Seats table exposes guest_token to everyone via anon key
DROP POLICY "Seats are viewable by everyone" ON seats;
CREATE POLICY "Seats viewable by party artist" ON seats FOR SELECT
USING (EXISTS (SELECT 1 FROM parties WHERE id = party_id AND artist_id = auth.uid()));
