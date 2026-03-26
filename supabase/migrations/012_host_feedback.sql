-- Host feedback table for post-party summary ratings
CREATE TABLE host_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL UNIQUE REFERENCES parties(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT CHECK (char_length(message) <= 2000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE host_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists can view own feedback"
  ON host_feedback FOR SELECT USING (auth.uid() = artist_id);
CREATE POLICY "Artists can insert own feedback"
  ON host_feedback FOR INSERT WITH CHECK (auth.uid() = artist_id);
