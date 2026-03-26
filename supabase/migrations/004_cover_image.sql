-- Add cover image support to parties
ALTER TABLE parties ADD COLUMN cover_image_path TEXT;

-- Create storage bucket for party images (covers)
INSERT INTO storage.buckets (id, name, public)
VALUES ('party-images', 'party-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for party-images bucket
-- Artists can upload to their own folder
CREATE POLICY "Artists upload cover images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'party-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can download via signed URL
CREATE POLICY "Cover images downloadable via signed URL"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'party-images');
