-- Add optional PIN protection to parties
ALTER TABLE parties ADD COLUMN pin_hash TEXT;
