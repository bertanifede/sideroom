-- Allow deleting and updating annotations via service client
CREATE POLICY "Service delete annotations" ON track_annotations FOR DELETE USING (true);
CREATE POLICY "Service update annotations" ON track_annotations FOR UPDATE USING (true);
