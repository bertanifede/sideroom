-- Timestamped annotations on tracks (live reactions + post-party notes)

CREATE TABLE track_annotations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id       UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  track_id       UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  seat_id        UUID REFERENCES seats(id),
  author_name    TEXT NOT NULL,
  timestamp_sec  FLOAT8 NOT NULL CHECK (timestamp_sec >= 0),
  text           TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
  is_live_reaction BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_party ON track_annotations(party_id);
CREATE INDEX idx_annotations_track ON track_annotations(track_id);

ALTER TABLE track_annotations ENABLE ROW LEVEL SECURITY;

-- Artists can read all annotations for their parties
CREATE POLICY "Artists read own party annotations" ON track_annotations FOR SELECT
  USING (EXISTS (SELECT 1 FROM parties WHERE parties.id = track_annotations.party_id AND parties.artist_id = auth.uid()));

-- Inserts via service client (guests have no Supabase auth)
CREATE POLICY "Service insert annotations" ON track_annotations FOR INSERT WITH CHECK (true);

-- Service client reads (for guest-filtered queries)
CREATE POLICY "Service read annotations" ON track_annotations FOR SELECT USING (true);
