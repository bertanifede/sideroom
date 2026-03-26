-- Feedback from guests after a listening party ends

CREATE TABLE feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  seat_id     UUID NOT NULL REFERENCES seats(id),
  guest_name  TEXT NOT NULL,
  message     TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_feedback_seat ON feedback(seat_id);
CREATE INDEX idx_feedback_party ON feedback(party_id);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Artists read their own party feedback
CREATE POLICY "Artists can read own party feedback" ON feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM parties WHERE parties.id = feedback.party_id AND parties.artist_id = auth.uid()));

-- Inserts via service client (guests have no Supabase auth)
CREATE POLICY "Service insert" ON feedback FOR INSERT WITH CHECK (true);
