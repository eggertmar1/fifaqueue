-- Allow admins to add any player to the pool
CREATE POLICY "Admins can insert queue_entries for any player"
  ON queue_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND is_admin = true)
  );
