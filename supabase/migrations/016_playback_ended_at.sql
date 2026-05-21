-- Wind-down: records when the last track finished. The party then stays open
-- for chat/notes until the host taps "End Party" (or the 1-hour cap is hit).
ALTER TABLE parties ADD COLUMN playback_ended_at TIMESTAMPTZ;
