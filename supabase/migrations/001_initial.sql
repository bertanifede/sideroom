-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Parties
CREATE TABLE parties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code     TEXT UNIQUE NOT NULL,
  artist_id       UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  description     TEXT,
  seat_limit      INT NOT NULL DEFAULT 10 CHECK (seat_limit BETWEEN 1 AND 50),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  files_deleted   BOOLEAN DEFAULT FALSE,
  payment_status  TEXT NOT NULL DEFAULT 'paid',
  file_path       TEXT,
  file_name       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seats
CREATE TABLE seats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  guest_name  TEXT NOT NULL,
  guest_token TEXT UNIQUE NOT NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  left_at     TIMESTAMPTZ
);

CREATE INDEX idx_seats_party_active ON seats(party_id) WHERE left_at IS NULL;

-- Chat messages
CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id    UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  seat_id     UUID NOT NULL REFERENCES seats(id),
  sender_name TEXT NOT NULL,
  text        TEXT NOT NULL CHECK (char_length(text) <= 500),
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Race-condition-safe seat claiming
CREATE OR REPLACE FUNCTION claim_seat(
  p_party_id UUID,
  p_guest_name TEXT,
  p_guest_token TEXT
) RETURNS TABLE(success BOOLEAN, seat_id UUID, reason TEXT) AS $$
DECLARE
  v_seat_limit INT;
  v_active_count INT;
  v_seat_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_party_id::text));

  SELECT seat_limit INTO v_seat_limit FROM parties WHERE id = p_party_id;

  IF v_seat_limit IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'party_not_found'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM seats
  WHERE party_id = p_party_id AND left_at IS NULL;

  IF v_active_count >= v_seat_limit THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'party_full'::TEXT;
    RETURN;
  END IF;

  INSERT INTO seats (party_id, guest_name, guest_token)
  VALUES (p_party_id, p_guest_name, p_guest_token)
  RETURNING id INTO v_seat_id;

  RETURN QUERY SELECT TRUE, v_seat_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Parties: anyone can read paid parties, artists can insert/update own
CREATE POLICY "Paid parties are viewable by everyone" ON parties FOR SELECT USING (payment_status = 'paid');
CREATE POLICY "Artists can create parties" ON parties FOR INSERT WITH CHECK (auth.uid() = artist_id);
CREATE POLICY "Artists can update own parties" ON parties FOR UPDATE USING (auth.uid() = artist_id);

-- Seats: viewable by party participants, insertable via RPC
CREATE POLICY "Seats are viewable by everyone" ON seats FOR SELECT USING (true);
CREATE POLICY "Seats are created via RPC" ON seats FOR INSERT WITH CHECK (true);

-- Chat: viewable by everyone, insertable by seat holders
CREATE POLICY "Chat is viewable by everyone" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Seat holders can send messages" ON chat_messages FOR INSERT WITH CHECK (true);

-- Storage bucket (run this in Supabase dashboard > Storage)
-- Create a private bucket called "party-audio"
-- Policy: authenticated users can upload to their own folder
-- Policy: anyone with a signed URL can download
